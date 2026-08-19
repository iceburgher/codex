import type { ImprovementBasisResult, ImprovementTaxBasisInputs } from "@/types";

/**
 * Delar upp renoveringen i det som får dras av mot den privata kapitalvinsten
 * och det som inte får det. Används bara för privata scenarier — äger bolaget
 * huset dras hela renoveringskostnaden redan av mot bolagets resultat vid
 * försäljningen (se companyTaxBasis i engine.ts), så den här uppdelningen
 * gäller inte där.
 *
 * Två avdragsgilla kategorier, med olika regler (IL 45:11-12):
 *
 * 1. Grundförbättringar — ny-, till- och ombyggnad. Läggs till omkostnads-
 *    beloppet utan tidsgräns.
 * 2. Förbättrande reparationer och underhåll — får bara räknas för
 *    försäljningsåret och de fem föregående åren, och bara i den mån huset är
 *    i bättre skick vid försäljningen än vid köpet. I ett renovera-och-sälj-
 *    projekt är den här posten ofta större än grundförbättringarna, så att
 *    utelämna den överskattar kapitalvinstskatten rejält.
 *
 * ROT-finansierade belopp räknas aldrig med i någondera kategorin — man får
 * inte både skattereduktion och avdrag för samma krona.
 */
export function calculateImprovementBasis(params: {
  renovationTotalGross: number;
  rotDeduction: number;
  split: ImprovementTaxBasisInputs;
}): ImprovementBasisResult {
  const { renovationTotalGross, rotDeduction, split } = params;

  const basisEligibleSpend = Math.max(0, renovationTotalGross - rotDeduction);

  const fundamentalPercent = split.fundamentalImprovementsPercent || 0;
  const repairsPercent = split.qualifyingRepairsAndMaintenancePercent || 0;
  const nonDeductiblePercent = split.nonDeductiblePercent || 0;

  const fundamentalImprovements = basisEligibleSpend * fundamentalPercent;
  const qualifyingRepairs = basisEligibleSpend * repairsPercent;

  const eligibleTaxBasis = fundamentalImprovements + qualifyingRepairs;
  const nonEligibleRenovation = renovationTotalGross - eligibleTaxBasis;

  /*
   * Andelarna ska tillsammans täcka hela renoveringen. Summerar de till mindre
   * än 1 försvinner en del av kostnaden tyst ur kalkylen, och till mer än 1
   * räknas den dubbelt — båda är fel som är lätta att missa i ett procentfält.
   */
  const shareSum = fundamentalPercent + repairsPercent + nonDeductiblePercent;
  const splitWarning =
    Math.abs(shareSum - 1) > 0.005
      ? `Fördelningen av renoveringen summerar till ${(shareSum * 100).toFixed(0)} % i stället för 100 %. Justera grundförbättringar, förbättrande reparationer och ej avdragsgillt så de går ihop.`
      : undefined;

  return {
    renovationTotal: renovationTotalGross,
    fundamentalImprovements,
    qualifyingRepairs,
    eligibleTaxBasis,
    nonEligibleRenovation,
    splitWarning,
    audit: [
      {
        title: "Renovering mot kapitalvinst (privat)",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Renovering totalt", value: renovationTotalGross },
          { label: "ROT-finansierat (räknas inte)", value: -rotDeduction },
          { label: "Kvar att klassificera", value: basisEligibleSpend },
          {
            label: `Grundförbättringar, ingen tidsgräns (${(fundamentalPercent * 100).toFixed(0)} %)`,
            value: fundamentalImprovements,
          },
          {
            label: `Förbättrande reparationer, max 5 år tillbaka (${(repairsPercent * 100).toFixed(0)} %)`,
            value: qualifyingRepairs,
          },
          { label: "Avgår från kapitalvinsten totalt", value: eligibleTaxBasis },
          { label: "Ej avdragsgillt mot vinst", value: nonEligibleRenovation },
        ],
      },
    ],
  };
}
