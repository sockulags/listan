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

## Läsa

`listan next` ger aktiv rad plus nästa obockade steg — det är nästan alltid det du vill
veta, inte hela listan. `listan list` skriver ut kön. Lägg till `--json` när du ska
tolka svaret.

## Regler

Samma länk två gånger uppdaterar den befintliga raden i stället för att lägga en till,
så det är ofarligt att köra om.

Bocka inte av steg åt Lucas med `listan check` om han inte bett om det — raderna finns
till för att han ska göra dem för hand. Ta inte bort rader du inte har lagt in själv.
