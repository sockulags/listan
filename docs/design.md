# listan — designbrief

## Känsla

Lugn, varm, skandinavisk — samma språk som referat. Appen är en avlämningsplats,
inte ett projektverktyg: den ska kännas som en prydlig anteckningsbok du tömmer,
aldrig som en ärendekö som kräver något av dig. Ledord: **ren, varm, tyst självsäker**.
Inga onödiga ramar och skuggor — en ram _eller_ en skugga, aldrig båda.

## Vad listan är

En rad är en länk plus noll till några manuella steg. Rader är temporära: de skapas
av en agent eller av dig, töms, och tas bort. Kön för ingen historik — den vet bara vad
som är kvar att göra.

Det som lämnar kön lämnar ett kvitto, och kvittona går att se i Klar-fliken tills de
glöms efter fjorton dagar. Skillnaden är inte hårfin: kön är alltid bara det som
återstår, medan kvittona är ett leveransminne med en egen bortre gräns.

## Färg

- **Bas**: varm off-white (`#FAF9F7`) ljust läge, djup varmgrå (`#1A1917`) mörkt läge.
  Båda lägena följer systemtemat, inklusive färgen på fönsterknapparna.
- **Accent**: djup skogsgrön (`#2D6A4F`-familjen). Används sparsamt: aktiv flik,
  aktiv rad, bockade steg.
- Paletten är kopierad från referat, inte importerad. Två appar som delar palett ska
  inte dela byggkedja.

## Typografi

- UI: Inter med `system-ui` som fallback. Inga CDN-anrop.
- Siffror i räknare och id får `tabular-nums`. Ingen monospace någonstans — det är en
  lugn app, inte ett utvecklarverktyg.

## Fönstret

Ingen grå OS-list ovanpå paletten: titelraden är dold och Windows ritar sina egna
fönsterknappar över appens egen färg. Wordmarken och tangentgenvägen bor i det fältet,
som också är dragytan.

**Fönstret är lika högt som kön.** Höjden följer innehållet mellan 260 och 760 px, så
att tömma listan krymper fönstret. En fast höjd lämnade flera hundra pixlar död yta
under två rader, och det läste som att något saknades.

Längst ner ligger ett enradsfält att lägga till i. Det förankrar layouten och gör appen
användbar utan CLI:t. Klistrar du in en länk blir den radens länk och resten blir texten.

## Tre ytor, tre uppgifter

Overlayn är till för att glutta, kön för att tömma, detaljfönstret för att göra. Så länge
de hålls isär blir ingen av dem rörig.

En rad hamnar i detaljfönstret när den har en brief från agenten eller steg som vill ha
skrivna svar. Har den bara textsteg är utfällningen i kön fortfarande snabbast — tvinga
inte fram ett fönster för tre kryssrutor.

Briefen renderas som markdown, aldrig som HTML. Agentskriven HTML i ett fönster med
preload-åtkomst är ett hål mot IPC, så renderaren bygger React-element och tolkar aldrig
markup.

## Komponentspråk

- Rundade hörn (8–12 px), generös whitespace.
- **Raden är platt, inte ett kort.** De flesta rader är bara en länk och ska inte se ut
  som något att hantera. Klick på raden öppnar länken.
- **Bara rader med steg får en chevron** och en räknare. Då syns direkt vilken rad som
  kräver händer.
- **Raden med steg är ett infällt mjukgrönt block** med 8 px marginal i sidled och 10 px
  radie, utan accentstreck i kanten. Stegen ligger på samma yta så att raden läses som
  ett stycke som lyfts ur listan, inte som en markerad tabellrad.
- **Kryssrutor är egna**, inte systemets. Systemets har en tyngre grå ram än allt annat
  på ytan och är det enda odesignade elementet om man låter dem vara.
- **Länkikonen tonar in vid hover.** En kolumn av identiska ikoner nedför listan är brus;
  raden är ändå klickbar.
- **Bara numerisk meta får `tabular-nums`.** `#34` och `1/3` ska ligga i kolumn, en
  etikett som `release-agent` ska inte glesas ut.
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

## Klar-fliken

Sist bland flikarna, avskild från de andra, ligger en vy över kvittona. Den är inte en
kö och ska inte läsas som en: inga kryssrutor, ingen ordning att pilla på, inget att
lägga till. Rader visas med klockslag, utfall och dina svar, grupperade per dag när
perioden är längre än idag.

Utfallet skrivs ut för allt utom `completed`. Att blanda ihop det du gjorde med det som
löste sig självt vore att svara fel på frågan fliken finns för.

Detta bryter inte mot att kön saknar historik. Kvittona fanns redan och glöms efter
fjorton dagar; det enda som ändrats är att de går att se.

## Vad som medvetet inte finns

Inga deadlines, ingen tilldelning, ingen status, ingen historik, ingen sync, inga
notiser som tjatar. Prioritet är radens position, inget fält.
