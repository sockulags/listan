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

Verben är `add`, `list`, `next`, `check`, `rm` och `requeue`. `next` är det viktigaste:
det svarar med aktiv rad plus nästa obockade steg, så att en agent aldrig behöver läsa
hela listan.

**Fönstret** läser samma sqlite-fil och bevakar datakatalogen. När en agent skriver
genom CLI:t märker huvudprocessen det och laddar om listan. Det ersätter det lokala
HTTP-API:t som först var tänkt: samma resultat för användaren, betydligt mindre kod, och
inget som kan sluta svara. Ett API blir intressant först om något utanför burken ska
läsa kön.

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
