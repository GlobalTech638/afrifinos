# AfriFINOS Architecture Overview

## Purpose

AfriFINOS is designed as a financial intelligence platform, not a transaction-entry application. The architecture separates financial truth from probabilistic interpretation so that users can understand where every important number came from.

## System Flow

```text
                    ┌──────────────────────────┐
                    │  User / External Sources  │
                    │ manual · CSV · providers │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │       Ingestion           │
                    │ parse · validate · dedupe │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │       Normalization       │
                    │ provider → domain model   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │   Financial Domain State  │
                    │ accounts · transactions  │
                    │ obligations · goals ·     │
                    │ assets · provenance       │
                    └────────────┬─────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       ┌────────────────────┐          ┌────────────────────┐
       │ Financial Engine   │          │ AI Intelligence    │
       │ deterministic      │◄────────►│ explain · classify │
       │ balances · ratios  │ verified │ summarize · detect │
       │ forecasts · score  │  state   │ recommend          │
       └─────────┬──────────┘          └────────────────────┘
                 │
                 ▼
       ┌────────────────────┐
       │ User-facing APIs   │
       │ dashboards · query │
       │ reports · alerts   │
       └────────────────────┘
```

## Architectural Boundaries

### Ingestion

Responsible for accepting external records and converting them into validated input events.

Examples:

- CSV imports.
- Manual transaction entry.
- Mobile-money provider feeds.
- Bank feeds.
- SACCO exports.

Ingestion must not directly implement financial analytics.

### Normalization

Provider data is messy and provider-specific. Normalization converts it into stable AfriFINOS domain objects while preserving provenance.

A normalized transaction should retain, where available:

- Source provider.
- External transaction identifier.
- Original description/reference.
- Original timestamp.
- Original amount and currency.
- Normalized amount and currency.
- Import/batch identifier.
- Reconciliation status.

Normalization must be deterministic. AI-assisted categorization is enrichment, not normalization authority.

### Financial Domain

The domain layer owns financial concepts and invariants.

Core entities include:

- Account.
- Transaction.
- Ledger entry.
- Currency.
- Party/counterparty.
- Obligation.
- Savings goal.
- Asset.
- Liability.
- Financial provider.
- Provenance record.

The domain must remain independent of HTTP, UI, provider SDKs, and LLM vendors.

### Financial Engine

The financial engine produces authoritative derived values from verified domain state.

Examples:

- Account balances.
- Cash flow.
- Income and expense totals.
- Net worth.
- Debt burden.
- Savings rate.
- Emergency runway.
- Financial Health Score.
- Forecast inputs and deterministic forecast calculations.

Every important metric should have a defined methodology and deterministic test vectors.

### AI Intelligence

AI sits above the verified financial state.

It may consume structured financial facts and produce:

- Explanations.
- Summaries.
- Classifications.
- Pattern/anomaly hypotheses.
- Scenario analysis.
- Recommendations.

AI output must be explicitly labeled as model-generated where appropriate. It must not mutate authoritative financial state without passing through domain validation and explicit authorization.

## Data Ownership and Provenance

Every imported financial record should be traceable to its source where practical.

The system should distinguish at least three layers:

1. **Source facts** — what the provider, user, or import actually supplied.
2. **Deterministic derivations** — calculations performed by AfriFINOS code.
3. **Probabilistic interpretations** — classifications, explanations, predictions, or recommendations produced by AI.

This separation is foundational for auditability and debugging.

## Idempotency and Reconciliation

Provider integrations will eventually deliver duplicate, delayed, reordered, or corrected records.

The ingestion layer must therefore support idempotency keys and reconciliation workflows.

An external transaction identifier is useful but must not be assumed globally unique across every provider. Provider identity and account context form part of the uniqueness boundary.

Corrections should preserve history and provenance rather than silently overwriting source facts.

## Multi-Currency

Currency must be explicit on monetary values.

Cross-currency calculations require an explicit exchange-rate source, timestamp, and conversion methodology. The system must never silently treat amounts in different currencies as directly comparable.

The MVP may begin with one currency per account while keeping the domain model currency-aware.

## Security Boundaries

Authentication and authorization belong at the application/API boundary, but domain services must still enforce ownership and authorization assumptions for sensitive operations.

Secrets belong outside source control.

Provider credentials must be isolated from the core financial domain.

Production financial data must never be used as ordinary development fixtures.

## Initial Technology Direction

The implementation is expected to use:

- TypeScript for application/backend services.
- PostgreSQL for durable financial state.
- Redis-backed jobs where asynchronous processing is required.
- A modular monorepo structure.
- Provider adapters behind stable interfaces.
- An AI provider abstraction rather than direct coupling to one model vendor.

These are implementation preferences, not irreversible commitments. Material changes should be recorded through ADRs.

## Evolution Path

```text
Phase 1
Manual + CSV
    ↓
Normalized financial domain
    ↓
Deterministic engine
    ↓
Financial Health Score

Phase 2
Provider integrations
    ↓
Reconciliation + recurring detection
    ↓
Forecasting

Phase 3
AI analyst
    ↓
Personalized financial intelligence
    ↓
Scenario planning

Phase 4
User-authorized workflows
    ↓
Provider actions
    ↓
Controlled financial automation
```

The architecture intentionally delays irreversible financial actions until the data and authorization foundations are mature.
