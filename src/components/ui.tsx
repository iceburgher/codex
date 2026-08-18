"use client";

import { useId, useState, type ReactNode } from "react";
import type { AssumptionSource, AuditTrail, RiskSeverity } from "@/types";
import { formatMoney, formatPercent } from "@/lib/format";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-surface p-4 print-block ${className}`}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: "border border-border bg-surface hover:bg-surface-muted",
    primary: "border border-accent bg-accent text-white hover:opacity-90",
    danger: "border border-border bg-surface text-negative hover:bg-danger-soft",
    ghost: "border border-transparent hover:bg-surface-muted",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export const SOURCE_LABELS: Record<AssumptionSource, string> = {
  VERIFIED: "Verified",
  USER_INPUT: "User input",
  ESTIMATE: "Estimate",
  TAX_ADVISOR_INPUT: "Tax advisor input",
};

export function SourceTag({ source }: { source: AssumptionSource }) {
  const styles: Record<AssumptionSource, string> = {
    VERIFIED: "bg-ok-soft text-positive",
    USER_INPUT: "bg-accent-soft text-accent",
    ESTIMATE: "bg-warn-soft text-warn",
    TAX_ADVISOR_INPUT: "bg-danger-soft text-negative",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder = "Not entered",
  step,
  source,
  hint,
  allowNull = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  suffix?: string;
  placeholder?: string;
  step?: number;
  source?: AssumptionSource;
  hint?: string;
  allowNull?: boolean;
}) {
  const id = useId();
  const isMissing = value === null || value === undefined;

  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        {source && <SourceTag source={source} />}
      </span>
      <span className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          step={step}
          inputMode="decimal"
          className={`numeric w-full rounded-md border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent ${
            isMissing && allowNull ? "border-warn" : "border-border"
          }`}
          value={isMissing ? "" : value}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(allowNull ? null : 0);
              return;
            }
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : allowNull ? null : 0);
          }}
        />
        {suffix && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
      </span>
      {isMissing && allowNull && (
        <span className="mt-1 block text-[11px] text-warn">Missing — not entered</span>
      )}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function PercentField({
  label,
  value,
  onChange,
  source,
  hint,
  allowNull = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  source?: AssumptionSource;
  hint?: string;
  allowNull?: boolean;
}) {
  return (
    <NumberField
      label={label}
      value={value === null ? null : Number((value * 100).toFixed(4))}
      onChange={(v) => onChange(v === null ? null : v / 100)}
      suffix="%"
      step={0.1}
      source={source}
      hint={hint}
      allowNull={allowNull}
    />
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder = "Not entered",
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        id={id}
        type="text"
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  source,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  source?: AssumptionSource;
  hint?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        {source && <SourceTag source={source} />}
      </span>
      <select
        id={id}
        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-xs">{label}</span>
      </label>
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-muted">{open ? "−" : "+"}</span>
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="border-t border-border px-3 py-3">{children}</div>}
    </div>
  );
}

/** "Show calculation" — every major output must be explainable. */
export function AuditPanel({ trails }: { trails: AuditTrail[] }) {
  const [open, setOpen] = useState(false);
  if (trails.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[11px] font-medium text-accent underline underline-offset-2"
      >
        {open ? "Hide calculation" : "Show calculation"}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {trails.map((trail) => (
            <div key={trail.title} className="rounded-md bg-surface-muted p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold">{trail.title}</span>
                <SourceTag source={trail.source} />
              </div>
              <table className="w-full text-[11px]">
                <tbody>
                  {trail.lines.map((line, i) => (
                    <tr key={`${line.label}-${i}`}>
                      <td className="py-0.5 pr-3 text-muted">{line.label}</td>
                      <td className="numeric py-0.5 text-right">
                        {typeof line.value === "number" ? formatMoney(line.value) : line.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RiskBadge({ severity }: { severity: RiskSeverity }) {
  const map: Record<RiskSeverity, { label: string; className: string }> = {
    low: { label: "Green", className: "bg-ok-soft text-positive" },
    medium: { label: "Yellow", className: "bg-warn-soft text-warn" },
    high: { label: "Red", className: "bg-danger-soft text-negative" },
  };
  const m = map[severity];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${m.className}`}>
      {m.label}
    </span>
  );
}

export function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  hint?: string;
}) {
  const toneClass =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "";
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`numeric text-sm font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted">{hint}</div>}
    </div>
  );
}

export function MoneyCell({ value, bold = false }: { value: number | null; bold?: boolean }) {
  const tone = value === null ? "" : value < 0 ? "text-negative" : "";
  return (
    <span className={`numeric ${tone} ${bold ? "font-semibold" : ""}`}>{formatMoney(value)}</span>
  );
}

export function PercentCell({ value }: { value: number | null }) {
  const tone = value === null ? "" : value < 0 ? "text-negative" : "";
  return <span className={`numeric ${tone}`}>{formatPercent(value)}</span>;
}
