# CLI Tools

Command-line tools for running AI matches and simulations. All CLI commands use [tsx](https://github.com/privatenumber/tsx) to execute TypeScript directly.

## Bot Match

Run an AI-vs-AI match between any two factions.

```bash
npm run bot-match -- --faction1 <faction> --faction2 <faction> [--seed <number>] [--quiet]
```

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--faction1` | No | `romans` | Faction for Player 1 |
| `--faction2` | No | `vikings` | Faction for Player 2 |
| `--seed` | No | `Date.now()` | RNG seed for deterministic replay |
| `--quiet` | No | off | Suppress progress output (only show final summary) |
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

# Reproduce a specific game
npm run bot-match -- --faction1 romans --faction2 vikings --seed 12345
```

### Output

```
⚔️  Bot Match: romans vs vikings (seed: 42)
──────────────────────────────────────────────────
  Turn 2 | 50 actions
  Turn 3 | 100 actions
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

## Architecture

CLI tools live in `src/cli/` and are excluded from the engine TypeScript config (`tsconfig.json`). They run via `tsx` which handles Node.js APIs and ES module resolution.

| File | Purpose |
|------|---------|
| `src/cli/bot-match.ts` | Bot vs Bot match runner |

### Adding New CLI Commands

1. Create a new file in `src/cli/` (e.g., `src/cli/simulate.ts`)
2. Add a script to `package.json`: `"simulate": "tsx src/cli/simulate.ts"`
3. **Update this doc** (`docs/cli.md`) with usage instructions
4. CLI files use Node.js APIs (`process`, `console`) and are excluded from `tsconfig.json`
