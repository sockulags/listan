# listan — designbrief

## Känsla

Lugn, varm, skandinavisk — samma språk som referat. Appen är en avlämningsplats,
inte ett projektverktyg: den ska kännas som en prydlig anteckningsbok du tömmer,
aldrig som en ärendekö som kräver något av dig. Ledord: **ren, varm, tyst självsäker**.
Inga onödiga ramar och skuggor — en ram _eller_ en skugga, aldrig båda.

## Vad listan är

En rad är en länk plus noll till några manuella steg. Rader är temporära: de skapas
av en agent eller av dig, töms, och tas bort. Det finns ingen historik och ingen
klar-vy att gå till.

## Färg

- **Bas**: varm off-white (`#FAF9F7`) ljust läge, djup varmgrå (`#1A1917`) mörkt läge.
- **Accent**: djup skogsgrön (`#2D6A4F`-familjen). Används sparsamt: aktiv flik,
  aktiv rad, bockade steg.
- Paletten är kopierad från referat, inte importerad. Två appar som delar palett ska
  inte dela byggkedja.

## Typografi

- UI: Inter med `system-ui` som fallback. Inga CDN-anrop.
- Siffror i räknare och id får `tabular-nums`. Ingen monospace någonstans — det är en
  lugn app, inte ett utvecklarverktyg.

## Komponentspråk

- Rundade hörn (8–12 px), generös whitespace.
- **Raden är platt, inte ett kort.** De flesta rader är bara en länk och ska inte se ut
  som något att hantera. Klick på raden öppnar länken.
- **Bara rader med steg får en chevron** och en räknare. Då syns direkt vilken rad som
  kräver händer.
- **Den aktiva raden är hel mjukgrön yta** utan accentstreck i kanten. Stegen ligger på
  samma yta så att raden läses som ett stycke.
- **Flikarna är piller**, inte mappflikar. Bara prio-fliken är en ordnad kö; övriga är
  högar utan inbördes ordning.
- **Agentkörningen är ett chip** med ikon och ord, aldrig bara ett grått id.
- Micro-interactions: 150–200 ms, mjuka. Inget som blinkar eller studsar.
- När sista steget bockas försvinner raden med kort ångra. Ingen bekräftelsedialog.

## Overlay

Alltid överst, pinnbar, en rad i taget: radens titel, nästa obockade steg, och en grå
rad med vad som ligger bakom. Den växer inte när kön växer — överflödet blir `+2`.
`Ctrl+Shift+K` fäller upp och ner den. Den tar aldrig fokus, för den ska kunna komma
fram mitt i något annat utan att avbryta det.

## Ikon

Skogsgrön rundad kvadrat med en gräddvit bock, genererad ur paletten av
`scripts/make-icon.mjs`. Bocken är det enda som ryms vid 16 px; allt mer detaljerat blir
grumligt i aktivitetsfältet.

## Vad som medvetet inte finns

Inga deadlines, ingen tilldelning, ingen status, ingen historik, ingen sync, inga
notiser som tjatar. Prioritet är radens position, inget fält.
