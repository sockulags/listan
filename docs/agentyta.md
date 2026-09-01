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

**API:t** är ett HTTP-lager på `127.0.0.1` som appen reser när den körs, så att fönstret
uppdateras direkt när en agent skriver. När appen inte är igång går CLI:t direkt mot
kärnan i stället, och fönstret läser upp det vid nästa start.

## Distribution av plugin-paketet

Plugin-paketet läggs som en marketplace i appens datamapp under `%APPDATA%\listan`.
Du pekar din agentklient på den sökvägen en gång.

Poängen är uppdateringen: mappen skrivs om från appens egna resurser vid varje start,
så när `listan` uppdaterar sig får plugin-paketet den nya versionen utan att något
publiceras separat och utan att du gör om något.

Claude Code läser en marketplace från en lokal katalog, så där blir det den formen rakt
av. Codex har ingen marketplace i samma mening; där pekas samma katalog ut som källa för
prompts och skills. Exakt filformat pinnas när lagret byggs — det ska verifieras mot
klienterna, inte gissas här.
