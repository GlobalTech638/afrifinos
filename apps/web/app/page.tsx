const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const demo = {
  balance: 184_500,
  income: 126_000,
  expenses: 82_400,
  savingsRate: 34.6,
  healthScore: 76,
  healthLabel: "Stable",
  forecast: 228_100,
  runway: 47,
  alerts: [
    { title: "Large transport expense", detail: "KES 18,000 · 2.4σ above baseline", tone: "warning" },
    { title: "Recurring payment detected", detail: "KES 7,500 every ~30 days", tone: "" },
    { title: "Debt burden is elevated", detail: "32% of recorded income", tone: "warning" },
  ],
  recurring: [
    ["Rent", 28_000, "Monthly"],
    ["School fees", 15_000, "Monthly"],
    ["Mobile / internet", 7_500, "Monthly"],
  ],
};

export default function HomePage() {
  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">Afri<span>FINOS</span></div>
        <small>Financial intelligence · KES</small>
      </header>

      <section className="content">
        <div className="hero">
          <div>
            <h1>Your financial operating system.</h1>
            <p>One view of cash, spending, debt, savings and what is likely to happen next. Built for the way money actually moves across Africa.</p>
          </div>
          <div className="badge">● System healthy</div>
        </div>

        <div className="grid metrics">
          <Metric label="Liquid balance" value={money.format(demo.balance)} note="Bank · M-Pesa · Cash" />
          <Metric label="Income / month" value={money.format(demo.income)} note="Recorded average" />
          <Metric label="Expenses / month" value={money.format(demo.expenses)} note="Recorded average" />
          <Metric label="Savings rate" value={`${demo.savingsRate}%`} note="After recorded spending" />
        </div>

        <div className="grid two">
          <section className="card">
            <h2>Financial health</h2>
            <div className="health">
              <div className="score">{demo.healthScore}</div>
              <div>
                <div className="score-label">{demo.healthLabel}</div>
                <div className="metric-note">Strong foundations, with room to improve resilience.</div>
                <div className="progress"><div style={{ width: `${demo.healthScore}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>90-day outlook</h2>
            <div className="forecast">
              <div className="forecast-box"><small>Projected balance</small><strong>{money.format(demo.forecast)}</strong></div>
              <div className="forecast-box"><small>Cash runway</small><strong>{demo.runway} days</strong></div>
              <div className="forecast-box"><small>Direction</small><strong className="positive">Improving</strong></div>
            </div>
          </section>
        </div>

        <div className="grid two">
          <section className="card">
            <h2>Financial signals</h2>
            <div className="list">
              {demo.alerts.map((alert) => (
                <div className="item" key={alert.title}>
                  <div><strong>{alert.title}</strong><small>{alert.detail}</small></div>
                  <span className={alert.tone}>{alert.tone === "warning" ? "Review" : "Detected"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Recurring commitments</h2>
            <div className="list">
              {demo.recurring.map(([name, amount, cadence]) => (
                <div className="item" key={name as string}>
                  <div><strong>{name}</strong><small>{cadence}</small></div>
                  <span className="amount">{money.format(amount as number)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </section>
  );
}
