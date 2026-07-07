# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Ambient 3D background scene: a wobbling glass cube, a faceted octahedron crystal, a shaded floating sphere, blurred distant shapes, twinkling star specks (dark mode only), and soft glow orbs, all drifting on slow organic paths with gentle mouse parallax on desktop. CSS transforms only, hidden on small screens, adapted per theme, frozen under reduced motion.
- Sticky navigation bar with brand, section links that highlight as you scroll, and smooth anchor scrolling.
- Light and dark mode toggle, persisted across visits, honoring the system preference on first visit, with a ?theme= URL override.
- Animated header illustration in the suite's mini-window style, hidden on small screens to keep mobile content-first.
- Scroll-to-top button that appears after scrolling.
- Emoji accents on section headings.

### Changed

- Entrance and hover motion throughout (CSS only, respects reduced-motion preferences).
- Removed textarea autofocus so the page no longer loads scrolled past the header.

### Fixed

- Scroll-to-top button no longer turns dark on hover (it was caught by the generic secondary-button hover rule).
- Reference tables now scroll inside their own container on narrow screens instead of widening the page.

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
