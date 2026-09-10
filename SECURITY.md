# Security Policy

## Scope

AfriFINOS is an open-source financial intelligence project. Security is a first-class requirement because future versions may process sensitive financial information and integrate with financial providers.

## Supported Versions

Until the first stable release, only the latest version on the `main` branch is considered actively supported for security fixes.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Pre-release versions | Best effort |
| Older releases | No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, discussions, or social media.**

If you discover a potential vulnerability, contact the project maintainers privately through the security contact configured for this repository. Include:

- A clear description of the vulnerability.
- Affected component, version, commit, or endpoint.
- Steps required to reproduce it, where safe to provide them.
- Potential impact.
- Any suggested mitigation.

Please avoid including real financial data, credentials, access tokens, private keys, personal data, or other secrets in a report.

If a private security contact has not yet been configured, open a GitHub Security Advisory draft rather than publicly disclosing the issue.

## Responsible Disclosure

We ask security researchers to:

1. Give maintainers reasonable time to investigate and remediate a vulnerability before public disclosure.
2. Avoid accessing, modifying, deleting, or exfiltrating data that does not belong to them.
3. Avoid actions that could degrade availability or reliability of services.
4. Stop testing once sufficient evidence has been obtained.
5. Never use production credentials or real user financial data for testing.

We will make a good-faith effort to acknowledge valid reports, investigate them, and coordinate remediation and disclosure.

## Secrets and Financial Data

Never commit any of the following to this repository:

- API keys or access tokens
- M-Pesa/Daraja credentials
- Bank credentials
- Private keys or certificates
- Database credentials
- `.env` files containing secrets
- Real customer financial records
- Personally identifiable information
- Production configuration containing secrets

Use environment variables and approved secret-management systems for credentials.

## Security Development Principles

AfriFINOS follows these principles:

- Least privilege by default.
- No secrets in source control.
- Deterministic financial calculations must be independently testable.
- AI output must not be treated as authoritative financial ledger data.
- Financial actions must require explicit authorization and appropriate controls.
- Security-sensitive changes require review.
- Dependencies should be monitored and updated regularly.
- Security decisions should be documented in the repository when appropriate.

## Security Tooling

As the project grows, maintainers should enable appropriate GitHub security controls, including Dependabot, secret scanning/push protection, and code scanning where available. Public repositories expose their code to everyone, so GitHub recommends a security policy and security tooling as part of repository security hygiene.

## Legal and IP Note

This security policy does not grant permission to access systems, data, or infrastructure. Nothing in this document changes the project's license or any applicable law.

For potentially valuable security-sensitive inventions or other intellectual-property matters, maintainers should evaluate disclosure implications before publishing implementation details.
