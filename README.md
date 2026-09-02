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

Fönstret visar kön och är lika högt som den — töms kön krymper fönstret. Rader utan steg
är platta: klick öppnar länken, och kryssikonen till vänster tar bort raden när du är
klar. Rader med steg ligger som infällda gröna block som fälls ut. När sista steget
bockas försvinner raden, med sex sekunders ångra. I prio-fliken går rader att dra om;
övriga flikar är högar utan inbördes ordning och går därför inte att sortera.

Fältet längst ner lägger till en rad utan att gå via CLI:t. Klistrar du in en länk blir
den radens länk och resten blir texten.

En rad med en brief eller med steg som vill ha skrivna svar öppnas i eget fönster i
stället för att fällas ut i kön — kön ska gå att överblicka. Där finns briefen, stegen,
svarsfälten och en notering, och när du är klar blir fönstret kvittot med två
kopieringsknappar.

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
| `listan rm <id>`                | tar bort raden som avbruten                                                      |
| `listan requeue <id> [--tab T]` | skickar raden sist i sin flik                                                    |
| `listan result <id>`            | kvittot, `--format markdown\|json\|prompt\|answers`                              |
| `listan results [--sedan MS]`   | alla kvitton i fönstret                                                          |
| `listan wait <id> [--timeout]`  | blockerar tills raden avslutas, skriver då kvittot                               |
| `listan add ... --wait 30m`     | lägger raden och väntar på den i ett anrop                                       |

`--json` på valfritt kommando ger maskinläsbar utdata. Id:n får förkortas så länge
prefixet är unikt.

## Återlämning

En rad som lämnar kön lämnar ett kvitto: vad som gjordes, vad du svarade, din notering,
och **varför** raden försvann — gjord, avbruten, självlöst eller ersatt. Utan den sista
delen läser en agent "raden är borta" som "arbetet gick bra".

Kvitton lever utanför kön och glöms efter fjorton dagar. Kön har fortfarande ingen
historik.

Nästa agent hämtar kvittot med `listan result <id> --format prompt`, eller så klistrar du
in det själv från fönstret. En tråd som fortfarande lever kan i stället lägga raden och blockera på
den i ett anrop med `listan add ... --wait 30m`, och återupptas när du bockar av raden.
Medan den väntar visar kön vem som väntar och till när. Claude Code kör det i bakgrunden och klarar en halvtimme; Codex väntar i samma
terminalsession och bör hålla sig till tio minuter. Väntan kan stängas av i
inställningarna.

Rader som pekar på en GitHub-PR stänger sig själva när PR:en är mergad eller stängd —
som `auto-resolved`, aldrig som om du gjort arbetet. Det kräver att `gh` är inloggat och
kan stängas av i inställningarna.

Se [docs/agentyta.md](docs/agentyta.md) för formaten och avslutskoderna.

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

Data ligger i `%APPDATA%\listan\listan.db`. Sätt `LISTAN_HOME` för att köra mot en
slaskkatalog — peka inte om `APPDATA`, det flyttar även konfigurationen för andra verktyg
som läser den, bland annat `gh`.

## Release

En tagg som börjar på `v` bygger Windows-installeraren och publicerar den till
motsvarande GitHub-release, tillsammans med `latest.yml` och `.blockmap` som
electron-updater läser.

```bash
npm version patch && git push --follow-tags
```

Installeraren är osignerad, så SmartScreen varnar första gången. Winget kommer senare.

## Autouppdatering

Appen kontrollerar GitHub-releaserna 20 sekunder efter start och sedan var fjärde timme.
Hittas en nyare version hämtas den i bakgrunden och installeras nästa gång du avslutar
appen; en rad längst ner erbjuder omstart direkt om du hellre vill det. Installationen
sker per användare och kräver ingen behörighetsdialog.

Eftersom installeraren är osignerad finns ingen Authenticode-identitet att verifiera mot,
så den kontrollen är avstängd i `src/main/updater.ts`. Nedladdningen skyddas i stället av
att `latest.yml` hämtas över HTTPS och att installerarens sha512 kontrolleras därifrån
innan något körs. När installerarna en dag signeras av ett CA-betrott certifikat kan
undantaget tas bort rakt av.

## Läge

v0.8.0. Kärnan, CLI:t, fönstret, detaljfönstret, overlayn, kvittona, GitHub-resolvern,
autouppdateringen och plugin-utskrivningen finns. Ingen leveransadapter skickar kvitton
vidare än; tillåtlistan för webhook-mål finns på plats i väntan på det. Se
[docs/design.md](docs/design.md) för designbriefen.

Appikonen genereras ur paletten i stället för att ligga som binär i repot:
`npm run icon` skriver om `build/icon.ico`.

## Licens

MIT © Lucas Skog
