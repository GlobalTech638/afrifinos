# AfriFINOS Financial Domain Model

## Goal

This document defines the initial domain vocabulary and invariants for AfriFINOS. It is intentionally implementation-neutral: database tables, API DTOs, and provider payloads must not define the financial domain by accident.

## Core Concepts

### User

A person who owns or controls financial data within an AfriFINOS tenant.

A user may have multiple accounts, goals, assets, liabilities, and relationships.

### Household

An optional grouping of users whose finances are analyzed together.

Household support is not required for the first MVP, but the domain should avoid assumptions that one user always represents one economic unit.

### Account

A container representing a financial position or money store.

Examples:

- Mobile-money wallet.
- Bank account.
- Cash wallet.
- SACCO account.
- Investment account.
- Loan account.

An account has an owner, currency, type, lifecycle status, and optional external provider identity.

### Transaction

A source-level financial event representing movement or adjustment of value.

A transaction should preserve source facts and provenance. It may subsequently be categorized or enriched.

Suggested conceptual fields:

```text
id
account_id
occurred_at
amount
currency
transaction_type
status
counterparty
description
external_reference
source_provider
source_record_id
import_batch_id
created_at
updated_at
```

The exact schema is intentionally deferred until implementation.

### Ledger Entry

A normalized accounting representation used by the financial engine.

The ledger is the authoritative internal representation for monetary state. A provider transaction may map to one or more ledger entries depending on the domain model.

The project should prefer double-entry-compatible semantics even where the first MVP exposes a simpler transaction interface. This gives the system a stronger foundation for transfers, fees, reversals, liabilities, and reconciliation.

### Category

A normalized semantic classification for a transaction or financial activity.

Examples:

- Salary.
- Business income.
- Food.
- Housing.
- Transport.
- Utilities.
- Debt repayment.
- Savings.
- Investment.
- Transfer.
- Fees.

Categories are analytical metadata, not monetary truth.

### Obligation

A future or recurring financial commitment.

Examples:

- Loan repayment.
- Rent.
- School fees.
- Subscription.
- Utility bill.
- Insurance premium.

Obligations are important to forecasting because current balance alone does not describe available financial capacity.

### Savings Goal

A user-defined target amount with a target date or priority.

A goal should track target, current allocation, currency, target date where applicable, and status.

### Asset

A resource with economic value that contributes to net worth.

Examples include investment holdings, property, or other user-declared assets.

### Liability

An obligation with an outstanding economic value that reduces net worth.

Loans and other debts should be modeled as liabilities rather than merely negative transactions.

### Provider

An external financial institution or data source.

Provider identity belongs at the integration boundary. The core domain should not depend on provider-specific concepts unless those concepts have a stable domain meaning.

### Provenance

Metadata describing where a financial fact originated and how it changed.

Provenance is required for trustworthy ingestion, reconciliation, debugging, and explainability.

## Monetary Representation

Authoritative monetary values must be represented exactly.

Do not use IEEE-754 binary floating-point values for persisted monetary amounts or authoritative financial calculations.

A practical implementation may use:

- PostgreSQL `NUMERIC`/`DECIMAL` for persisted values.
- Integer minor units where currency rules permit and are explicitly modeled.
- A decimal arithmetic library in application code.

Currency is always explicit.

## Transaction Semantics

Transactions must distinguish at least:

- Credit/inflow.
- Debit/outflow.
- Transfer.
- Fee.
- Reversal/refund.
- Adjustment.

A transfer between two owned accounts must not be treated as income or expense merely because it appears as an inflow or outflow on an individual account.

This distinction is critical to accurate cash-flow and spending analytics.

## Balance Semantics

An account balance is a deterministic derivation from the authoritative ledger and applicable adjustments.

Imported provider balances may be stored as external observations for reconciliation, but an LLM must never determine an authoritative balance.

Where an external provider reports a balance that differs from the internally reconstructed balance, the system should surface a reconciliation discrepancy rather than silently choosing one.

## Financial Graph

Conceptually, AfriFINOS forms a graph:

```text
User / Household
      │
      ├── owns ──► Account
      │              │
      │              └── contains ──► Transaction
      │                                  │
      │                                  ├── categorized_as ──► Category
      │                                  └── sourced_from ──► Provider
      │
      ├── has ──► Asset
      │
      ├── owes ──► Liability / Obligation
      │
      └── pursues ──► Savings Goal
```

The graph is conceptual rather than a requirement to use a graph database. PostgreSQL relational modeling can represent these relationships effectively for the MVP.

## Financial Health Score Inputs

The initial Financial Health Score should be a deterministic function of verified financial state.

Potential components:

1. Cash-flow stability.
2. Savings rate.
3. Emergency runway.
4. Debt burden.
5. Essential-expense coverage.
6. Spending volatility.
7. Goal progress.

The scoring methodology must be versioned. A score generated under methodology version `v1` must remain explainable even after `v2` is introduced.

## Invariants

These are foundational invariants for the financial domain.

### Money

- Every monetary amount has a currency.
- Authoritative monetary arithmetic is exact.
- Zero and sign semantics are explicit.
- Rounding rules are explicit and deterministic.

### Transactions

- A transaction cannot reference an account outside the authorized tenant.
- Source identifiers are preserved where available.
- Duplicate ingestion must be detectable and idempotent.
- Historical source facts are not silently overwritten.

### Transfers

- Transfers between owned accounts are not income or expense by default.
- A transfer should have a traceable relationship between source and destination where the data permits.

### Ledger

- Ledger state must be reproducible from persisted authoritative records.
- Financial calculations must not depend on LLM output.
- Corrections should preserve an audit trail.

### AI

- AI-generated classifications are not authoritative without validation.
- AI-generated financial explanations must be grounded in verified state.
- AI cannot directly authorize money movement.

### Reconciliation

- External provider observations and internal calculations must remain distinguishable.
- Reconciliation discrepancies must be observable.

## Lifecycle

A typical imported transaction progresses through:

```text
RECEIVED
   ↓
VALIDATED
   ↓
NORMALIZED
   ↓
DEDUPLICATED
   ↓
POSTED
   ↓
ENRICHED
   ↓
RECONCILED
```

Not every source will support every stage. State transitions must be explicit rather than inferred from missing fields.

## What We Are Not Modeling Yet

The initial domain deliberately postpones:

- Direct payment execution.
- Lending decisions.
- Credit scoring for third-party underwriting.
- Insurance underwriting.
- Custody of investment assets.
- Tax filing execution.
- Complex accounting consolidation.

These domains may introduce additional regulatory, security, and accounting requirements and should receive dedicated design work before implementation.
