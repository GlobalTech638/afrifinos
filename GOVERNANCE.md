# AfriFINOS Governance

AfriFINOS is an open-source project building financial intelligence infrastructure for Africa. Governance exists to keep the project technically coherent, security-conscious, and aligned with its mission while remaining welcoming to external contributors.

## Principles

Project decisions should optimize for:

- User safety and financial-data privacy.
- Correctness and auditability.
- Long-term maintainability.
- Interoperability across African financial ecosystems.
- Open-source collaboration.
- Clear separation between deterministic financial infrastructure and probabilistic AI behavior.
- Sustainable project stewardship.

## Roles

### Maintainers

Maintainers are trusted contributors with responsibility for:

- Reviewing and merging pull requests.
- Protecting the integrity of the main branch.
- Managing releases.
- Responding to security reports.
- Resolving routine technical disputes.
- Maintaining project documentation and contributor processes.

Maintainer status is earned through sustained, high-quality contribution and sound judgment. It is not based solely on commit volume.

### Contributors

Anyone may contribute subject to the project's license, contribution guidelines, and code of conduct.

Contributors are encouraged to participate through issues, documentation, tests, bug fixes, features, architecture proposals, and integration work.

## Decision Making

### Routine Changes

Small bug fixes, documentation changes, tests, and low-risk improvements may be merged through normal pull-request review.

### Significant Technical Changes

Changes affecting core financial models, data integrity, security boundaries, provider integrations, public APIs, or deployment architecture should receive maintainer review and, where appropriate, an Architecture Decision Record (ADR).

### Architectural Decisions

ADRs live under `docs/decisions/` and record durable decisions, context, alternatives, and consequences. An ADR should be preferred over relying on undocumented knowledge in a discussion thread.

### Security Decisions

Security-sensitive decisions receive elevated scrutiny. Vulnerabilities must follow `SECURITY.md` and should not be disclosed through normal public issue channels before responsible remediation.

## Main Branch

`main` is the primary integration branch.

The project should move toward protected-branch controls as development accelerates, including required reviews and automated checks before merging material changes.

## Releases

Release practices will mature as the project approaches its first stable version. Maintainers should document release notes, migration requirements, and security-impacting changes.

No release should knowingly introduce a breaking financial-data migration without an explicit migration strategy.

## Conflicts of Interest

Contributors should disclose material conflicts of interest when they could affect a technical, partnership, security, or governance decision.

Maintainers should avoid using project authority to favor undisclosed personal or commercial interests.

## Intellectual Property

The open-source repository is licensed under the GNU Affero General Public License v3.0 as specified by the repository's license file.

Project stewardship must distinguish between:

- Open-source code contributed to this repository.
- Third-party code and licenses.
- Confidential information belonging to users or partners.
- Company-owned proprietary assets that are intentionally kept outside the open-source repository.

Potentially valuable inventions, trademarks, confidential integrations, and other intellectual-property matters should be evaluated before public disclosure.

## Changes to Governance

This governance document may evolve as the contributor base and project maturity grow. Material governance changes should be proposed through a pull request or documented issue and reviewed by maintainers.

The goal is not bureaucracy. The goal is predictable stewardship, especially where financial software and user trust are involved.
