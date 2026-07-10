# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.2] - 2026-07-10

### Changed

- Light mode's palette is rebuilt around fresh hues instead of darkened earth tones. The accent is now a vivid deep green, success is emerald, the warning orange is clear instead of brown, and the red is brighter. Chip and pill washes are tinted from bright brand colors rather than from the dark text colors, so they read as lively pastels instead of a gray film, and the light-mode decorative constants (page glow, cube wireframes, spheres) moved from olive to brand chartreuse. Every rendered text pair was re-measured at 4.5:1 or better on the live page; dark mode is untouched.
- The README preview is regenerated to show the new light palette beside dark mode.

## [1.3.1] - 2026-07-10

### Added

- CI now runs the test suite and CLI help/version smoke checks on Linux, Windows, and macOS.
- Security reporting is documented through GitHub private vulnerability reports.
- CLI regression tests cover help, version, missing targets, invalid targets, and unknown flags.

### Fixed

- The CLI now rejects invalid domains, URLs with spaces, and unknown flags instead of silently auditing a bad target.
- The README stars badge now links to the repository page instead of the zero-star `/stargazers` page that GitHub returns as 404.
- The browser tool cache-busts its engine module and crawler dataset fetch so Pages serves the current audited code.

## [1.3.0] - 2026-07-09

### Fixed

- Rules split across multiple groups for the same crawler are now combined, as RFC 9309 and Google's crawlers do. A robots.txt that repeats `User-agent: GPTBot` (or `User-agent: *`) in two separate blocks used to have its second block silently ignored, so the tool could call a path allowed that a compliant crawler treats as blocked. It now merges every block naming the agent, and a specific group still suppresses the `*` group as before.

### Added

- A Content Security Policy on the browser tool. The audit runs entirely in your browser and the only request is for the page's own crawler dataset, so the policy allows exactly that (`connect-src 'self'`) and blocks everything else. Your robots.txt is never sent anywhere. Verified in a browser: the dataset still loads and a request to any other origin is blocked.

### Changed

- Accessibility: both paste boxes now have real labels instead of one hidden with `display:none` and one with none at all.
- 17 tests, up from 14, with three new ones pinning the group-merging behavior.

## [1.2.5] - 2026-07-09

### Changed

- Light mode's status colors are livelier and now measurably meet WCAG AA. The olive green, brown amber, and muted red came from darkening alone, which made them muddy; they are replaced with fully saturated deep equivalents (accent #4c7a00, green #1d7a25, orange #ba4700, red #c62a22), the soft chip tints were eased to match, primary buttons in light mode use white text on the deep accent, and light muted text was deepened one step. Measured on the rendered page, every status pill, link, button label, and muted text now sits at 4.5:1 or better; the previous accent and the muted text on tinted chips quietly failed. Dark mode is untouched.

## [1.2.4] - 2026-07-09

### Added

- The hero illustration now has a light-mode version. It is the same inline drawing recolored through the theme tokens, so it follows the theme toggle instantly and always stays in step with the palette. Dark mode is unchanged.

## [1.2.3] - 2026-07-09

### Fixed

- Clicking a menu item now always highlights the item you clicked. The highlight was driven by an observer watching a band in the middle of the viewport, but a menu jump lands the section heading at the top, outside that band, so the green pill often stayed on a section the page had merely scrolled past. The active item is now computed directly from the scroll position: the last section whose heading sits above the reading line under the header, with the last section winning at the very bottom of the page.

## [1.2.2] - 2026-07-09

### Changed

- The menu now sits in its own tinted band under the brand bar on every screen size, giving the header a clear hierarchy: brand and theme toggle on top, menu below, every item always visible. The whole header is sticky again on all devices, and section jumps measure the header instead of assuming its height, so they land exactly below it however many rows the menu wraps to.

## [1.2.1] - 2026-07-09

### Fixed

- On phones the menu no longer hides items behind an invisible horizontal scroll. Below 720px it wraps onto its own row under the brand with every item visible and centered, and the bar scrolls away with the page instead of pinning several rows to a small screen; the back-to-top button brings it back into reach. Desktop keeps the single sticky row, and section jumps account for the new offsets.

## [1.2.0] - 2026-07-09

### Added

- Ambient 3D background scene with depth of field: eleven glass cubes and shaded spheres from overly large to tiny, near and far sphere pairs on both sides, blur increasing with distance, balanced across both margins, drifting on slow organic paths with wobbling multi-axis tumbles, twinkling star specks in three parallax depth layers with varied size and blur (dark mode only), mouse parallax, and scroll parallax that reveals deeper shapes as the page moves. CSS transforms only, hidden on small screens, adapted per theme, frozen under reduced motion.
- Sticky navigation bar with brand, section links that highlight as you scroll, and smooth anchor scrolling.
- Light and dark mode toggle, persisted across visits, honoring the system preference on first visit, with a ?theme= URL override.
- Animated header illustration in the suite's mini-window style, hidden on small screens to keep mobile content-first.
- Scroll-to-top button that appears after scrolling.
- Emoji accents on section headings.

### Changed

- Entrance and hover motion throughout (CSS only, respects reduced-motion preferences).
- Removed textarea autofocus so the page no longer loads scrolled past the header.

### Fixed

- The Paste button works on iPhone and iPad again. The previous touch flow skipped the iOS clipboard confirmation and waited for a manual paste that most people never discover, so the button looked dead. The clipboard is now requested the same way on every device: iOS shows its Paste confirmation at the tap point, and confirming it fills the box and runs the audit in one motion. If the read is declined, the box is focused with a hint and the audit runs by itself as soon as a paste lands. An empty clipboard now says so.
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

[1.3.2]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.2
[1.3.1]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.1
[1.3.0]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.0
[1.2.5]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.2.5
[1.2.4]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.2.4
[1.2.3]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.2.3
[1.2.2]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.2.2
[1.2.1]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.2.1
[1.2.0]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.2.0
[1.1.0]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.1.0
[1.0.0]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.0.0
