# listan

Kön för de manuella stegen dina agenter lämnar efter sig.

Fem agenttrådar landar. Fyra öppnar en PR och lämnar en länk. Den femte lämnar en PR
plus tre saker du måste verifiera själv. `listan` är platsen de lämnar dem på, och den
enda plats du behöver titta på när du kommer tillbaka från ett möte.

Det är inte ärendehantering. En rad är en länk plus noll till några manuella steg, den
töms och den försvinner. Ingen historik, inga deadlines, ingen status.

## Så funkar det

Agenter skriver till kön med CLI:t. Ett anrop räcker för en hel rad:

```bash
listan add "Verifiera auth-flödet" --link https://github.com/sockulags/smask/pull/57 --step "kör smoke-testet lokalt" --step "kolla att session inte läcker" --step "merga"
```

Fönstret visar kön. Rader utan steg är platta — klick öppnar länken, och kryssikonen
till vänster tar bort raden när du är klar. Rader med steg fälls ut. När sista steget
bockas försvinner raden, med sex sekunders ångra. I prio-fliken går rader att dra om;
övriga flikar är högar utan inbördes ordning och går därför inte att sortera.

`Ctrl+Shift+K` fäller upp den pinnade overlayn var du än är. Den ligger överst, tar inte
fokus, och visar en rad i taget: aktiv rad, nästa obockade steg, och en grå rad med vad
som ligger bakom. Den växer inte när kön växer.

Samma länk två gånger uppdaterar den befintliga raden i stället för att lägga en till,
så en agent som kör om sig själv inte lämnar dubbletter.

### Kommandon

|                                 |                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `listan add <text>`             | `--tab`, `--link`, `--fil`, `--kommando`, `--step` (flera), `--källa`, `--batch` |
| `listan add`                    | läser en rad per rad från stdin                                                  |
| `listan list [--tab T]`         | hela kön eller en flik                                                           |
| `listan next`                   | aktiv rad plus nästa obockade steg                                               |
| `listan check [id]`             | bockar nästa steg, utan id på aktiva raden                                       |
| `listan rm <id>`                |                                                                                  |
| `listan requeue <id> [--tab T]` | skickar raden sist i sin flik                                                    |

`--json` på valfritt kommando ger maskinläsbar utdata. Id:n får förkortas så länge
prefixet är unikt.

## Plugin

Appen skriver en plugin-marketplace till `%APPDATA%\listan\plugin` vid varje start, och
en CLI-shim till `%APPDATA%\listan\bin`. Lägg `bin`-mappen i din PATH och peka din
agentklient på `plugin`-mappen en gång — när `listan` uppdaterar sig skrivs båda om, så
plugin-versionen följer appversionen utan att något publiceras separat.

Se [docs/agentyta.md](docs/agentyta.md) för hur lagren hänger ihop och vad som återstår
att verifiera mot klienterna.

## Utveckling

```bash
npm install
npm run dev
```

`npm run build` typkollar och bygger både appen och CLI:t, `npm test` kör
enhetstesterna, `npm run lint` lintar. CI kör alla tre på varje PR.

Data ligger i `%APPDATA%\listan\listan.db` och kan pekas om genom att sätta `APPDATA`,
vilket är hur CLI:t testas mot en slaskkatalog.

## Release

En tagg som börjar på `v` bygger Windows-installeraren och publicerar den till
motsvarande GitHub-release, tillsammans med `latest.yml` och `.blockmap` som
electron-updater läser.

```bash
npm version patch && git push --follow-tags
```

Installeraren är osignerad, så SmartScreen varnar första gången. Winget kommer senare.

## Läge

v0.2.0. Kärnan, CLI:t, fönstret, overlayn och plugin-utskrivningen finns. Se
[docs/design.md](docs/design.md) för designbriefen.

Appikonen genereras ur paletten i stället för att ligga som binär i repot:
`npm run icon` skriver om `build/icon.ico`.

## Licens

MIT © Lucas Skog
