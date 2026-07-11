# Security Policy

## Reporting a vulnerability

If you find a security issue in AI Crawler Audit, please report it privately rather than opening a public issue.

Use [GitHub's private vulnerability reporting](https://github.com/JaydenYoonZK/ai-crawler-audit/security/advisories/new).

Please include steps to reproduce and, if you have one, a suggested fix.

## Scope

The interesting attack surface is untrusted input: robots.txt content, llms.txt content, crawler metadata, and URLs passed to the CLI. Reports about parser hangs, misleading audit results, terminal escape injection, URL handling, or anything that makes the tool say a crawler is blocked when it is not are in scope.

## Supported Versions

Security fixes are applied to the latest release. The tool has zero runtime dependencies by design; if you find that no longer true, that is also a bug worth reporting.
