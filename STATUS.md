# Status: Lyceum Local

**What this is:** a private AI chat that runs entirely in the browser; details in README.md
**State:** active, milestone 1 since 2026-09-30
**Updated:** 2026-10-27 by Claude

## Live

- Where: https://jasonelias144-svg.github.io/Lyceum-Local/ (GitHub Pages, from `main`)
- Version: `main` at 7e7689d (2026-09-30)
- Last check: 2026-10-27, the page answers (HTTP 200). A chat has not been
  tried in this check.

## Now

- Claude: adopting the policy handbook (docs/adopt-handbook).

## Next

1. Test on a real iPhone (iOS 26 or later) and record the results: which models
   load, speed in tokens per second, memory, and storage behaviour after a week.
   This needs the founder's phone, or someone's.
2. Use those results to decide the next milestone toward the native app.

## Open questions

- For the founder: who can test on a real iPhone, and when? (asked 2026-10-27)

## Noticed

- One branch remains from a merged pull request
  (`claude/open-ended-generation-kwgf7y`). This session cannot delete branches.

## Log

- 2026-10-27 Claude: adopted the policy handbook; CI now uses
  actions/checkout@v7 and setup-node@v7; README status updated (Pages is live).
  `npm test`: 24 passed, 0 failed.
