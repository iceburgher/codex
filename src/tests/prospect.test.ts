import { describe, expect, it } from "vitest";
import {
  countExtracted,
  htmlToText,
  parseProspectText,
  parseSwedishNumber,
} from "@/lib/prospect";

describe("parseSwedishNumber", () => {
  it("tolkar mellanslag och hårt mellanslag som tusentalsavgränsare", () => {
    expect(parseSwedishNumber("3 600 000")).toBe(3_600_000);
    expect(parseSwedishNumber("3 600 000")).toBe(3_600_000);
    expect(parseSwedishNumber("3.600.000")).toBe(3_600_000);
  });

  it("tolkar decimalkomma", () => {
    expect(parseSwedishNumber("120,5")).toBe(120.5);
  });

  it("ger null för text som inte är ett tal", () => {
    expect(parseSwedishNumber("cirka")).toBeNull();
  });
});

describe("parseProspectText", () => {
  const prospekt = `
    Klockaregatan 4, Torekov
    Utgångspris 3 600 000 kr
    Boarea 142 m²
    Biarea 38 m²
    Tomtarea 1 245 m²
    Byggår 1968
    Driftkostnad 28 400 kr/år
    Taxeringsvärde 2 100 000 kr
    Fastighetsbeteckning Båstad Torekov 5:12
    Kommun Båstad
  `;

  it("läser ut priset", () => {
    const r = parseProspectText(prospekt);
    expect(r.purchasePrice?.value).toBe(3_600_000);
    expect(r.purchasePrice?.evidence).toContain("3 600 000");
  });

  it("skiljer boarea från biarea och tomtarea", () => {
    const r = parseProspectText(prospekt);
    expect(r.livingAreaSqm?.value).toBe(142);
    expect(r.ancillaryAreaSqm?.value).toBe(38);
    expect(r.plotAreaSqm?.value).toBe(1245);
  });

  it("läser ut byggår, driftkostnad och taxeringsvärde", () => {
    const r = parseProspectText(prospekt);
    expect(r.constructionYear?.value).toBe(1968);
    expect(r.operatingCostAnnual?.value).toBe(28_400);
    expect(r.taxAssessmentValue?.value).toBe(2_100_000);
  });

  it("behåller ordet kommun när namnet skrivs i den formen", () => {
    const r = parseProspectText("Villa i Båstads kommun, Skåne.");
    expect(r.municipality?.value).toBe("Båstads kommun");
  });

  it("läser ut adress, kommun och fastighetsbeteckning", () => {
    const r = parseProspectText(prospekt);
    expect(r.address?.value).toBe("Klockaregatan 4");
    expect(r.municipality?.value).toBe("Båstad");
    expect(r.propertyDesignation?.value).toBe("Båstad Torekov 5:12");
  });

  it("lämnar fält tomma i stället för att gissa", () => {
    const r = parseProspectText("En trevlig villa med sjöutsikt.");
    expect(r.purchasePrice).toBeUndefined();
    expect(r.livingAreaSqm).toBeUndefined();
    expect(countExtracted(r)).toBe(0);
  });

  it("tar inte ett årtal i löptext för ett byggår", () => {
    const r = parseProspectText("Huset renoverades senast 2019 och är välskött.");
    expect(r.constructionYear).toBeUndefined();
  });

  it("tar inte ett litet belopp för ett utgångspris", () => {
    const r = parseProspectText("Utgångspris 900 kr");
    expect(r.purchasePrice).toBeUndefined();
  });

  it("klarar text där etiketten står före värdet med kolon", () => {
    const r = parseProspectText("Boarea: 98 kvm\nUtgångspris: 2 950 000 kr");
    expect(r.livingAreaSqm?.value).toBe(98);
    expect(r.purchasePrice?.value).toBe(2_950_000);
  });
});

/**
 * Utdrag ur en skarp mäklarsida, med etiketterna i den ordning och form de
 * faktiskt står. Poängen är att fånga just de fall som tidigare missades:
 * pantbrev, fastighetsavgift och driftposter under en egen rubrik.
 */
const MAKLARSIDA = `
Kort fakta
Typ Friliggande villa
Upplåtelseform Friköpt
Fast.beteckning Cyklonen 1
Adress Klockaregatan 4
Postadress 269 78 Torekov
Område Torekov
Kommun Båstad
Bo & biarea 154 + 32 m² (taxeringsinformation)
Tomtarea 897 m²
Pris 4 495 000 kr
Byggnadsinformation
Byggnadsår 1984
Uppvärmning Elpanna
Vatten/avlopp Kommunalt vatten året om. Kommunalt avlopp
Driftskostnader per år
Uppvärmning 8 486 kr
Vatten/avlopp 11 910 kr
Renhållning 2 380 kr
Antal personer i hushållet 1 st
Summa 22 776 kr
Fastighetsavgift på 10 425 kr/år tillkommer
Taxeringsinformation
Taxeringsvärde 3 948 000 kr
Taxeringsår 2024
Byggnadsvärde 2 533 000 kr
Markvärde 1 415 000 kr
Pantbrev
Totalt 5 st pantbrev om 897 200 kr.
`;

describe("mäklarsida", () => {
  const r = parseProspectText(MAKLARSIDA);

  it("läser ut pantbrevens belopp, inte antalet", () => {
    expect(r.existingMortgageDeeds?.value).toBe(897_200);
  });

  it("läser ut fastighetsavgiften", () => {
    expect(r.propertyFeeAnnual?.value).toBe(10_425);
  });

  it("läser driftposterna var för sig", () => {
    expect(r.heatingAnnual?.value).toBe(8_486);
    expect(r.waterSewerAnnual?.value).toBe(11_910);
    expect(r.wasteAnnual?.value).toBe(2_380);
  });

  it("tar inte byggnadsinformationens uppvärmning för en kostnad", () => {
    // "Uppvärmning Elpanna" står före driftavsnittet och är ingen siffra.
    expect(r.heatingAnnual?.evidence).toContain("8 486");
  });

  it("utelämnar summan när posterna finns, så driften inte dubbelräknas", () => {
    expect(r.operatingCostAnnual).toBeUndefined();
  });

  it("tar summan när posterna saknas", () => {
    const only = parseProspectText("Driftskostnad 22 776 kr/år");
    expect(only.operatingCostAnnual?.value).toBe(22_776);
  });

  it("läser fastighetsbeteckningen utan att svälja nästa etikett", () => {
    expect(r.propertyDesignation?.value).toBe("Cyklonen 1");
  });

  it("delar upp Bo & biarea", () => {
    const combined = parseProspectText("Bo & biarea 154 + 32 m² (taxeringsinformation)");
    expect(combined.livingAreaSqm?.value).toBe(154);
    expect(combined.ancillaryAreaSqm?.value).toBe(32);
  });

  it("läser pris, tomtarea, byggår, taxeringsvärde och kommun", () => {
    expect(r.purchasePrice?.value).toBe(4_495_000);
    expect(r.plotAreaSqm?.value).toBe(897);
    expect(r.constructionYear?.value).toBe(1984);
    expect(r.taxAssessmentValue?.value).toBe(3_948_000);
    expect(r.municipality?.value).toBe("Båstad");
  });
});

describe("htmlToText", () => {
  it("plockar bort taggar och avkodar entiteter", () => {
    const text = htmlToText("<p>Utgångspris 3&nbsp;600&nbsp;000 kr</p><script>var x=1;</script>");
    expect(text).toContain("Utgångspris 3 600 000 kr");
    expect(text).not.toContain("var x");
  });

  it("tar med JSON-LD där annonssidor ofta lägger fakta", () => {
    const html = `<html><body><h1>Villa</h1>
      <script type="application/ld+json">{"name":"Boarea 142 m²"}</script>
      </body></html>`;
    expect(htmlToText(html)).toContain("Boarea 142 m²");
  });

  it("avkodar namngivna entiteter som m&sup2;", () => {
    const r = parseProspectText(htmlToText("<p>Tomtarea 897 m&sup2;</p>"));
    expect(r.plotAreaSqm?.value).toBe(897);
  });

  it("hittar priset i JSON-LD när sidan renderas i webbläsaren", () => {
    const html = `<script type="application/ld+json">{"offers":{"price":4495000}}</script>`;
    expect(parseProspectText(htmlToText(html)).purchasePrice?.value).toBe(4_495_000);
  });

  it("gör att fakta i JSON-LD går att läsa ut", () => {
    const html = `<script type="application/ld+json">
      {"offers":{"price":"3600000"},"description":"Boarea 142 m² Byggår 1968"}
    </script>`;
    const r = parseProspectText(htmlToText(html));
    expect(r.livingAreaSqm?.value).toBe(142);
    expect(r.constructionYear?.value).toBe(1968);
  });
});
