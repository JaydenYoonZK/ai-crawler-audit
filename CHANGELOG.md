# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-07-07

### Added

- Paste and audit button that reads the clipboard and runs the audit in one step, with a keyboard-shortcut hint where clipboard access is restricted.

## [1.0.0] - 2026-07-07

First stable release.

### Added

- Browser audit of pasted robots.txt against a curated dataset of 17 AI crawlers and control tokens, each with vendor, purpose, documentation link, and notes.
- RFC 9309 matching: rule groups with stacked user-agents, longest-path precedence, allow winning ties, `*` and `$` wildcards, case-insensitive tokens.
- Per-crawler verdicts (allowed, partial, blocked, default) with plain-language explanations.
- Policy generator with three modes: block training only, block all AI crawlers, or allow everything with documentation.
- Structural checker for llms.txt files.
- Zero-dependency CLI for live sites: `npx github:JaydenYoonZK/ai-crawler-audit example.com`, including an llms.txt presence check.
- 14 Node tests, including a dataset integrity test and a generator-to-auditor round trip.

[1.1.0]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.1.0
[1.0.0]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.0.0
