# Fastighetskalkylen

En kalkylator för svenska fastighetsprojekt. Den jämför hela ekonomin efter
skatt för att köpa, renovera, eventuellt hyra ut, äga och sälja ett objekt
under tre ägarformer:

- **Privat, egna pengar**
- **Privat, med bolån**
- **Bolaget äger**

Poängen är inte att jämföra nominella skattesatser. Modellen räknar hela
kapitalflödet: lagfart och pantbrev, renovering, moms, ROT, räntor, vad det
kostar att få ut pengar ur bolaget för att finansiera ett privat köp,
driftkostnader, skatt på uthyrning, förmånsbeskattning vid privat användning,
försäljningskostnader, kapitalvinst- eller bolagsskatt, det andra skattelagret
när bolagets vinst ska till ägarna, alternativkostnaden för bundet kapital —
och till slut hur familjens förmögenhet faktiskt förändras.

## Huvudfrågan

Vyn för ett objekt börjar med jämförelsen: **privat ägande mot bolagsägande**,
med skillnaden i kronor emellan. Privat köp finansieras med egna pengar — som
ytterst tas ur bolaget som lön eller utdelning — plus bolån. Bolagsköp
finansieras med bolagets kassa plus företagslån. Inom varje sida vinner den
finansiering som ger mest kvar efter skatt, och varianterna visas under.

## Läs in objektet

Ett projekt kan fyllas i från ett prospekt (PDF) eller en länk till annonsen.
Servern läser texten och plockar ut adress, kommun, fastighetsbeteckning,
utgångspris, areor, byggår, driftkostnad och taxeringsvärde. Allt som hittas
visas för granskning tillsammans med textutdraget det kom ifrån — inget skrivs
in förrän du bockar av det. Hittas ingenting sägs det rakt ut i stället för att
fältet fylls med en gissning.

## Kom igång

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tester för beräkningar och lagring
npm run build
```

Appen fungerar utan konfiguration — då sparas projekten bara i webbläsaren.

### Spara i molnet (Supabase)

Sätt två miljövariabler, i Vercel under Project Settings → Environment
Variables, eller lokalt i `.env.local` (se `.env.example`):

```
SUPABASE_URL=https://ditt-projekt.supabase.co
SUPABASE_SECRET_KEY=...
```

Kör `supabase/schema.sql` en gång i Supabase SQL Editor för att skapa
tabellen.

Nyckeln är hemlig och läses enbart på servern — den får aldrig hamna i en
`NEXT_PUBLIC_`-variabel eller i koden. All åtkomst går via `/api/projects`, och
tabellen har radnivåsäkerhet påslagen utan någon policy, så en läckt publik
nyckel ger ingen åtkomst.

Webbläsarlagringen är kvar som lokal kopia: gränssnittet svarar direkt och
appen fungerar utan nät. Vid start hämtas molnets bild, och varje ändring
skickas upp. Projektlistan visar vilket läge som gäller.

## Struktur

```
src/
  calculations/   rena beräkningar — ingen React, ingen I/O
    engine.ts     samma pipeline för alla tre ägarformer
  config/         gemensamma skattesatser, versionerade per skatteår
  components/     endast gränssnitt; inga formler bor här
  lib/            lagring, validering, migreringar, formatering
  data/           exempelprojekt
  tests/          Vitest
```

Beräkningarna är rena funktioner och varje viktigt tal har en spårbar
uträkning som visas via "Visa uträkning" i gränssnittet.

## Vad appen medvetet vägrar anta

Kravspecen listar de antaganden som oftast gör en fastighetskalkyl fel. De är
inbyggda som vägran, inte som bekväma standardvärden:

- 22 % kapitalvinstskatt används **bara** när användaren uttryckligen klassat
  fastigheten som privatbostad. Andra klassificeringar använder en angiven
  skattesats och flaggas.
- Renoveringen antas **inte** vara avdragsgill mot kapitalvinsten. Andelen är
  noll som utgångspunkt och ska komma från rådgivare. Det ROT betalar räknas
  aldrig med.
- Moms på bostadsrenovering är **0 % avdragsgill** som utgångspunkt. Att dra av
  den ger en röd flagga.
- Bolagets vinst antas **inte** kunna delas ut till låg skatt. Överstiger
  vinsten gränsbeloppet utan att skattesatsen däröver är ifylld visar appen
  "Kräver skattesats" i stället för att låta uttaget se gratis ut — och det
  alternativet kan då inte utses till bäst på privat utfall.
- Förmånsvärdet för ett bolagsägt hus som ägarna kan använda räknas aldrig
  fram automatiskt.
- Skatten på lön är en uppskattning, och appen säger det.
- Amortering flyttar pengar och minskar skulden men är aldrig en kostnad för
  projektet.
- Pengar kvar i bolaget är inte samma sak som pengar privat. Förmögenheten
  redovisas i två lägen: kvar i bolaget (A) och allt uttaget (B).
- Uppgifter som saknas förblir tomma. Inget skattekänsligt fylls i med en
  gissning, varken vid inmatning eller import.

## Skatteuppgifter

Alla satser ligger i `src/config/taxConfig.ts`, versionerade per skatteår och
redigerbara i appen. Ett projekt kan låsa sitt skatteår så att senare
ändringar av de gemensamma värdena inte rör historiska antaganden. Ändringar
per projekt lagras separat.

Uppgifter som måste fyllas i eller bekräftas av rådgivare — arbetsgivaravgift,
marginalskatt, gränsbelopp enligt 3:12, skattesatsen däröver, momsavdrag,
förmånsvärde, klassificering av fastigheten och i bolaget, begränsningar i
ränteavdrag och vilka förbättringar som är avdragsgilla — är märkta som
sådana i gränssnittet.

## Projekt

Projektlistan är startsidan: skapa, öppna, kopiera, byta namn, arkivera,
återställa, ta bort, importera och exportera. Projekt exporteras som
versionerad JSON och kan läsas in igen utan att något tappas bort. Import
valideras och ger en rapport i stället för att tyst misslyckas, och ett id som
krockar får ett nytt. Jämförelsevyn har två lägen som alltid är tydligt
märkta: flera objekt under samma ägarform, eller ett objekt under olika
ägarformer.

Ett exempelprojekt skapas vid första starten. Det är användardata, inte en del
av motorn, och tas det bort kommer det inte tillbaka.

## Ansvarsfriskrivning

Det här är beslutsstöd, inte skatterådgivning. Utfallet beror på syfte,
användning och omständigheter. Stäm av de flaggade antagandena med en
skatterådgivare innan du förlitar dig på siffrorna.
