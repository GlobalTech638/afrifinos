# Contributing to AfriFINOS

Thank you for contributing to AfriFINOS. The project aims to build reliable, auditable financial intelligence infrastructure for African users and developers.

## Before You Start

Please read:

- `README.md` for project scope and roadmap.
- `SECURITY.md` for vulnerability reporting and security requirements.
- `GOVERNANCE.md` for project decision-making.
- `docs/decisions/ADR-0001-product-and-architecture-principles.md` for the initial architecture principles.

For substantial changes, open an issue or discussion before investing significant implementation effort. This helps avoid duplicate work and keeps the architecture coherent.

## Development Principles

Contributions should favor:

1. Correctness over cleverness.
2. Explicit domain models over implicit behavior.
3. Deterministic financial calculations over LLM-generated calculations.
4. Auditability and explainability over opaque automation.
5. Secure defaults and least privilege.
6. Small, reviewable changes.
7. Tests for financial logic and security-sensitive behavior.
8. Documentation for non-obvious architectural decisions.

## Financial Domain Rules

Financial software has a higher correctness bar than ordinary application code.

- Never silently change historical financial records.
- Preserve transaction provenance where possible.
- Use precise monetary representations; do not use binary floating-point arithmetic for authoritative money calculations.
- Make currency explicit in financial records and calculations.
- Keep ledger calculations deterministic and independently testable.
- AI may classify, summarize, explain, or recommend, but must not become the source of truth for balances or ledger state.
- Financial actions, especially payments or transfers, require explicit authorization and appropriate controls.

## Repository Structure

The repository is expected to evolve toward:

```text
apps/       Application frontends and user-facing services
packages/   Reusable domain and infrastructure packages
services/   Backend services and integration boundaries
docs/       Architecture, decisions, security, and product documentation
tests/      Cross-component and domain-level tests
```

Keep domain logic reusable and avoid coupling core financial logic to a particular UI or provider.

## Making a Change

1. Create or update an issue describing the problem and intended outcome.
2. For architectural changes, add or update an ADR under `docs/decisions/`.
3. Create a focused branch from `main`.
4. Implement the smallest coherent change.
5. Add or update tests.
6. Update documentation when behavior, APIs, security assumptions, or architecture changes.
7. Run the relevant checks locally.
8. Open a pull request with a clear description of the problem, solution, testing, and security implications.

## Pull Requests

A good pull request should explain:

- What changed.
- Why it changed.
- How it was tested.
- Any migration or compatibility implications.
- Any security or privacy implications.
- Any follow-up work that is intentionally out of scope.

Keep unrelated refactors out of feature or bug-fix pull requests.

## Tests

At minimum, new domain behavior should include tests covering:

- Normal cases.
- Boundary conditions.
- Invalid input.
- Currency and precision behavior where relevant.
- Authorization behavior where relevant.
- Regression cases for fixed bugs.

Financial calculations should have deterministic test vectors whenever practical.

## Commit Messages

Use concise, imperative commit messages. Conventional Commits are encouraged:

```text
feat: add transaction normalization
fix: correct debt ratio calculation
docs: document ledger invariants
test: add health score edge cases
refactor: isolate provider adapter
```

## Sensitive Information

Never commit credentials, secrets, private keys, real customer financial records, or production personal data. See `SECURITY.md`.

When working with integrations, use sandbox/test credentials and synthetic data.

## Intellectual Property

The project is licensed under the GNU Affero General Public License v3.0. Contributions must be compatible with that license and the project's contribution process.

Do not publish confidential partner information, non-public financial-provider details, proprietary datasets, or potentially patentable implementation details without appropriate authorization and review.

## Code Review

Reviewers should prioritize, in order:

1. Security and privacy.
2. Financial correctness and data integrity.
3. Backward compatibility and migration safety.
4. Test coverage and observability.
5. Maintainability and clarity.
6. Performance and optimization.

A change should not be approved merely because it works in a happy-path demo.

## Community Conduct

Participation is subject to the project's `CODE_OF_CONDUCT.md`. Be constructive, technical, and respectful.
