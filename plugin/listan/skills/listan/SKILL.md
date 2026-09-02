---
name: listan
description: Lämna manuella steg åt Lucas i listan — det han måste göra själv när en körning är klar, till exempel granska en PR eller verifiera något för hand. Använd när arbetet är färdigt men något återstår som bara en människa kan göra, eller när han ber dig lägga in punkter från ett möte.
---

# listan

`listan` är kön för de manuella steg du lämnar efter dig. Den ligger lokalt på samma
maskin. Skriv till den med CLI:t `listan`.

## När du ska skriva till den

När din körning är klar och något återstår som bara Lucas kan göra: granska och merga
en PR, verifiera ett flöde för hand, svara någon, fatta ett beslut. Lämna det i listan
i stället för att bara skriva det i din sista rapport, som försvinner när sessionen gör
det.

Lägg inte in det du redan gjort, och inte det du kan göra själv.

## Lägga in en rad

Ett anrop per rad. En rad är en länk plus noll till några manuella steg:

```bash
listan add "Granska PR 34 — design-pilot" --link https://github.com/sockulags/design-pilot/pull/34 --källa "#34"
```

Behöver raden flera handgrepp lägger du dem som steg i den ordning de ska göras:

```bash
listan add "Verifiera auth-flödet" \
  --link https://github.com/sockulags/smask/pull/57 \
  --step "kör smoke-testet lokalt" \
  --step "kolla att session inte läcker" \
  --step "merga"
```

Lämnar du flera rader från samma körning, märk dem med samma `--batch` så hänger de
ihop i gränssnittet:

```bash
listan add "Granska PR 12 — clomp" --link https://github.com/sockulags/clomp/pull/12 --batch 4f2a
```

Flera rader utan egna steg går att skicka radvis på stdin:

```bash
printf 'Boka om onsdagsavstämningen\nSvara Kalle om NIS2\n' | listan add --källa referat
```

## Be om ett svar tillbaka

`--step` är ett steg som bara ska bockas av. `--fråga` är ett steg som vill ha något
skrivet tillbaka — då får Lucas ett textfält att fylla i:

```bash
listan add "Verifiera auth-flödet" \
  --link https://github.com/sockulags/smask/pull/57 \
  --kontext "smask, branch fix/auth, jag väntar på beskedet innan jag mergar" \
  --step "kör smoke-testet lokalt" \
  --fråga "vad hände vid utloggning?"
```

Använd `--fråga` sparsamt. Ett steg som du kan verifiera själv ska inte vara en fråga.

`--kontext` är vad nästa agent behöver veta om du inte finns kvar när svaret kommer. Var
konkret: repo och arbetskatalog, branch eller worktree, relevant commit, och vad du tänkt
ska hända härnäst. Det är den enda kontext en ny tråd får.

`--brief` tar markdown som visas när raden öppnas i eget fönster — använd det när
uppgiften behöver mer förklaring än en rad.

## Hämta resultatet

En rad som avslutas lämnar ett kvitto. Hämta det med `listan result <id>`, och läs
avslutskoden: `completed` betyder att arbetet gjordes, `cancelled` att raden togs bort
utan att göras, `auto-resolved` att den löste sig själv, `superseded` att den ersattes.
**Att raden är borta betyder inte att arbetet gick bra.**

## Vänta eller inte — bestäm uttryckligen

Vänta **bara** när svaret behövs för att du ska kunna fortsätta den körning du är i. Då
lägger du raden och väntar i ett anrop:

```bash
listan add "Välj färg" \
  --fråga "Vilken färg ska vi använda?" \
  --kontext "svaret behövs för nästa implementation" \
  --väntare Codex \
  --wait 30m \
  --json
```

Ett anrop, ingen lucka mellan att raden skapas och att någon väntar på den. Är svaret
redan inne kommer det tillbaka omedelbart. `--väntare` är namnet Lucas ser i kön.

Kan svaret hanteras senare: skapa raden utan väntan, skriv tillräcklig `--kontext`, och
avsluta körningen. Kvittot finns kvar i fjorton dagar och hämtas med `listan result`.

**Polla aldrig.** Starta aldrig fler än en väntare för samma rad.

**I Claude Code:** kör kommandot i bakgrunden. Sessionen väcks när processen avslutas.

**I Codex:** kör det i en sammanhängande terminalsession och håll dig till `--wait 10m`.
Får du tillbaka ett levande `session_id` fortsätter du vänta på **samma** session tills
processen avslutas. Starta aldrig en frikopplad bakgrundsprocess — då finns ingen väg
tillbaka för resultatet. Fyra timmar är tillåtet men meningslöst utan en riktig
trådväckning.

### När väntan tar slut utan kvitto

**Kod 2, tiden gick ut.** Det är inte ett misslyckat manuellt arbete — raden ligger kvar
öppen och Lucas gör den när han hinner. Kör inte `rm`, `requeue` eller upprepade `result`.
Rapportera rad-id och avsluta tråden:

> Väntan avslutades utan kvitto. Raden `<id>` är fortfarande öppen och har inte tagits
> bort eller lagts om. När den avslutas kan resultatet lämnas till en ny tråd med
> `listan result <id> --format prompt`.

**Kod 3, väntan är avstängd.** Samma sak, men avsluta direkt. Försök inte kringgå
inställningen genom att polla.

Lova aldrig att något "skickas tillbaka" av sig självt. Det finns ingen automatisk
trådväckning — antingen väntar du kvar, eller så hämtas kvittot i efterhand.

## Läsa

`listan next` ger aktiv rad plus nästa obockade steg — det är nästan alltid det du vill
veta, inte hela listan. `listan list` skriver ut kön. Lägg till `--json` när du ska
tolka svaret.

## Regler

Samma länk två gånger uppdaterar den befintliga raden i stället för att lägga en till,
så det är ofarligt att köra om.

Bocka inte av steg åt Lucas med `listan check` om han inte bett om det — raderna finns
till för att han ska göra dem för hand. Ta inte bort rader du inte har lagt in själv.
