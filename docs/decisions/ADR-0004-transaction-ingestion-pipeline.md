# ADR-0004: Transaction ingestion pipeline

- Status: Accepted
- Date: 2026-09-15

## Context

AfriFINOS receives financial records from manual entry, CSV imports, and eventually provider APIs/files. These sources are untrusted inputs and may contain inconsistent descriptions, duplicate records, signed amounts, or provider-specific identifiers.

The authoritative financial ledger must not depend on an LLM or on provider-specific parsing logic.

## Decision

Transaction ingestion follows this order:

```text
Raw input
  -> normalize
  -> deterministic categorization
  -> deduplicate
  -> construct domain transaction
  -> construct balanced ledger entries
  -> persist transaction + ledger atomically
```

The application layer owns orchestration but does not own financial calculations. Normalization, categorization, deduplication, and ledger construction remain deterministic libraries.

A transaction and its ledger entries are persisted through a single repository operation so a transaction cannot become authoritative without its balanced ledger representation.

Provider or import external IDs are used as the strongest deduplication key when available. Fingerprints are used only as a fallback because identical legitimate transactions can exist.

## Consequences

- Provider integrations can feed the same application pipeline.
- CSV/manual imports and future APIs share identical financial semantics.
- The LLM remains outside authoritative state creation.
- Persistence implementations can change without changing the ingestion contract.
- Idempotency and collision handling remain explicit application concerns.
