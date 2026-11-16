# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/DangTruong96/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/DangTruong96/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

## Description

Token Launch Radar ranks pre-token protocols from a sealed DefiLlama snapshot by implied token value. It covers the full 40-protocol watchlist and gives every protocol on the board a concrete farm plan with costs and time estimates.

The value model multiplies TVL by a category multiple derived from the snapshot's tokenised peers, a 7-day growth factor, a factor for years without a token (using tracked age), and a chain breadth factor. Category multiples blend toward the global median, then are capped at 5 times that median so one thin, extreme category cannot dominate the board. The existing $1 implied-value floor remains in place.

The dashboard offers search, category and chain filters, a watchlist toggle, sorting, and per-protocol details with the value breakdown and farm plan.

Values are model estimates, not predictions that a token will launch or guarantees of rewards.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

Requires Node 22+ and no dependencies. `--input` takes the snapshot path. Output lands in `out/`: `board.json`, `data.js`, `dashboard/`, and `dossier.json`. The program also copies the repository's screenshots into `out/screenshots/` for the dossier.

---

<sub>Entered on [make.fun](https://make.fun/?ref=83q2pcp3&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
