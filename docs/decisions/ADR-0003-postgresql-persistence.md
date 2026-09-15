# ADR-0003: PostgreSQL Persistence

- Status: Accepted
- Date: 2026-09-15

## Context

AfriFINOS needs durable storage for user financial state while preserving the deterministic financial engine and provider-neutral domain model. Financial records must support exact money arithmetic, auditability, reconciliation, historical analysis, and efficient time-series queries.

## Decision

Use PostgreSQL as the system-of-record persistence layer.

The persistence boundary lives outside `financial-domain` and `financial-engine`. Repository contracts expose domain objects, while SQL migrations own the relational schema. Provider SDKs and AI SDKs must not become dependencies of the financial engine.

Authoritative monetary values are stored as integer minor units in PostgreSQL `BIGINT` columns, with an explicit ISO-style three-letter currency code. Floating-point columns are not used for authoritative money.

Ledger entries are append-oriented financial records linked to transactions and accounts. Provider balance observations remain observations used for reconciliation; they do not replace the internal ledger.

## Consequences

### Positive

- Strong transactional guarantees for transaction + ledger persistence.
- Mature indexing and querying for financial history and reporting.
- Exact storage for integer minor-unit monetary values.
- Clear separation between domain logic and infrastructure.
- Straightforward path to NestJS services and background workers.

### Negative

- Requires database operations, migrations, backups, and monitoring.
- UUIDs and relational constraints add infrastructure complexity compared with an in-memory MVP.
- Multi-currency reporting still requires explicit conversion policy; no implicit FX conversion is permitted.

## Invariants

1. Ledger amounts cannot be negative.
2. Transaction amounts cannot be negative.
3. External provider identifiers are unique within their provider scope when present.
4. Ledger entries reference existing transactions and accounts.
5. Provider observations are separate from authoritative ledger state.
6. Currency is stored with every monetary value.

## Deferred

The first migration does not attempt to encode every accounting rule as a database constraint. Application-level validation remains authoritative for balanced postings, transaction lifecycle transitions, ownership authorization, and complex reconciliation workflows.
