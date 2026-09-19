"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Account = {
  accountId: string;
  name: string;
  type: string;
  currency: string;
  status: string;
};

type Intelligence = {
  currency: string;
  summary: {
    liquidBalanceMinor: string;
    cashFlow: { incomeMinor: string; expenseMinor: string; netCashFlowMinor: string };
    savings: { savingsRate: number | null };
    debt: { debtBurdenRatio: number | null };
    healthScore: { score: number; band: string };
  };
  forecast: {
    endingBalanceMinor: string;
    minimumProjectedBalanceMinor: string;
    runwayDays: number | null;
  };
  facts: { id: string; statement: string; severity?: string }[];
  temporal: {
    recurring: {
      key: string;
      description: string;
      averageAmountMinor: string;
      cadence: string;
    }[];
  };
};

type ImportResult = {
  importedCount: number;
  duplicateCount: number;\n  ambiguousCount?: number;
  rejectedCount: number;
  parseErrors: { row: number; message: string }[];
  persistenceErrors: { row: number; message: string }[];
};

type ApiError = Error & { status?: number };

export default function HomePage() {
  const supabase = createSupabaseBrowserClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [affordability, setAffordability] = useState<{ decision: string; projectedMinimumBalanceMinor: string; bufferShortfallMinor: string; reasons: string[] } | null>(null);
  const [affordabilityBusy, setAffordabilityBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        setSignedIn(false);
        setSessionReady(true);
        return;
      }
      setSignedIn(true);
      setSessionReady(true);
      const accountResponse = await apiFetch("/accounts", session.access_token);
      const nextAccounts = (await accountResponse.json()) as Account[];
      setAccounts(nextAccounts);
      if (nextAccounts.length >= 2) {
        const intelligenceResponse = await apiFetch(
          "/financial/intelligence?currency=KES",
          session.access_token,
        );
        setData((await intelligenceResponse.json()) as Intelligence);
      } else {
        setData(null);
      }
    } catch (cause) {
      const apiError = cause as ApiError;
      if (apiError.status === 401) {
        setSignedIn(false);
        setAccounts(null);
        setData(null);
        setError("Your session is no longer valid. Please sign in again.");
      } else {
        setError(apiError.message || "Unable to load AfriFINOS");
      }
    }
  }

  useEffect(() => {
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void load());
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSignedIn(false);
    setAccounts(null);
    setData(null);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Please sign in again.");
      await apiFetch(
        "/accounts",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            name: String(form.get("name") ?? ""),
            type: String(form.get("type") ?? "cash"),
            currency: "KES",
          }),
        },
      );
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accounts || accounts.length < 2) return;
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setError("Please sign in again.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const primaryAccountId = String(form.get("primaryAccountId"));
    const primary = accounts.find((account) => account.accountId === primaryAccountId);
    setBusy(true);
    setError(null);
    try {
      await apiFetch(
        "/transactions",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            primaryAccountId,
            counterAccountId: String(form.get("counterAccountId")),
            occurredAt: String(form.get("occurredAt")),
            description: String(form.get("description")),
            amountMinor: String(Math.round(Number(form.get("amount") ?? 0) * 100)),
            currency: primary?.currency ?? "KES",
            type: String(form.get("type")),
          }),
        },
      );
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create transaction");
    } finally {
      setBusy(false);
    }
  }

  async function checkAffordability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = String(form.get("amount") ?? "").trim();
    const recurring = String(form.get("recurring") ?? "").trim();
    const amountMinor = parseKesToMinor(amount);
    const recurringMinor = recurring ? parseKesToMinor(recurring) : "0";
    if (!amountMinor || amountMinor === "0") {
      setError("Enter a valid purchase amount.");
      return;
    }
    if (recurringMinor === null) {
      setError("Enter a valid recurring monthly cost.");
      return;
    }
    setAffordabilityBusy(true);
    setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Please sign in again.");
      const params = new URLSearchParams({
        currency: data?.currency ?? "KES",
        amountMinor,
        additionalRecurringMonthlyMinor: recurringMinor,
      });
      const response = await apiFetch(`/financial/affordability?${params.toString()}`, session.access_token);
      setAffordability(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assess affordability");
    } finally {
      setAffordabilityBusy(false);
    }
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accounts || accounts.length < 2) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("csvFile");
    const primaryAccountId = String(form.get("primaryAccountId") ?? "");
    const counterAccountId = String(form.get("counterAccountId") ?? "");
    const providerId = String(form.get("providerId") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a CSV file to import.");
      return;
    }

    setImportBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const csv = await file.text();
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Please sign in again.");

      const response = await apiFetch(
        "/imports/csv",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            csv,
            primaryAccountId,
            counterAccountId,
            ...(providerId ? { providerId } : {}),
          }),
        },
      );
      setImportResult((await response.json()) as ImportResult);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV import failed");
    } finally {
      setImportBusy(false);
    }
  }

  if (!sessionReady) return <State title="AfriFINOS" detail="Checking your secure session…" />;
  if (!signedIn) {
    return (
      <Auth
        error={error}
        busy={busy}
        onSubmit={async (event, mode) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError(null);
          try {
            const email = String(form.get("email") ?? "").trim();
            const password = String(form.get("password") ?? "");
            if (mode === "signup") {
              const result = await supabase.auth.signUp({ email, password });
              if (result.error) throw result.error;
              setError(
                "Account created. Check your email if confirmation is enabled, then sign in.",
              );
            } else {
              const result = await supabase.auth.signInWithPassword({ email, password });
              if (result.error) throw result.error;
              await load();
            }
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Authentication failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }
  if (error && !accounts) {
    return (
      <>
        <State title="AfriFINOS" detail={error} />
        <div className="auth-actions">
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </>
    );
  }
  if (!accounts) return <State title="Loading AfriFINOS" detail="Preparing your financial workspace…" />;
  if (accounts.length < 2) {
    return (
      <Onboarding
        accounts={accounts}
        busy={busy}
        error={error}
        onCreateAccount={createAccount}
        onSignOut={signOut}
      />
    );
  }
  if (!data) {
    return (
      <State
        title="Building your financial picture"
        detail={error ?? "Calculating your first financial intelligence snapshot…"}
      />
    );
  }

  const summary = data.summary;
  const score = summary.healthScore.score;
  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">Afri<span>FINOS</span></div>
        <div>
          <small>Financial intelligence · {data.currency}</small>
          <button className="text-button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <section className="content">
        <div className="hero">
          <div>
            <h1>Your financial operating system.</h1>
            <p>One view of cash, spending, debt, savings and what is likely to happen next.</p>
          </div>
          <div className="badge">● Live intelligence</div>
        </div>
        {error && <div className="form-error page-error">{error}</div>}
        <div className="grid metrics">
          <Metric label="Liquid balance" value={formatMinor(summary.liquidBalanceMinor)} note="Bank · M-Pesa · Cash" />
          <Metric label="Income" value={formatMinor(summary.cashFlow.incomeMinor)} note="Recorded period" />
          <Metric label="Expenses" value={formatMinor(summary.cashFlow.expenseMinor)} note="Recorded period" />
          <Metric label="Savings rate" value={summary.savings.savingsRate === null ? "—" : `${(summary.savings.savingsRate * 100).toFixed(1)}%`} note="Income less recorded spending" />
        </div>
        <div className="grid two">
          <section className="card">
            <h2>Financial health</h2>
            <div className="health">
              <div className="score">{score}</div>
              <div>
                <div className="score-label">{capitalize(summary.healthScore.band)}</div>
                <div className="metric-note">Explainable score from cash flow, savings, debt and resilience.</div>
                <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>
              </div>
            </div>
          </section>
          <section className="card">
            <h2>90-day outlook</h2>
            <div className="forecast">
              <div className="forecast-box"><small>Projected balance</small><strong>{formatMinor(data.forecast.endingBalanceMinor)}</strong></div>
              <div className="forecast-box"><small>Minimum balance</small><strong>{formatMinor(data.forecast.minimumProjectedBalanceMinor)}</strong></div>
              <div className="forecast-box"><small>Cash runway</small><strong>{data.forecast.runwayDays === null ? "Beyond horizon" : `${data.forecast.runwayDays} days`}</strong></div>
            </div>
          </section>
        </div>
        <div className="grid two">
          <section className="card">
            <h2>Import transactions</h2>
            <p className="metric-note">Upload a CSV, choose the two ledger accounts involved, and AfriFINOS will normalize, categorize, deduplicate and post valid rows.</p>
            <form className="form" onSubmit={importCsv}>
              <label>CSV file<input ref={fileInput} name="csvFile" type="file" accept=".csv,text/csv" required /></label>
              <label>Primary account<select name="primaryAccountId" required>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</select></label>
              <label>Counter account<select name="counterAccountId" required>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</select></label>
              <label>Provider ID <span className="optional">(optional)</span><input name="providerId" placeholder="e.g. mpesa" /></label>
              <button disabled={importBusy} type="submit">{importBusy ? "Importing…" : "Import CSV"}</button>
            </form>
            {importResult && <div className="import-result"><strong>Import complete</strong><div className="import-stats"><span>{importResult.importedCount} imported</span><span>{importResult.duplicateCount} duplicates</span><span>{importResult.rejectedCount} rejected</span></div>{(importResult.parseErrors.length > 0 || importResult.persistenceErrors.length > 0) && <div className="import-errors">{[...importResult.parseErrors, ...importResult.persistenceErrors].slice(0, 8).map((item, index) => <div key={`${item.row}-${index}`}>Row {item.row}: {item.message}</div>)}</div>}</div>}
          </section>
          <section className="card">
            <h2>Add a transaction</h2>
            <form className="form" onSubmit={createTransaction}>
              <label>From account<select name="primaryAccountId" required>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</select></label>
              <label>To / counter account<select name="counterAccountId" required>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</select></label>
              <label>Type<select name="type" defaultValue="expense"><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option><option value="fee">Fee</option><option value="refund">Refund</option></select></label>
              <label>Amount (KES)<input name="amount" type="number" min="0.01" step="0.01" required /></label>
              <label>Date<input name="occurredAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required /></label>
              <label>Description<input name="description" placeholder="e.g. groceries" required /></label>
              <button disabled={busy} type="submit">{busy ? "Saving…" : "Add transaction"}</button>
            </form>
          </section>
        </div>
        <div className="grid two">
          <section className="card"><h2>Financial signals</h2><div className="list">{data.facts.length === 0 ? <div className="empty">No material signals detected.</div> : data.facts.map((fact) => <div className="item" key={fact.id}><div><strong>{fact.statement}</strong><small>{fact.severity ?? "info"}</small></div><span>{fact.severity === "critical" ? "Review" : "Signal"}</span></div>)}</div></section>
          <section className="card"><h2>Recurring commitments</h2><div className="list">{data.temporal.recurring.length === 0 ? <div className="empty">No recurring pattern detected yet.</div> : data.temporal.recurring.slice(0, 5).map((item) => <div className="item" key={item.key}><div><strong>{item.description}</strong><small>{item.cadence}</small></div><span>{formatMinor(item.averageAmountMinor)}</span></div>)}</div></section>
        </div>
        <div className="grid two">
          <section className="card"><h2>Accounts</h2><div className="list">{accounts.map((account) => <div className="item" key={account.accountId}><div><strong>{account.name}</strong><small>{account.type} · {account.currency}</small></div><span>{account.status}</span></div>)}</div></section>
        </div>
      </section>
    </main>
  );
}

function Auth({ error, busy, onSubmit }: { error: string | null; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>, mode: "signin" | "signup") => Promise<void> }) {
  return <main className="dashboard"><section className="content onboarding"><div className="hero"><div><div className="brand">Afri<span>FINOS</span></div><h1>Your financial operating system.</h1><p>Securely connect your financial picture and understand what happens next.</p></div></div><section className="card setup-card"><h2>Sign in or create your account</h2>{error && <div className="form-error">{error}</div>}<form className="form" onSubmit={(event) => void onSubmit(event, "signin")}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label><div className="auth-buttons"><button disabled={busy} type="submit">{busy ? "Working…" : "Sign in"}</button><button disabled={busy} type="button" onClick={(event) => { const form = event.currentTarget.form; if (form) void onSubmit({ ...({ preventDefault: () => {} } as FormEvent<HTMLFormElement>), currentTarget: form } as FormEvent<HTMLFormElement>, "signup"); }}>Create account</button></div></form></section></section></main>;
}

function Onboarding({ accounts, busy, error, onCreateAccount, onSignOut }: { accounts: Account[]; busy: boolean; error: string | null; onCreateAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>; onSignOut: () => Promise<void> }) {
  return <main className="dashboard"><header className="topbar"><div className="brand">Afri<span>FINOS</span></div><button className="text-button" onClick={() => void onSignOut()}>Sign out</button></header><section className="content onboarding"><div className="hero"><div><h1>Build your financial picture.</h1><p>Start with the accounts you actually use. AfriFINOS will turn them into a financial graph and explain your health.</p></div><div className="badge">Step 1 · Accounts</div></div><section className="card setup-card"><h2>{accounts.length === 0 ? "Add your first account" : "Add one more account"}</h2><p className="metric-note">Create at least two accounts so transfers and spending can be represented correctly.</p>{error && <div className="form-error">{error}</div>}<form className="form" onSubmit={onCreateAccount}><label>Account name<input name="name" placeholder="M-Pesa" required /></label><label>Account type<select name="type" defaultValue="mobile_money"><option value="mobile_money">M-Pesa / Mobile money</option><option value="bank">Bank</option><option value="cash">Cash</option><option value="sacco">SACCO</option><option value="investment">Investment</option><option value="loan">Loan</option><option value="other">Other</option></select></label><button disabled={busy} type="submit">{busy ? "Creating…" : "Create account"}</button></form>{accounts.length > 0 && <div className="list setup-list">{accounts.map((account) => <div className="item" key={account.accountId}><div><strong>{account.name}</strong><small>{account.type} · {account.currency}</small></div><span>{account.status}</span></div>)}</div>}</section></section></main>;
}

async function apiFetch(path: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401) {
    const error = new Error("Please sign in to continue.") as ApiError;
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `API returned ${response.status}`);
  }
  return response;
}

function parseKesToMinor(value: string): string | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return `${BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2))}`;
}

function formatMinor(value: string): string {
  return money.format(Number(BigInt(value)) / 100);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <section className="card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></section>;
}

function State({ title, detail }: { title: string; detail: string }) {
  return <main className="dashboard"><section className="content"><div className="card state"><h1>{title}</h1><p>{detail}</p></div></section></main>;
}
