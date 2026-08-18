const NBSP = " ";

/** Pengar: "3 600 000 kr", negativa som "−250 000 kr". Inga decimaler. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  const abs = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rounded < 0 ? "−" : ""}${abs}${NBSP}kr`;
}

/** Kort form för diagramaxlar: "4,8 mkr", "825 tkr". */
export function formatMoneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${decimal(value / 1_000_000, 1)}${NBSP}mkr`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}${NBSP}tkr`;
  return `${Math.round(value)}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${decimal(value * 100, decimals)}${NBSP}%`;
}

export function formatMonths(months: number | null | undefined): string {
  if (months === null || months === undefined) return "—";
  return `${Math.round(months)}${NBSP}mån`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

/** Svenskt decimaltecken. */
function decimal(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Vissa nyckeltal går inte att räkna ut förrän användaren fyllt i något. Då
 * ska de säga det rakt ut i stället för att visa en siffra som vilar på ett
 * antagande ingen gjort.
 */
export function whenAssessable(
  missing: boolean,
  render: () => string,
  placeholder: string | undefined = "Kräver försäljningspris",
): string {
  return missing ? (placeholder ?? "Kräver försäljningspris") : render();
}

export function formatMissing(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Ej ifyllt";
  return formatMoney(value);
}
