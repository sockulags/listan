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

Kör det i bakgrunden där värden stöder det, så väcks sessionen när kommandot avslutas.

Väntan passar korta verifieringar. Standard är tio minuter och taket en timme; allt
längre än så ska tråden dö och överlämningen ske med `--format prompt` i stället.

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

Codex har ingen marketplace i samma mening; där pekas samma katalog ut som källa för
prompts och skills.

**Detta är inte verifierat mot klienterna än.** Filerna är välformade och skrivs ut på
rätt plats, men att Claude Code faktiskt accepterar marketplacen kräver att någon kör
`/plugin marketplace add %APPDATA%\listan\plugin` en gång och ser efter. Gör det innan
formen dokumenteras som färdig.

Vid sidan av marketplacen skrivs en CLI-shim till `%APPDATA%\listan\bin`. Den kör
`listan` genom appens egen Electron-binär med `ELECTRON_RUN_AS_NODE`, så CLI:t fungerar
utan att Node finns installerat vid sidan om. Lägg mappen i PATH.
