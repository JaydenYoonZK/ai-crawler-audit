# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.16] - 2026-07-10

### Fixed

- The theme toggle now turns and swells on hover on every page, the playful twist that until now only the WHMCS Emoji Compatibility Guide showed. All pages always shared the same hover rule, but a more specific button rule was overriding its transform with the standard key lift on the other tools. The toggle's hover and press rules now outrank the tactile key rules everywhere.
- Hovers and tooltips respond during the theme crossfade again. The crossfade overlay intercepts pointer input by default, which deadened the page, most noticeably the toggle's own hover twist and tooltip, for half a second after every theme switch. The live page underneath now stays interactive while the fade plays, matching how immediate the toggle felt before the fade shipped.

## [1.3.15] - 2026-07-10

### Fixed

- Tooltip arrows are visible again. The arrow is a bordered square whose colored wedge sat entirely behind the tooltip bubble, which paints later and shares the same ink color, so the bubble swallowed the arrow and nothing bridged the gap to the button. The arrow now sits with its tip in the gap, 4px off the button, and its base tucked one pixel under the bubble edge, painting above the bubble so the two read as a single speech-bubble shape. Both variants are fixed, the standard bubble above a button and the theme toggle's bubble below it.

## [1.3.14] - 2026-07-10

### Fixed

- The theme crossfade no longer stutters on phones. The browser's default crossfade blends the old and new page snapshots with a plus-lighter blend inside an isolated compositing group, which means two full-screen render passes every frame. Desktop GPUs absorb that, phone GPUs drop frames. The new page now sits fully opaque underneath while the old snapshot simply fades out above it, which reads identically on an opaque page and costs a single alpha layer. Decorative drift animations also pause for the half second the fade runs, freeing GPU headroom on mobile without any visible freeze.

## [1.3.13] - 2026-07-10

### Fixed

- Text no longer flashes and re-settles mid fade when switching between light and dark mode. Text color inherits, so during the old per-element fade every element kept re-easing its parent's already animating color, which made type lag behind the page and snap late. The switch now crossfades the whole page as a single composited snapshot through the View Transitions API, so text and background move together in one smooth pass. The theme toggle is excluded, so its sun and moon morph still plays live. Browsers without view transitions fall back to fading backgrounds, borders and shadows only, with text changing in one clean step.

## [1.3.12] - 2026-07-10

### Fixed

- The inline code chip inside alerts no longer renders as a dead grey block in light mode. Its 35% black wash was tuned for dark backgrounds; over the light pink alert it read as mud. In light mode the chip is now a crisp near-white card with a hairline red keyline, so the decoded payload stands out cleanly.

### Changed

- Switching themes now fades the whole page between night and day over half a second instead of snapping instantly, which could startle or dazzle, especially dark to light at night. The fade covers colors only (backgrounds, text, borders, shadows, SVG fills), and the theme toggle is excluded so its sun and moon morph keeps its own spring timing.

## [1.3.11] - 2026-07-10

### Fixed

- The theme toggle now shows the crescent moon on phones. The previous build morphed the mark by animating SVG geometry (the circle's radius and the mask position) from CSS, which desktop browsers support but iOS Safari does not apply, so dark mode on a phone showed a plain dot instead of a moon. The switch is rebuilt on opacity and transform only, the sun spins away as a true crescent path spins in, which every mobile browser animates. Same look on desktop, now correct everywhere.

## [1.3.10] - 2026-07-10

### Changed

- The theme toggle is redesigned from an emoji swap into a morphing mark. One vector drawing plays the whole switch: the sun's core grows into the moon while a masked bite slides in to carve the crescent, the eight rays spring away with an overshoot, and the mark tilts to seat the crescent, all reversed when switching back. The moon is brand chartreuse at night and the sun is warm amber by day, the round button trades the key edge for a soft brand halo on hover, and a tooltip appears below it saying which mode a click will switch to, on hover and keyboard focus only, never on touch. The morph is disabled under reduced-motion preferences.
- The README preview is regenerated.

## [1.3.9] - 2026-07-10

### Fixed

- The back-to-top button no longer casts a heavy black smudge in light mode. Its shadow was a single wide dark-theme blur that was never re-tuned for a cream background. Each theme now gets a layered shadow of its own: a tight warm contact shadow plus a soft chartreuse halo in light mode, and a grounded contact shadow with a gentle chartreuse under-glow in dark, with matching hover and pressed variants.

## [1.3.8] - 2026-07-10

### Changed

- Removed the pulsing status dot from the privacy pill. The animated dot has become one of the most recognizable template cliches on the web, and it was redundant next to the lock icon that already carries the meaning. The pill now leads with the lock alone, with its padding evened out.
- The README preview is regenerated.

## [1.3.7] - 2026-07-10

### Added

- Tactile depth across the interface. Every button is now built like a physical key: a hard edge shadow beneath it, a soft ambient shadow, and a hairline top bevel. Hovering lifts the key slightly, and pressing travels it down while the edge collapses underneath, a real press you can feel. Primary buttons carry a chartreuse edge and glow, secondary buttons use a warm brand-brown edge in light mode and a deep neutral one in dark, disabled buttons stay flat since a dead control should not look pressable, and the movement is disabled under reduced-motion preferences while the shadow feedback remains. Cards gain a quiet layered elevation per theme.
- The README preview is regenerated.

## [1.3.6] - 2026-07-10

### Fixed

- The menu's hover state no longer turns grey, and no longer sticks. Hovering used a grey panel tone that clashed with the brand language, and on phones a tap glued that grey pill to the last-tapped item because touch browsers keep a sticky hover. Hover styling now only applies on devices with a real pointer and uses a faint chartreuse brand tint, while the active item keeps the stronger chartreuse wash and always wins when it is both hovered and active.
- The active menu item now also carries `aria-current`, so screen readers hear which section you are in, kept in sync with the highlight by the same scroll logic.

## [1.3.5] - 2026-07-10

### Changed

- Light mode brings the brand home. The signature chartreuse #abcf37 button with dark ink text, the same button dark mode has always had, is now the primary action in light mode too, and chartreuse drives the accent washes, the menu band, the page glow, and the decorative scene. The airy cream background and crisp white cards return, links use a fresh deep green that passes AA on every chartreuse wash, and the verdict colors return to the vivid set with bright washes. Every rendered text pair measures 4.5:1 or better on the live page (the brand button measures above 10:1), and the dark theme is untouched.
- The README preview is regenerated for the new palette.

## [1.3.4] - 2026-07-10

### Changed

- Light mode now uses the studio palette chosen from design references: sand background #EEE3CF, warm ivory cards, coral #FE6E54 primary buttons with dark ink text (mirroring dark mode's dark-on-chartreuse buttons), a deep coral accent for links and highlights, sage #93A86C washes with the dark green #375554 as success text, a pale gold #FCDB99 wash under warning pills, teal #40A5A0 washes with indigo #363D6E as info text, and a coral, sage, and teal decorative scene. Every rendered text pair measures 4.5:1 or better on the live page, and the dark theme is untouched.
- The README preview is regenerated for the new palette.

## [1.3.3] - 2026-07-10

### Changed

- Light mode is redesigned around a warm editorial palette inspired by premium product sites: terracotta coral becomes the accent for buttons, links, and highlights, the success wash turns sage, the danger red deepens toward crimson so it stays clearly apart from the coral, type warms one step browner, the menu band turns soft sage, and the decorative scene (orbs, spheres, cube wireframes) moves to coral, sage, and warm brown. The cream background and the whole dark theme are untouched, and every rendered text pair measures 4.5:1 or better on the live page.
- The README preview is regenerated for the new light palette.

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

[1.3.16]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.16
[1.3.15]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.15
[1.3.14]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.14
[1.3.13]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.13
[1.3.12]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.12
[1.3.11]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.11
[1.3.10]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.10
[1.3.9]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.9
[1.3.8]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.8
[1.3.7]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.7
[1.3.6]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.6
[1.3.5]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.5
[1.3.4]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.4
[1.3.3]: https://github.com/JaydenYoonZK/ai-crawler-audit/releases/tag/v1.3.3
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
