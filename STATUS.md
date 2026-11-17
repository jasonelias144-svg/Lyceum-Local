# Status: Lyceum Local

**What this is:** a private AI chat that runs entirely in the browser; details in README.md
**State:** active, milestone 1 since 2026-09-30
**Updated:** 2026-11-17 by Claude

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

- 2026-11-17 Claude: an AI agent is "they", never "it" (the handbook's
  decision 0006, at the founder's word). CLAUDE.md says "they" of Claude, and
  AGENTS.md has the rule under "Always".
- 2026-11-15 Claude: licence: CC0 1.0 (`LICENSE`), a public-domain
  dedication, by the founder's decision of 2026-11-15: "Consider all free
  and public and use the license we have been using and correct that license
  when I naively chose the wrong one or none. Always consider it all public
  if in a public repo." And: "Please ensure the right license is chosen that
  is essentially a license that says there is no restrictions and all that.
  No attribution required." It replaces the MIT licence the code had, which
  asked for its notice to be kept; package.json and README.md ("License")
  follow. The models stay under their makers' licences, as before.

- 2026-10-27 Claude: adopted the policy handbook; CI now uses
  actions/checkout@v7 and setup-node@v7; README status updated (Pages is live).
  `npm test`: 24 passed, 0 failed.
