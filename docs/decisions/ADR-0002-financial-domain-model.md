# ADR-0002: Financial Domain Model

- **Status:** Accepted
- **Date:** 2026-09-10
- **Decision owners:** Project maintainers
- **Scope:** Financial entities, money representation, transaction semantics, ledger behavior, and provenance

## Context

AfriFINOS must combine financial data from mobile money, banks, SACCOs, cash, loans, savings, and investments without allowing any single provider's data model to become the platform's source of truth.

The product also needs to support accurate cash-flow analysis, debt analysis, net worth, savings goals, reconciliation, forecasting, and explainable AI.

A weak transaction-only model would make transfers, liabilities, corrections, provenance, and reconciliation difficult to represent correctly.

## Decision

AfriFINOS will use a normalized financial domain centered on accounts, transactions, ledger entries, obligations, goals, assets, liabilities, providers, and provenance.

### 1. Accounts are first-class entities

An account represents a financial position or money store and is not synonymous with a provider account.

Supported conceptual account types include:

- Mobile-money wallet.
- Bank account.
- Cash wallet.
- SACCO account.
- Investment account.
- Loan account.

Provider-specific identifiers remain integration metadata.

### 2. Transactions represent source events

Transactions preserve what an external provider or user supplied.

They may subsequently be normalized, categorized, enriched, reconciled, or mapped into ledger entries.

Source facts must remain distinguishable from derived interpretations.

### 3. The internal ledger is authoritative

The financial engine operates on normalized authoritative ledger state rather than raw provider payloads.

The implementation should support double-entry-compatible semantics even if the first user-facing model is simpler.

This prepares the system for transfers, fees, reversals, liabilities, and reconciliation without redesigning the core later.

### 4. Transfers are distinct from income and expenses

Money moving between accounts owned by the same user or household is not income or expense by default.

The system must preserve transfer relationships when sufficient information exists.

This prevents users from artificially inflating income or spending by moving money between their own accounts.

### 5. Monetary values are exact

Persisted and authoritative monetary values must use exact decimal or integer-minor-unit representations appropriate to the currency.

Binary floating-point arithmetic is prohibited for authoritative money calculations.

Currency must always be explicit.

### 6. Provider data is normalized, not copied blindly

Every provider adapter maps external records into the AfriFINOS domain.

The normalized model must remain provider-agnostic while preserving enough source metadata to support reconciliation and debugging.

### 7. Provenance is part of the domain

Financial records should preserve:

- Source provider.
- External identifiers.
- Import batch or ingestion context.
- Original description/reference.
- Original timestamp.
- Transformation history where appropriate.
- Reconciliation state.

Provenance is required for trustworthy financial intelligence.

### 8. Historical facts are append-oriented

The system should avoid silently mutating historical financial facts.

Corrections, reversals, refunds, and adjustments should be represented explicitly and leave an audit trail.

### 9. Derived metrics are versioned

Metrics such as the Financial Health Score must have a methodology/version identifier.

Changing the scoring methodology must not make previously generated results impossible to explain.

## Domain Relationship

```text
User / Household
       │
       ├── owns ──► Account ──► Transaction ──► Ledger Entry
       │                  │             │
       │                  │             ├──► Category
       │                  │             └──► Provenance
       │                  │
       │                  └──► Provider
       │
       ├──► Asset
       ├──► Liability
       ├──► Obligation
       └──► Savings Goal
```

## Consequences

### Positive

- Provider integrations remain replaceable.
- Transfers can be distinguished from actual income and expenses.
- Reconciliation becomes a first-class concern.
- Financial metrics can be built on stable domain state.
- AI can consume verified facts without owning financial truth.
- The model can evolve toward stronger accounting semantics.

### Negative

- The domain model is more complex than a basic CRUD transaction table.
- Double-entry-compatible design increases upfront implementation work.
- Provenance and reconciliation require additional storage and processing.

These costs are accepted because correctness and long-term extensibility are more important than minimizing the initial schema.

## Rejected Alternatives

### Provider-native domain models

Rejected because each provider has different terminology, identifiers, and capabilities.

### Transactions-only model

Rejected because it cannot robustly represent liabilities, transfers, corrections, reconciliation, and accounting relationships.

### Graph database as the primary store

Rejected for the MVP. The conceptual financial graph can be represented relationally, while PostgreSQL provides mature transactional guarantees and querying. A graph database can be reconsidered if future workloads justify it.

### Floating-point monetary values

Rejected because binary floating-point is inappropriate for authoritative monetary arithmetic.

## Review Triggers

Revisit this ADR when:

- The first production provider integration is implemented.
- Double-entry posting rules are concretely implemented.
- Multi-currency conversion becomes a core workflow.
- Investment holdings or complex accounting are introduced.
- Regulatory requirements materially affect the domain model.
