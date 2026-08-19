"use client";

/**
 * Små SVG-figurer som ritas direkt — snabbare och skarpare än ett
 * diagrambibliotek för de här ytorna, och de följer temafärgerna.
 */

export function Sparkline({
  values,
  className = "",
  stroke = "var(--accent-strong)",
  fill = false,
}: {
  values: number[];
  className?: string;
  stroke?: string;
  fill?: boolean;
}) {
  if (values.length < 2) return null;

  const w = 100;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y] as const;
  });

  // Mjuk kurva via kvadratiska segment mellan mittpunkter.
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const mx = (px + cx) / 2;
    d += ` Q ${px} ${py} ${mx} ${(py + cy) / 2}`;
    if (i === points.length - 1) d += ` T ${cx} ${cy}`;
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      {fill && (
        <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={stroke} opacity="0.12" stroke="none" />
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MiniBars({
  values,
  className = "",
  color = "var(--accent-strong)",
}: {
  values: number[];
  className?: string;
  color?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className} aria-hidden>
      {values.map((v, i) => {
        const barW = 100 / (values.length * 1.7);
        const gap = barW * 0.7;
        const x = i * (barW + gap);
        const height = Math.max(2, (v / max) * 30);
        return (
          <rect
            key={i}
            x={x}
            y={32 - height}
            width={barW}
            height={height}
            rx={barW / 2}
            fill={color}
            opacity={0.35 + (0.65 * v) / max}
          />
        );
      })}
    </svg>
  );
}

/** Halvcirkel-mätare, som procentmätaren i referensen. */
export function Gauge({
  value,
  label,
  size = 190,
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = 70;
  const cx = 100;
  const cy = 95;
  const circumference = Math.PI * r;

  const arc = (from: number, to: number) => {
    const a1 = Math.PI + Math.PI * from;
    const a2 = Math.PI + Math.PI * to;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" width={size} height={size * 0.55} aria-hidden>
        <path
          d={arc(0, 1)}
          fill="none"
          stroke="var(--accent-soft)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {clamped > 0.001 && (
          <path
            d={arc(0, clamped)}
            fill="none"
            stroke="var(--accent-strong)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={circumference}
          />
        )}
      </svg>
      <div className="-mt-8 text-center">
        <div className="numeric text-2xl font-semibold tracking-tight">
          {Math.round(clamped * 100)} %
        </div>
        {label && <div className="mt-0.5 text-xs text-muted">{label}</div>}
      </div>
    </div>
  );
}
