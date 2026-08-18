const NBSP = " ";

/** Money: "3 600 000 kr", negatives as "-250 000 kr". No decimals. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  const abs = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rounded < 0 ? "-" : ""}${abs}${NBSP}kr`;
}

export function formatMoneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatMonths(months: number | null | undefined): string {
  if (months === null || months === undefined) return "—";
  return `${Math.round(months)}${NBSP}mo`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

/**
 * Exit-dependent KPIs are meaningless without a sale price. Showing a computed
 * loss there would present a guess as a result.
 */
export function whenAssessable(
  missing: boolean,
  render: () => string,
  placeholder: string | undefined = "Needs sale price",
): string {
  return missing ? (placeholder ?? "Needs sale price") : render();
}

export function formatMissing(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not entered";
  return formatMoney(value);
}
