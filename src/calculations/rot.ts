import type { RotInputs, RotResult } from "@/types";

/**
 * ROT tax credit (private scenarios only). The credit is capped both by the
 * statutory rate on eligible labour and by each owner's remaining annual
 * allowance.
 */
export function calculateRot(params: {
  rot: RotInputs;
  renovationTotalGross: number;
  rotRate: number;
  rotMaxPerPerson: number;
  isPrivateOwned: boolean;
}): RotResult {
  const { rot, renovationTotalGross, rotRate, rotMaxPerPerson, isPrivateOwned } = params;

  if (!isPrivateOwned || !rot.enabled) {
    return {
      potentialRot: 0,
      availableRotAllowance: 0,
      rotDeduction: 0,
      privateRenovationCashCost: renovationTotalGross,
      audit: [
        {
          title: "ROT-avdrag",
          source: "VERIFIED",
          lines: [
            {
              label: "Status",
              value: isPrivateOwned ? "Avstängt" : "Gäller inte vid bolagsägande",
            },
            { label: "Renoveringskostnad", value: renovationTotalGross },
          ],
        },
      ],
    };
  }

  const potentialRot = (rot.eligibleLaborCostGross || 0) * rotRate;
  const perPersonCap = rotMaxPerPerson;
  const availableRotAllowance = Math.min(
    (rot.remainingAllowancePerson1 || 0) + (rot.remainingAllowancePerson2 || 0),
    perPersonCap * Math.max(1, rot.eligibleOwners || 1),
  );
  const rotDeduction = Math.max(0, Math.min(potentialRot, availableRotAllowance));
  const privateRenovationCashCost = renovationTotalGross - rotDeduction;

  return {
    potentialRot,
    availableRotAllowance,
    rotDeduction,
    privateRenovationCashCost,
    audit: [
      {
        title: "ROT-avdrag",
        source: "VERIFIED",
        lines: [
          { label: "Berättigad arbetskostnad", value: rot.eligibleLaborCostGross || 0 },
          { label: "Andel", value: `${(rotRate * 100).toFixed(0)} %` },
          { label: "Möjligt ROT-avdrag", value: potentialRot },
          { label: "Kvar av årets utrymme", value: availableRotAllowance },
          { label: "ROT som används", value: rotDeduction },
          { label: "Renovering efter ROT", value: privateRenovationCashCost },
        ],
      },
    ],
  };
}
