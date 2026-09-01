# listan

Kön för de manuella stegen dina agenter lämnar efter sig.

Fem agenttrådar landar. Fyra öppnar en PR och lämnar en länk. Den femte lämnar en PR
plus tre saker du måste verifiera själv. `listan` är platsen de lämnar dem på, och den
enda plats du behöver titta på när du kommer tillbaka från ett möte.

Det är inte ärendehantering. En rad är en länk plus noll till några manuella steg, den
töms och den försvinner. Ingen historik, inga deadlines, ingen status.

## Läge

Tidig scaffold. Fönstret ritar gränssnittet mot platshållardata; datalagret, CLI:t och
overlayn är på väg. Se [docs/design.md](docs/design.md) för designbriefen.

## Utveckling

```bash
npm install
npm run dev
```

`npm run build` typkollar och bygger, `npm test` kör enhetstesterna, `npm run lint`
lintar. CI kör alla tre på varje PR.

## Release

En tagg som börjar på `v` bygger Windows-installeraren och publicerar den direkt till
motsvarande GitHub-release, tillsammans med `latest.yml` och `.blockmap` som
electron-updater läser.

```bash
npm version patch && git push --follow-tags
```

Installeraren är osignerad, så SmartScreen varnar första gången. Winget kommer senare.

## Agentytan

Agenter skriver till `listan` genom ett CLI och ett lokalt API — allt kör på samma
burk, så det behövs ingen MCP-server över nätet.

Plugin-paketet distribueras som en marketplace i appens datamapp under `%APPDATA%`.
Du pekar din agentklient på den sökvägen en gång; när `listan` uppdaterar sig skrivs
marketplacen om, och Claude Code respektive Codex plockar upp den nya versionen utan
att något behöver publiceras separat.

## Licens

MIT © Lucas Skog
