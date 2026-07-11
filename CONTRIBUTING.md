# Contributing

The dataset is the most useful thing to contribute to. Everything else is engine work.

## Add or update a crawler

Edit [`docs/data/crawlers.json`](docs/data/crawlers.json). Every entry needs:

- `token`: the exact user-agent product token as it appears in robots.txt rules
- `vendor` and `purpose`: one of `training`, `search`, `user`, `control`
- `docs`: a vendor documentation URL, or `null` if none exists (say so in the notes)
- `notes`: one or two sentences a site owner can act on

In the pull request, include where you saw the bot (a log line is ideal) and the documentation link. Bump the `updated` date. The dataset integrity test in `npm test` enforces the shape.

## Engine changes

The parser and matcher live in [`docs/robots.js`](docs/robots.js) and aim to follow RFC 9309. Any behavior change needs a test in [`test/robots.test.mjs`](test/robots.test.mjs), ideally with the robots.txt snippet that motivated it.

```bash
npm test         # run the suite
npm run coverage # measure the engine, CLI, and static checks
npm run serve    # local server on :8323
node bin/cli.mjs example.com   # live CLI run
```

No dependencies, no build step. The same engine module runs in the browser, in tests, and in the CLI.

## Pull requests

Small and focused changes are easiest to review. For structural changes, open an issue first.
