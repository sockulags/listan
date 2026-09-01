# Agentytan

`listan` kör lokalt på samma burk som agenterna. Därför behövs ingen MCP-server över
nätet — ett CLI och ett lokalt API räcker, och blir dessutom enklare att testa.

## Tre lager

**Kärnan** (`src/core`) äger sqlite-filen via `node:sqlite` och all logik: rader, steg,
flikar, ordning, avdubblering på länk. Den vet ingenting om Electron och testas som
vanlig Node-kod.

**CLI:t** (`src/cli`) är ett tunt skal runt kärnan. Ett anrop ska räcka för en hel rad,
för agenter är dåliga på flerstegsflöden:

```bash
listan add "Verifiera auth-flödet" \
  --link https://github.com/sockulags/smask/pull/57 \
  --step "kör smoke-testet lokalt" \
  --step "kolla att session inte läcker" \
  --step "merga"
```

Rader ska också kunna komma in radvis från stdin utan flaggor alls, för fallet där du
säger till en agent "lägg in a, b, c" efter ett möte.

Verben är `add`, `list`, `next`, `check`, `rm`, `requeue`, `result`, `results` och `wait`.
`next` är det viktigaste vid inlämning: det svarar med aktiv rad plus nästa obockade steg,
så att en agent aldrig behöver läsa hela listan.

**Fönstret** läser samma sqlite-fil och bevakar datakatalogen. När en agent skriver
genom CLI:t märker huvudprocessen det och laddar om listan. Det ersätter det lokala
HTTP-API:t som först var tänkt: samma resultat för användaren, betydligt mindre kod, och
inget som kan sluta svara. Ett API blir intressant först om något utanför burken ska
läsa kön.

## Återlämning

En rad som lämnar kön lämnar ett **kvitto** efter sig. Kvittot bär avslutskoden, som är
den del som betyder mest:

- `completed` — du gjorde arbetet.
- `auto-resolved` — villkoret för raden uppfylldes, till exempel att PR:en stängdes.
- `cancelled` — du tog bort raden utan att göra den.
- `superseded` — agenten ersatte raden med en nyare version.

Utan koden läser mottagaren "raden är borta" som "arbetet gick bra", vilket stämmer i
ungefär ett fall av fyra.

Kvitton lever **utanför kön** i sin egen tabell och glöms efter fjorton dagar. Kön
förblir minneslös; det här är ett leveransminne, inte en historik.

Fyra format på samma kvitto:

- `--format answers` — bara utfallen och svaren, för en tråd som fortfarande lever och
  redan vet vad den bad om.
- `--format prompt` — hela sammanhanget, skrivet för att vara första meddelandet i en ny
  tråd som aldrig såg något av det.
- `--format markdown` — hela kvittot, standard för `result`.
- `--format json` — samma sak strukturerat.

## Väntan

`listan wait <id>` blockerar tills raden avslutas och skriver då ut kvittot. Det är
avsiktligt ett _blockerande_ anrop och inte något agenten pollar: en agent som frågar var
femte minut skickar om hela sin konversation varje gång, medan `wait` kostar ett anrop.
Inuti kommandot pollas sqlite-filen varje halvsekund, vilket är gratis eftersom ingen
modell är inblandad.

Standard är trettio minuter och taket fyra timmar. Vad som är rimligt beror på värden:

**Claude Code** kör kommandot i bakgrunden och väcker sessionen när processen avslutas.
Där kostar en halvtimmes väntan ingenting, och gränsen sätts i praktiken av
prompt-cachen: återupptas tråden inom cachefönstret är det billigt, efter det betalar man
en enda omläsning av tråden. Fortfarande långt billigare än pollning.

**Codex** har ingen process-callback som återstartar en avslutad turn. Där väntar tråden
kvar i samma terminalsession: första anropet lämnar tillbaka ett levande `session_id`, och
agenten fortsätter vänta på samma session tills processen avslutas. En tyst väntan håller
i ungefär fem minuter innan ett nytt verktygsanrop behövs, så tio minuter är den praktiska
gränsen och `--timeout 10m` det som ska användas. En frikopplad bakgrundsprocess fungerar
inte alls, för då finns ingen väg tillbaka för stdout.

Allt som tar längre tid än så ska låta tråden dö; överlämningen sker med `--format prompt`
till en ny tråd i stället.

Medan någon väntar märks raden i gränssnittet. När du tömmer kön en måndagsmorgon är den
raden den som någon sitter blockerad på.

Väntan kan stängas av i inställningarna. Då avvisas `wait` med kod 3 och trådarna får
hämta kvittot i efterhand.

## Distribution av plugin-paketet

Plugin-paketet läggs som en marketplace i appens datamapp under `%APPDATA%\listan`.
Du pekar din agentklient på den sökvägen en gång.

Poängen är uppdateringen: mappen skrivs om från appens egna resurser vid varje start,
så när `listan` uppdaterar sig får plugin-paketet den nya versionen utan att något
publiceras separat och utan att du gör om något.

Katalogen skrivs i Claude Codes marketplace-form: `.claude-plugin/marketplace.json` i
roten, ett plugin under `listan/` med sin egen `plugin.json`, och en skill under
`listan/skills/listan/SKILL.md` som beskriver när och hur en agent ska skriva till kön.

Kör `/plugin marketplace add %APPDATA%\listan\plugin` en gång i Claude Code.

**Codex tar samma skill genom en symlänk.** Codex läser lokala skills från
`%USERPROFILE%\.agents\skills\<namn>\SKILL.md` och följer symboliska länkar, så en länk
dit räcker och fortsätter peka rätt när appen skriver om målkatalogen:

```powershell
$source = Join-Path $env:APPDATA 'listan\plugin\listan\skills\listan'
$parent = Join-Path $HOME '.agents\skills'
New-Item -ItemType Directory -Force -Path $parent | Out-Null
New-Item -ItemType SymbolicLink -Path (Join-Path $parent 'listan') -Target $source
```

Det kräver Developer Mode eller rätt att skapa symlänkar. En ny tråd är den säkra gränsen
för att ändringar ska synas.

Codex har numera också en egen marketplace, med `.codex-plugin/plugin.json` i stället för
`.claude-plugin`. Den vägen är medvetet inte vald: en installerad lokal Codex-plugin följer
inte källkatalogens omskrivningar tillförlitligt, utan kräver versionshöjning och
ominstallation vid varje uppdatering. Symlänkade skills gör det som var hela poängen —
följer appversionen utan att någon gör om något.

Vid sidan av marketplacen skrivs en CLI-shim till `%APPDATA%\listan\bin`. Den kör
`listan` genom appens egen Electron-binär med `ELECTRON_RUN_AS_NODE`, så CLI:t fungerar
utan att Node finns installerat vid sidan om. Lägg mappen i PATH.
