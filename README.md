# AI Crawler Audit 🤖

See exactly which AI crawlers your robots.txt allows or blocks, understand what each one actually does, and generate a policy you chose on purpose. Works on pasted robots.txt in the browser, or against live sites with the bundled CLI.

<p>
  <a href="https://jaydenyoonzk.github.io/ai-crawler-audit/"><img src="https://img.shields.io/badge/Live%20tool-open-abcf37?style=for-the-badge&logo=githubpages&logoColor=black" alt="Open the live tool"></a>
  <a href="https://github.com/JaydenYoonZK/ai-crawler-audit/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/JaydenYoonZK/ai-crawler-audit/ci.yml?style=for-the-badge&label=tests" alt="CI status"></a>
  <a href="https://github.com/JaydenYoonZK/ai-crawler-audit"><img src="https://img.shields.io/github/stars/JaydenYoonZK/ai-crawler-audit?style=for-the-badge&logo=github" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/JaydenYoonZK/ai-crawler-audit?style=for-the-badge" alt="MIT License"></a>
</p>

<a href="https://jaydenyoonzk.github.io/ai-crawler-audit/?demo">
  <img src="docs/assets/preview.png" alt="AI Crawler Audit shown in light and dark themes, the hero with its illustration showing crawlers allowed, partially blocked, and blocked site-wide" width="100%">
</a>

**[Open the live tool](https://jaydenyoonzk.github.io/ai-crawler-audit/)** or **[see a sample audit](https://jaydenyoonzk.github.io/ai-crawler-audit/?demo)**. Paste mode sends nothing anywhere.

## Why this exists

Nineteen documented AI crawlers and control tokens can affect whether content is collected for model training, indexed for AI search, or fetched for a live user request. They have different jobs and different consequences when blocked. Blocking `GPTBot` says nothing about `ChatGPT-User`. Blocking `Google-Extended` does not affect Google Search. These distinctions matter and are easy to get wrong.

This tool audits your actual file against a curated, documented dataset and explains each result in plain language.

## What it does

- **Audit**: paste a robots.txt, get a per-crawler verdict (allowed, partial, blocked, default) computed with a proper RFC 9309 matcher: rule groups, longest-match precedence, allow winning ties, `*` and `$` wildcards
- **Explain**: every crawler is labeled by what it is for (training, AI search, live user fetches, or a control token) with vendor documentation linked
- **Generate**: three ready-to-copy starting policies: block training, block every listed token, or explicitly allow every listed token
- **llms.txt**: a structural check for the proposed [llms.txt](https://llmstxt.org/) format, with its required H1 separated from optional sections

## The CLI

The browser cannot fetch other sites' files, so live audits ship as a zero-dependency CLI:

```bash
npx github:JaydenYoonZK/ai-crawler-audit example.com
```

Use JSON in scripts, or require a declared policy in CI:

```bash
npx github:JaydenYoonZK/ai-crawler-audit --json example.com
npx github:JaydenYoonZK/ai-crawler-audit --policy block-training example.com
```

Policy failures exit with code 1. Invalid input, network failures, timeouts, and server errors exit with code 2. A 4xx response is reported as an unavailable robots file, while a 5xx or network failure is never treated as an all-clear.

```
AI crawler audit for https://example.com

  GPTBot            BLOCKED   training   Blocked site-wide by a "GPTBot" group.
  OAI-SearchBot     ALLOWED   search     Allowed by the "*" group.
  ...
  llms.txt: not found (optional, see https://llmstxt.org/)
```

## The dataset

The heart of the project is [`docs/data/crawlers.json`](docs/data/crawlers.json): 19 crawlers and control tokens with vendor, purpose, documentation link, and notes about known limitations. The list includes separate training, search, and user-fetch tokens where vendors document them. It is versioned, dated, and reviewable in one file.

New bots appear constantly. If you see one in your logs, a pull request with a log sample and a documentation link is the fastest way to get it added.

## Tests

```bash
npm test
```

The suite covers group parsing and merging, bounded wildcard matching, UTF-8 and percent-encoded paths, byte-aware precedence, policy generation, CLI HTTP states and exit codes, dataset integrity, accessibility, CSP, release metadata, and protected design structure.

The matching behavior follows [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). Crawler purposes and limitations are taken from the first-party documentation linked in the dataset.

## License

MIT. Built and maintained by [Jayden Yoon ZK](https://github.com/JaydenYoonZK). Sibling projects: [AI Paste Cleaner](https://github.com/JaydenYoonZK/ai-paste-cleaner) and [Package Reality Check](https://github.com/JaydenYoonZK/package-reality-check).
