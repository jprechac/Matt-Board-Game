# CLI Tools

Command-line tools for running AI matches and simulations. All CLI commands use [tsx](https://github.com/privatenumber/tsx) to execute TypeScript directly.

## Bot Match

Run an AI-vs-AI match between any two factions. (4-player support is planned for a future phase.)

```bash
npm run bot-match -- --faction1 <faction> --faction2 <faction> [--seed <number>] [--quiet] [--verbose] [--db <path>] [--no-db]
```

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--faction1` | No | `romans` | Faction for Player 1 |
| `--faction2` | No | `vikings` | Faction for Player 2 |
| `--seed` | No | `Date.now()` | RNG seed for deterministic replay |
| `--quiet` | No | off | Suppress progress output (only show final summary) |
| `--verbose` | No | off | Show every action (phase transitions, turn headers, each action with details) |
| `--db` | No | `data/games.db` | Path to SQLite database for saving results |
| `--no-db` | No | off | Skip saving to database |
| `--help` | No | — | Show usage information |

### Available Factions

`aztecs`, `bulgars`, `english`, `huns`, `japanese`, `mongols`, `muscovites`, `ottomans`, `romans`, `vandals`, `vikings`

### Examples

```bash
# Quick match with defaults (Romans vs Vikings)
npm run bot-match

# Specific matchup with a fixed seed
npm run bot-match -- --faction1 mongols --faction2 english --seed 42

# Quiet mode — just the results
npm run bot-match -- --faction1 aztecs --faction2 ottomans --quiet

# Verbose mode — see every action
npm run bot-match -- --faction1 romans --faction2 vikings --seed 42 --verbose

# Reproduce a specific game
npm run bot-match -- --faction1 romans --faction2 vikings --seed 12345
```

### Output

```
⚔️  Bot Match: romans vs vikings (seed: 42)
──────────────────────────────────────────────────
  Turn 1 | vikings (player2) | 19 actions
  Turn 1 | romans (player1) | 21 actions
  Turn 2 | vikings (player2) | 19 actions
  Turn 2 | romans (player1) | 22 actions
  ...
──────────────────────────────────────────────────
🏆 Winner: player2 (vikings)
   Condition: base_control
   Turns: 10
   Actions: 379
   Fallbacks: 0
   Seed: 42
   Units alive: romans=5, vikings=5
```

| Field | Meaning |
|-------|---------|
| Winner | Which player won and their faction |
| Condition | Win condition (`base_control`, `elimination`, etc.) |
| Turns | Total gameplay turns completed |
| Actions | Total actions taken by both bots |
| Fallbacks | Times the bot's chosen action was invalid and a fallback was used (ideally 0) |
| Seed | RNG seed — use this to replay the exact same game |
| Units alive | Surviving units per faction |

### Tips

- **Reproducibility:** Same `--seed` + same factions = identical game. Use this to debug bot behavior.
- **Batch runs:** Loop over seeds in a shell script to gather statistics:
  ```bash
  for i in $(seq 1 100); do npm run bot-match -- --faction1 romans --faction2 mongols --seed $i --quiet; done
  ```
- **All bots use Medium difficulty** — faction-specific tactics from `src/ai/strategies/`.

## Stats Export

Query and export game statistics from the SQLite database.

```bash
npm run stats-export -- [options]
```

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--db` | No | `data/games.db` | Path to SQLite database |
| `--summary` | No | off | Print faction overview and matchup matrix |
| `--matchup` | No | — | Show stats for a specific matchup (e.g., `--matchup romans vikings`) |
| `--format` | No | — | Export format: `csv` or `json` |
| `--out` | No | stdout | Output file path for exports |
| `--limit` | No | all | Limit number of exported games |
| `--help` | No | — | Show usage information |

### Examples

```bash
# View faction overview and matchup matrix
npm run stats-export -- --summary

# Export all games as CSV
npm run stats-export -- --format csv --out reports/games.csv

# Check a specific matchup
npm run stats-export -- --matchup romans vikings

# Export recent games as JSON
npm run stats-export -- --format json --limit 100 --out recent.json
```

## Architecture

CLI tools live in `src/cli/` and are excluded from the engine TypeScript config (`tsconfig.json`). They run via `tsx` which handles Node.js APIs and ES module resolution. Shared utilities live in `src/cli/utils/`.

| File | Purpose |
|------|---------|
| `src/cli/bot-match.ts` | Bot vs Bot match runner |
| `src/cli/stats-export.ts` | Game stats query and export |
| `src/cli/utils/format.ts` | Shared utilities (arg parsing, action formatting, round tracking) |
| `src/stats/database.ts` | SQLite schema, CRUD, and query functions |

### Adding New CLI Commands

1. Create a new file in `src/cli/` (e.g., `src/cli/simulate.ts`)
2. Add a script to `package.json`: `"simulate": "tsx src/cli/simulate.ts"`
3. **Update this doc** (`docs/cli.md`) with usage instructions
4. CLI files use Node.js APIs (`process`, `console`) and are excluded from `tsconfig.json`
