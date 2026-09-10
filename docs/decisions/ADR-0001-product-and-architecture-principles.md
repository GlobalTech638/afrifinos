# ADR-0001: AfriFINOS Product and Architecture Principles

- **Status:** Accepted
- **Date:** 2026-09-10
- **Decision owners:** Project maintainers
- **Scope:** Product, domain architecture, security, AI boundaries, and integration strategy

## Context

AfriFINOS is intended to become an Africa-first financial intelligence platform that helps people understand and act on their financial position across fragmented financial channels such as mobile money, banks, SACCOs, cash, loans, savings, and investments.

The project must balance three properties that are often in tension:

1. **Financial correctness** — balances, transactions, ratios, forecasts, and other authoritative calculations must be reproducible and auditable.
2. **AI usefulness** — users should be able to ask questions, receive explanations, detect patterns, and obtain personalized insights.
3. **Open ecosystem design** — the platform should support multiple providers and contributors without making the core domain model dependent on one institution or integration.

Because financial data is sensitive and financial decisions can have material consequences, architectural ambiguity is unacceptable at the foundation of the project.

## Decision

AfriFINOS adopts the following principles.

### 1. Africa-first, provider-agnostic

The product will be designed around the realities of African financial ecosystems, including mobile money, banks, SACCOs, cash, informal financial activity, and multiple currencies.

Provider integrations must sit behind explicit adapters or integration boundaries. Core financial logic must not depend directly on one provider's API.

### 2. The ledger is deterministic

Authoritative financial state must be represented by deterministic domain logic.

Balances, transaction amounts, account state, debt calculations, cash-flow calculations, financial ratios, and other authoritative outputs must be computable without an LLM.

Money calculations must use precise representations appropriate for financial software rather than binary floating-point arithmetic.

### 3. AI is an analyst, not the ledger

LLMs and other probabilistic models may:

- Categorize or enrich transactions.
- Summarize financial activity.
- Explain deterministic calculations.
- Detect potential patterns or anomalies.
- Generate forecasts where the underlying methodology is explicit.
- Help users explore scenarios.
- Recommend actions for user consideration.

AI must not silently become the authoritative source of balances, transaction amounts, ledger state, permissions, or completed financial actions.

Where AI produces a financial claim, the system should preserve enough provenance to distinguish source data, deterministic computation, and model-generated interpretation.

### 4. Financial intelligence should be explainable

Important outputs such as a Financial Health Score must expose their inputs, methodology, and contributing factors.

A user should be able to move from an insight to the underlying financial records and calculations whenever practical.

### 5. User financial data is sensitive

Financial information must be treated as high-sensitivity data.

The system should apply least privilege, encryption in transit and at rest where appropriate, secure secret handling, tenant isolation, audit logging for sensitive operations, and explicit data-retention practices.

The project will not place real user financial data in source control or test fixtures.

### 6. Explicit authorization for financial actions

AfriFINOS may eventually support actions such as transfers, payments, or other provider operations.

No financial action should be executed solely because an AI model suggested it. Any action that can move money or materially alter financial state must have explicit user authorization and appropriate authentication, authorization, idempotency, audit, and fraud-prevention controls.

The initial product will focus on intelligence and analysis rather than autonomous payment execution.

### 7. Build a normalized financial graph

The domain model should connect:

- Users and households.
- Accounts.
- Transactions.
- Income.
- Expenses.
- Debts and obligations.
- Savings goals.
- Assets and investments.
- Recurring commitments.
- Financial institutions and providers.

The normalized model is intended to become the stable boundary between imported provider data and downstream analytics.

### 8. Provider integrations are replaceable

M-Pesa, banks, SACCOs, investment platforms, and other providers must be modeled as integrations rather than as the financial domain itself.

Integration code should normalize provider-specific records into stable AfriFINOS domain objects while retaining provenance and provider identifiers where needed for reconciliation.

### 9. Open-source core, commercial services where appropriate

The repository's open-source core is licensed under AGPL-3.0 as defined by the repository license.

The project may later offer hosted services, enterprise capabilities, managed infrastructure, proprietary operational systems, or other commercial services, provided their implementation and licensing are deliberately separated and legally reviewed.

Open-source licensing is not considered a substitute for product differentiation. Long-term defensibility should come from distribution, integrations, trust, ecosystem adoption, operational capability, and user value.

### 10. Document important decisions

Architectural decisions that are difficult to reverse, affect multiple components, establish security boundaries, or materially affect the product direction should be documented as ADRs.

### 11. Security is part of the architecture

Security is not a final-stage feature. Threat modeling, dependency management, access control, secret management, auditability, and secure data handling should be considered during design and implementation.

Security-sensitive functionality should fail closed where practical.

### 12. Design for incremental evolution

The system should support the following progression without requiring a rewrite of the core domain model:

```text
Manual / CSV data
        ↓
Provider ingestion
        ↓
Normalization
        ↓
Financial ledger / graph
        ↓
Deterministic financial engine
        ↓
Financial health and forecasting
        ↓
AI analyst
        ↓
Optional user-authorized actions
```

The initial implementation should not prematurely introduce autonomous agents, direct payment execution, or unnecessary provider coupling.

## Initial MVP Boundary

The first meaningful product slice should support:

- User authentication.
- Accounts for mobile money, bank, cash, SACCO, investment, and loan contexts.
- Manual and CSV transaction ingestion.
- Transaction normalization and categorization.
- Deterministic cash-flow and balance calculations.
- Net worth and debt views.
- Savings goals.
- An explainable Financial Health Score.
- An AI analyst that consumes verified financial state and explains it to the user.

M-Pesa and bank API integrations should follow once the domain model and reconciliation boundaries are stable.

## Consequences

### Positive

- Financial calculations remain testable and auditable.
- AI can evolve without becoming the source of truth.
- Provider integrations can change without rewriting core financial logic.
- The architecture supports multiple African financial ecosystems.
- Security and privacy requirements are established before sensitive integrations are introduced.
- Future commercial services can be developed without abandoning the open-source core.

### Negative

- The architecture requires more upfront domain modeling than a simple CRUD expense tracker.
- Deterministic financial logic and provenance add implementation complexity.
- Provider adapters require ongoing maintenance.
- Explainability limits some forms of opaque automation.
- Strong security controls may slow early experimentation slightly.

These costs are intentional because the project's domain is financial software rather than a generic consumer application.

## Rejected Alternatives

### Build an AI chatbot first

Rejected. A conversational interface without a trustworthy financial state creates a system that can sound intelligent without having a reliable model of the user's finances.

### Let the LLM calculate balances

Rejected. Probabilistic models are not an acceptable authority for deterministic monetary state.

### Build directly around one provider

Rejected. This would make the platform brittle and limit the domain model to one provider's abstractions.

### Start with autonomous payments

Rejected. Payment execution introduces materially higher security, compliance, fraud, authorization, and operational requirements. Intelligence and user-approved workflows come first.

### Build another generic expense tracker

Rejected. The strategic goal is financial intelligence: understanding relationships among cash flow, debt, savings, obligations, and assets, rather than only recording expenses.

## Review Triggers

Revisit this ADR when any of the following occur:

- The first production financial integration is introduced.
- The product begins executing financial actions.
- A new financial domain such as lending, insurance, or investment execution is introduced.
- The core ledger model changes materially.
- A regulated financial service is introduced.
- The licensing or open-core strategy changes.
- New privacy, security, or compliance requirements materially affect the architecture.
