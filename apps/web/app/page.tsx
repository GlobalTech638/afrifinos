"use client";

import { useEffect, useState } from "react";

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

type Intelligence = {
  currency: string;
  summary: {
    liquidBalanceMinor: string;
    cashFlow: { incomeMinor: string; expenseMinor: string; netCashFlowMinor: string };
    savings: { savingsRate: number | null };
    debt: { debtBurdenRatio: number | null };
    healthScore: { score: number; band: string };
  };
  forecast: { endingBalanceMinor: string; minimumProjectedBalanceMinor: string; runwayDays: number | null };
  facts: { id: string; statement: string; severity?: string }[];
  temporal: { recurring: { key: string; description: string; averageAmountMinor: string; cadence: string }[] };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function HomePage() {
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/financial/intelligence?currency=KES`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) throw new Error("Please sign in to view your financial intelligence.");
        if (!response.ok) throw new Error(`Financial API returned ${response.status}`);
        return response.json() as Promise<Intelligence>;
      })
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load financial intelligence");
      });

    return () => controller.abort();
  }, []);

  if (error) return <State title="Unable to load your financial intelligence" detail={error} />;
  if (!data) return <State title="Loading AfriFINOS" detail="Building your financial picture…" />;

  const summary = data.summary;
  const score = summary.healthScore.score;
  const income = minor(summary.cashFlow.incomeMinor);
  const expenses = minor(summary.cashFlow.expenseMinor);

  return (
    <main className="dashboard">
      <header className="topbar"><div className="brand">Afri<span>FINOS</span></div><small>Financial intelligence · {data.currency}</small></header>
      <section className="content">
        <div className="hero"><div><h1>Your financial operating system.</h1><p>One view of cash, spending, debt, savings and what is likely to happen next.</p></div><div className="badge">● Live intelligence</div></div>

        <div className="grid metrics">
          <Metric label="Liquid balance" value={formatMinor(summary.liquidBalanceMinor)} note="Bank · M-Pesa · Cash" />
          <Metric label="Income" value={formatMinor(summary.cashFlow.incomeMinor)} note="Recorded period" />
          <Metric label="Expenses" value={formatMinor(summary.cashFlow.expenseMinor)} note="Recorded period" />
          <Metric label="Savings rate" value={summary.savings.savingsRate === null ? "—" : `${(summary.savings.savingsRate * 100).toFixed(1)}%`} note="Income less recorded spending" />
        </div>

        <div className="grid two">
          <section className="card"><h2>Financial health</h2><div className="health"><div className="score">{score}</div><div><div className="score-label">{capitalize(summary.healthScore.band)}</div><div className="metric-note">Explainable score from cash flow, savings, debt and resilience.</div><div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div></div></div></section>
          <section className="card"><h2>90-day outlook</h2><div className="forecast"><div className="forecast-box"><small>Projected balance</small><strong>{formatMinor(data.forecast.endingBalanceMinor)}</strong></div><div className="forecast-box"><small>Minimum balance</small><strong>{formatMinor(data.forecast.minimumProjectedBalanceMinor)}</strong></div><div className="forecast-box"><small>Cash runway</small><strong>{data.forecast.runwayDays === null ? "Beyond horizon" : `${data.forecast.runwayDays} days`}</strong></div></div></section>
        </div>

        <div className="grid two">
          <section className="card"><h2>Financial signals</h2><div className="list">{data.facts.length === 0 ? <div className="empty">No material signals detected.</div> : data.facts.map((fact) => <div className="item" key={fact.id}><div><strong>{fact.statement}</strong><small>{fact.severity ?? "info"}</small></div><span className={fact.severity === "critical" ? "warning" : ""}>{fact.severity === "critical" ? "Review" : "Signal"}</span></div>)}</div></section>
          <section className="card"><h2>Recurring commitments</h2><div className="list">{data.temporal.recurring.length === 0 ? <div className="empty">No recurring pattern detected yet.</div> : data.temporal.recurring.slice(0, 5).map((item) => <div className="item" key={item.key}><div><strong>{item.description}</strong><small>{item.cadence}</small></div><span className="amount">{formatMinor(item.averageAmountMinor)}</span></div>)}</div></section>
        </div>

        <div className="card footnote">Net cash flow: <strong>{formatMinor(summary.cashFlow.netCashFlowMinor)}</strong> · Historical income {money.format(income)} · expenses {money.format(expenses)}</div>
      </section>
    </main>
  );
}

function formatMinor(value: string): string { return money.format(Number(BigInt(value)) / 100); }
function minor(value: string): number { return Number(BigInt(value)) / 100; }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <section className="card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></section>; }
function State({ title, detail }: { title: string; detail: string }) { return <main className="dashboard"><section className="content"><div className="card state"><h1>{title}</h1><p>{detail}</p></div></section></main>; }
