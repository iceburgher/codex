"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import type { ScenarioResult } from "@/types";
import { Card } from "../ui";

const SERIES = ["#7c9482", "#5f7a68", "#b0c2b3", "#46604f"];
const AXIS = { fontSize: 12, fill: "var(--muted)" };

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--surface)",
      border: "none",
      boxShadow: "var(--shadow-card)",
      borderRadius: 12,
      fontSize: 12,
      color: "var(--foreground)",
    },
    labelStyle: { color: "var(--muted)", fontSize: 11 },
  };
}

export function ScenarioBarCharts({ results }: { results: ScenarioResult[] }) {
  const costData = results.map((r) => ({
    name: shortLabel(r.label),
    value: Math.round(r.totalProjectCost),
  }));
  const profitData = results.map((r) => ({
    name: shortLabel(r.label),
    value: Math.round(r.netAvailablePrivately),
  }));
  const netWorthData = results.map((r) => ({
    name: shortLabel(r.label),
    modeA: Math.round(r.familyNetWorth.familyNetWorthDeltaModeA),
    modeB: Math.round(r.familyNetWorth.familyNetWorthDeltaModeB),
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-3 print-stack">
      <Card title="Vad projektet kostar totalt">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={costData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} strokeOpacity={0.7} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {costData.map((_, i) => (
                <Cell key={i} fill={SERIES[i % SERIES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Kvar till er efter skatt">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={profitData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} strokeOpacity={0.7} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {profitData.map((d, i) => (
                <Cell key={i} fill={d.value < 0 ? "var(--negative)" : SERIES[i % SERIES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Förmögenhetsförändring"
        subtitle="A = pengarna kvar i bolaget · B = allt uttaget privat"
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={netWorthData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} strokeOpacity={0.7} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="modeA" name="Kvar i bolaget" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="modeB" name="Allt uttaget" fill={SERIES[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export function CashFlowChart({ results }: { results: ScenarioResult[] }) {
  const maxMonths = Math.max(...results.map((r) => r.cashFlow.months.length));
  const data = Array.from({ length: maxMonths }, (_, m) => {
    const point: Record<string, number> = { month: m };
    for (const r of results) {
      const entry = r.cashFlow.months[m];
      if (entry) point[shortLabel(r.label)] = Math.round(entry.closingCash);
    }
    return point;
  });

  return (
    <Card
      title="Så mycket kapital binds över tid"
      subtitle="Projektets kassa innan ni skjuter till eget kapital. Bottenläget är det mesta ni behöver ha tillgängligt."
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} strokeOpacity={0.7} />
          <XAxis
            dataKey="month"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={(m: number) => `${m} mån`}
          />
          <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="var(--muted)" />
          {results.map((r, i) => (
            <Line
              key={r.scenario}
              type="natural"
              dataKey={shortLabel(r.label)}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function CostWaterfall({ result }: { result: ScenarioResult }) {
  const steps: { label: string; delta: number }[] = [
    { label: "Försäljningspris", delta: result.salePrice },
    { label: "Köpeskilling", delta: -result.purchasePrice },
    { label: "Lagfart och pantbrev", delta: -result.purchaseTaxesFees },
    { label: "Renovering", delta: -result.renovationCashCost },
    { label: "Räntor och avgifter", delta: -result.financingCost },
    { label: "Drift", delta: -result.runningCostsTotal },
    { label: "Försäljningskostnader", delta: -result.saleCosts.saleCostsTotal },
    {
      label: result.corporateTax ? "Bolagsskatt" : "Kapitalvinstskatt",
      delta: -(result.corporateTax?.companyTax ?? result.capitalGain.capitalGainTax),
    },
    { label: "Skatt vid uttag", delta: -(result.extraction?.ownerExtractionTax ?? 0) },
    { label: "Förmånsskatt", delta: -(result.benefit?.combinedEconomicCost ?? 0) },
  ];

  let running = 0;
  const data = steps.map((s) => {
    const start = running;
    running += s.delta;
    return {
      name: s.label,
      base: Math.min(start, running),
      value: Math.abs(s.delta),
      delta: s.delta,
    };
  });
  data.push({ name: "Kvar", base: 0, value: Math.abs(running), delta: running });

  return (
    <Card title="Från försäljningspris till kvar i handen" subtitle={result.label}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} strokeOpacity={0.7} />
          <XAxis
            dataKey="name"
            tick={{ ...AXIS, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(_value, _name, item) =>
              formatMoney((item?.payload as { delta?: number } | undefined)?.delta ?? 0)
            }
            {...tooltipStyle()}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" />
          <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.delta >= 0 ? "var(--positive)" : "var(--negative)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function shortLabel(label: string): string {
  return label
    .replace("Privat, utan lån", "Privat, kontant")
    .replace("Privat, med lån", "Privat, lån")
    .replace("Bolaget äger", "Bolaget");
}
