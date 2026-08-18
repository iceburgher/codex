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

const SERIES = ["#3a7ca5", "#5aa9a0", "#c1873b", "#8d6ba8"];
const AXIS = { fontSize: 11, fill: "var(--muted)" };

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      fontSize: 11,
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
    <div className="grid gap-3 lg:grid-cols-3">
      <Card title="Total project cost by scenario">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={costData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {costData.map((_, i) => (
                <Cell key={i} fill={SERIES[i % SERIES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Net available privately after tax">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={profitData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {profitData.map((d, i) => (
                <Cell key={i} fill={d.value < 0 ? "var(--negative)" : SERIES[i % SERIES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Family net worth delta" subtitle="Mode A retained · Mode B fully extracted">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={netWorthData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="modeA" name="Mode A" fill={SERIES[0]} radius={[3, 3, 0, 0]} />
            <Bar dataKey="modeB" name="Mode B" fill={SERIES[1]} radius={[3, 3, 0, 0]} />
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
      title="Capital required over time"
      subtitle="Cumulative project cash position before equity injection — the trough is the peak funding need."
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={(m: number) => `${m} mo`}
          />
          <YAxis tickFormatter={formatMoneyShort} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => formatMoney(Number(v))} {...tooltipStyle()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="var(--muted)" />
          {results.map((r, i) => (
            <Line
              key={r.scenario}
              type="monotone"
              dataKey={shortLabel(r.label)}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2}
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
    { label: "Sale price", delta: result.salePrice },
    { label: "Purchase price", delta: -result.purchasePrice },
    { label: "Stamp duty / title", delta: -result.purchaseTaxesFees },
    { label: "Renovation", delta: -result.renovationCashCost },
    { label: "Financing", delta: -result.financingCost },
    { label: "Running costs", delta: -result.runningCostsTotal },
    { label: "Sale costs", delta: -result.saleCosts.saleCostsTotal },
    {
      label: result.corporateTax ? "Corporate tax" : "Capital gains tax",
      delta: -(result.corporateTax?.companyTax ?? result.capitalGain.capitalGainTax),
    },
    { label: "Owner extraction tax", delta: -(result.extraction?.ownerExtractionTax ?? 0) },
    { label: "Benefit tax", delta: -(result.benefit?.combinedEconomicCost ?? 0) },
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
  data.push({ name: "Net result", base: 0, value: Math.abs(running), delta: running });

  return (
    <Card title="Cost & tax waterfall" subtitle={result.label}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
          <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]}>
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
    .replace("Private — ", "Priv ")
    .replace("Separate Project Company", "Project AB")
    .replace("Existing Company", "Existing AB");
}
