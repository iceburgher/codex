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
  tone = "default",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent";
}) {
  return (
    <section
      className={`card print-block p-5 ${tone === "accent" ? "border-accent/40" : ""} ${className}`}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-snug text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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
  size = "md",
  type = "button",
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: "border border-border-strong bg-surface hover:bg-surface-muted",
    primary: "border border-accent bg-accent text-white hover:bg-accent-strong",
    danger: "border border-border-strong bg-surface text-negative hover:bg-negative-soft",
    ghost: "border border-transparent text-muted hover:bg-surface-muted",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export const SOURCE_LABELS: Record<AssumptionSource, string> = {
  VERIFIED: "Kontrollerat",
  USER_INPUT: "Din uppgift",
  ESTIMATE: "Uppskattning",
  TAX_ADVISOR_INPUT: "Fråga rådgivare",
};

export function SourceTag({ source }: { source: AssumptionSource }) {
  const styles: Record<AssumptionSource, string> = {
    VERIFIED: "bg-positive-soft text-positive",
    USER_INPUT: "bg-surface-muted text-muted",
    ESTIMATE: "bg-warn-soft text-warn",
    TAX_ADVISOR_INPUT: "bg-accent-soft text-accent",
  };
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${styles[source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  );
}

const FIELD_CLASS =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-accent";

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder = "Ej ifyllt",
  step,
  source,
  hint,
  allowNull = false,
  size = "md",
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
  size?: "md" | "lg";
}) {
  const id = useId();
  const isMissing = value === null || value === undefined;

  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className={size === "lg" ? "text-sm font-medium" : "text-sm text-muted"}>{label}</span>
        {source && <SourceTag source={source} />}
      </span>
      <span className="relative block">
        <input
          id={id}
          type="number"
          step={step}
          inputMode="decimal"
          className={`numeric ${FIELD_CLASS} ${suffix ? "pr-12" : ""} ${
            size === "lg" ? "py-3 text-lg font-semibold" : ""
          } ${isMissing && allowNull ? "border-warn" : "border-border-strong"}`}
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
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            {suffix}
          </span>
        )}
      </span>
      {isMissing && allowNull && (
        <span className="mt-1 block text-xs text-warn">Saknas — fyll i för att räkna</span>
      )}
      {hint && <span className="mt-1 block text-xs leading-snug text-muted">{hint}</span>}
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
  placeholder = "Ej ifyllt",
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <input
        id={id}
        type="text"
        className={`${FIELD_CLASS} border-border-strong`}
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
      {label && (
        <span className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm text-muted">{label}</span>
          {source && <SourceTag source={source} />}
        </span>
      )}
      <select
        id={id}
        className={`${FIELD_CLASS} border-border-strong`}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs leading-snug text-muted">{hint}</span>}
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
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm">{label}</span>
      </label>
      {hint && <span className="mt-1 block pl-7 text-xs text-muted">{hint}</span>}
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
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface-muted"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex items-center gap-2">
          {badge}
          <span className="text-muted">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}

/** "Visa uträkning" — varje viktigt tal ska gå att spåra. */
export function AuditPanel({ trails }: { trails: AuditTrail[] }) {
  const [open, setOpen] = useState(false);
  if (trails.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {open ? "Dölj uträkning" : "Visa uträkning"}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {trails.map((trail, ti) => (
            <div key={`${trail.title}-${ti}`} className="rounded-lg bg-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{trail.title}</span>
                <SourceTag source={trail.source} />
              </div>
              <table className="w-full text-xs">
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

export function RiskDot({ severity }: { severity: RiskSeverity }) {
  const color =
    severity === "high"
      ? "bg-negative"
      : severity === "medium"
        ? "bg-warn"
        : "bg-positive";
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

export function Stat({
  label,
  value,
  tone = "neutral",
  hint,
  size = "md",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  hint?: string;
  size?: "md" | "lg";
}) {
  const toneClass =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "";
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div
        className={`numeric font-semibold ${size === "lg" ? "text-2xl" : "text-lg"} ${toneClass}`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="no-print flex gap-1 rounded-xl bg-surface-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
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
