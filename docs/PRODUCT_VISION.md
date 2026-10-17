# AfriFinos Product Vision

## North star

**One financial picture. Across your financial world.**

AfriFinos helps people understand their complete financial position when their money is spread across mobile money, banks, SACCOs, chamas, loans, cash, multiple currencies, cross-border services, and digital assets.

AfriFinos is an intelligence and reconciliation layer across financial services—not another institution that must replace the providers people already use.

## Strategy

- **Kenya first for validation.** Deliver a trustworthy, useful first experience around real Kenyan financial workflows and providers.
- **Africa-wide architecture from day one.** Avoid assumptions that every market uses the same currency, payment rail, identity system, provider, or regulatory model.
- **Provider-agnostic by design.** Integrations should be replaceable adapters, not hard-coded assumptions embedded in core financial logic.
- **Global compatibility over time.** Preserve currencies, timestamps, source identifiers, and cross-border context so new markets can be added without redesigning the financial model.
- **Trust before breadth.** A smaller set of accurate, reconciled data is better than a wide set of unreliable connections.

## The user problem

A person's financial life can be split across many places: M-Pesa, bank accounts, SACCOs, chama contributions, digital credit, cards, cash, remittance services, foreign-currency accounts, crypto wallets, and exchanges. Each provider shows only part of the picture.

AfriFinos should bring these records into one understandable view of:
- balances and net financial position;
- income, spending, and transfers;
- debts, repayments, and obligations;
- savings progress and goals;
- cash-flow trends and forward-looking affordability;
- assets and liabilities across currencies and providers.

## Product boundaries

The first product should aggregate, normalize, reconcile, and explain financial information. It should not imply that AfriFinos holds or controls funds merely because it displays them.

Payments, money movement, lending, custody, and exchange execution are separate product capabilities. Each requires explicit user consent, security controls, provider agreements, and applicable regulatory review before launch.

Crypto and other digital assets can be represented as part of a user's financial picture. The system must distinguish verified balances from estimates, preserve the asset and quote currencies, timestamp valuations, and avoid counting the same assets twice when they move between wallets or exchanges.

## Core architecture principles

### 1. Canonical financial model

Normalize provider-specific records into a shared model while retaining the original provider, source record ID, source timestamp, currency, and raw/reference metadata needed for audit and support.

Never erase the original amount or currency when calculating a converted total. Exchange rates should be explicit, timestamped, and traceable.

### 2. Provider adapters

Each provider integration should implement a common contract for supported capabilities, such as accounts, balances, transactions, liabilities, and refresh status. Providers will differ: one may offer an API, another a licensed aggregator, a statement import, or a user-entered record. Do not represent unsupported access as a live integration.

### 3. Reconciliation and duplicate prevention

Transfers between a user's own accounts are not income or spending. Repeated imports must be idempotent. Provider IDs, account ownership, transaction direction, timestamps, amounts, and currency should support matching while preserving uncertainty for review.

### 4. Data freshness and confidence

Every balance or record should carry provenance and freshness information. Distinguish live, recently synced, stale, estimated, manually entered, and unavailable data. Never silently present an old or estimated balance as confirmed current money.

### 5. Privacy, security, and consent

Collect the minimum data required. Make connected sources and permissions understandable, protect sensitive financial records, and support revocation and deletion workflows. Do not store provider credentials in ordinary application tables or logs.

### 6. Country and currency configuration

Country-specific rails, provider availability, tax concepts, identity requirements, and compliance rules belong in configuration and bounded modules—not global assumptions. Currency must be stored per record, not inferred from the user's country. Do not assume every currency is KES or every amount is comparable without conversion.

## Kenya-first delivery sequence

1. **Trustworthy foundation:** account/source model, secure authentication, canonical transaction model, idempotent ingestion, currency validation, auditability, and reliable tests.
2. **Useful financial picture:** import or connect a carefully chosen set of Kenyan sources; show balances, cash flow, spending categories, debts, and savings in one view.
3. **Reconciliation:** identify transfers between own accounts, duplicates, missing data, stale balances, and mismatched records; let users correct uncertain matches.
4. **Actionable intelligence:** cash-flow forecasts, repayment visibility, savings goals, and affordability insights with clear explanations and confidence levels.
5. **Expand coverage:** add providers and data access methods based on user demand, reliability, consent, and legal availability; then adapt the same core model to additional African markets.
6. **Digital assets and cross-border depth:** include crypto and foreign-currency positions through suitable data sources, with explicit valuation and duplicate-handling rules.

## Measures of success

Measure whether AfriFinos produces a more complete and trustworthy picture—not simply how many integrations it lists.

- Share of user financial activity represented with known source coverage.
- Duplicate and false-match rates.
- Reconciliation accuracy and unresolved discrepancy rate.
- Data freshness and sync failure rate by source.
- Percentage of displayed balances with clear provenance.
- User understanding of upcoming cash shortfalls, debt obligations, and goal progress.
- Time needed to connect sources and correct errors.

## Product test

For every new feature, ask:

1. Does it help users understand money that is currently scattered?
2. Is the information accurate, traceable, and clear about its limitations?
3. Does it work across providers and currencies without assuming one ecosystem?
4. Does it preserve user control and consent?
5. Can it be validated in Kenya now without blocking future markets?

If not, defer it or redesign it.
