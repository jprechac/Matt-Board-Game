# Roadmap: Digital Implementation for Balance Testing

> Build a digital version of the hex-based strategy board game in TypeScript (shared engine for browser + Node) to enable manual playtesting and automated AI-vs-AI balance simulations.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   TypeScript Monorepo                │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Game Engine (pure TS)             │  │
│  │  Types · Hex Math · Board · Combat · Movement │  │
│  │  Abilities · State Machine · Seeded RNG       │  │
│  └──────────┬──────────┬──────────┬──────────────┘  │
│             │          │          │                  │
│      ┌──────▼──┐  ┌────▼────┐  ┌─▼──────────┐      │
│      │ Web UI  │  │   AI    │  │ Simulator   │      │
│      │ (React) │  │  Bots   │  │ (Node CLI)  │      │
│      └─────────┘  └─────────┘  └─────────────┘      │
│                                       │              │
│                              ┌────────▼────────┐     │
│                              │ SQLite + Reports │     │
│                              └─────────────────┘     │
└─────────────────────────────────────────────────────┘
```

**Key principle:** The engine is the single source of truth. UI renders engine state. AI reads engine state and produces moves. Simulator runs engine headlessly. Same rules apply everywhere.

---

## Phases

### Phase 1: Core Game Engine

> **Status:** Not started
> **Depends on:** Nothing (this is the foundation)

**Goal:** Implement all game rules as a pure, testable, headless TypeScript library.

- [ ] Data model & types — `GameState`, `Unit`, `Faction`, `Hex`, `Board`, `Action`, `Player`, `TurnPhase`, etc.
- [ ] Faction & unit data files — all stats/abilities in JSON/TS data files (not hardcoded), enabling balance tweaks without code changes
- [ ] Hex grid system — cube coordinates, distance, neighbors, line-of-sight, BFS pathfinding, range calculations
- [ ] Board generation — 2-player (18×19) and 4-player (22×19) with base zones, placement zones, terrain zones
- [ ] Game state machine — Setup → Placement → Gameplay → Victory; turn tracking, base control timers
- [ ] Movement system — hex occupancy, movement range, post-attack 1-hex restriction
- [ ] Combat system — d8 rolls, To Hit thresholds, damage, ranged disadvantage at adjacent range, unit death
- [ ] Seeded RNG — seedable PRNG (e.g., `seedrandom` or xorshift) instead of `Math.random()`. Non-negotiable for reproducible simulations
- [ ] Special abilities — composable ability handlers (strategy/plugin pattern); TBD abilities get stub implementations
- [ ] Win condition checking — base control timer (3 turns / 2 for Mongols), all-units-defeated, surrender
- [ ] Action validation & execution — validate legality, return new immutable `GameState`
- [ ] Setup phase logic — roll-off, faction selection, army composition (3-5-1), alternating placement
- [ ] Terrain system (stub) — define interface + placement rules; plug in effects when rules finalized
- [ ] Unit tests — extensive coverage for every mechanic

<details>
<summary>Key files</summary>

```
src/engine/
├── types.ts           # All game types/interfaces
├── hex.ts             # Hex math utilities
├── board.ts           # Board creation and queries
├── combat.ts          # Combat resolution
├── movement.ts        # Movement validation and pathfinding
├── game.ts            # Game state machine, turn flow
├── rng.ts             # Seeded PRNG
├── validation.ts      # Action validation
├── abilities/         # One file per ability type
└── data/factions/     # One file per faction (stats, abilities)
```
</details>

**Verification:**
- Unit tests for every mechanic
- Integration test: play a full game programmatically (scripted moves), verify final state
- Manually verify unit stats match design docs

---

### Phase 2: Game Event & Replay System

> **Status:** Not started
> **Depends on:** Phase 1

**Goal:** Record every game event for replay, debugging, logging, and statistics.

*This phase is early in the roadmap intentionally — without structured event recording from the start, debugging bot behavior, computing statistics, and replaying games requires painful retrofitting later.*

- [ ] Event log system — define event types: `UnitMoved`, `AttackRolled`, `DamageDealt`, `UnitKilled`, `AbilityUsed`, `TurnEnded`, `BaseControlChanged`, `GameWon`, etc.
- [ ] Game recorder — capture event stream + initial state + RNG seed; any game can be replayed deterministically
- [ ] Replay player — step forward/backward through game states (headless; UI replay comes in Phase 7)
- [ ] Serialization — JSON export/import for game recordings

**Verification:**
- Record a scripted game, replay it, verify states match
- Export/import round-trip test

---

### Phase 3: Web UI — Manual Playtesting

> **Status:** Not started
> **Depends on:** Phase 1, Phase 2

**Goal:** Playable hot-seat (same screen, two players alternate) web app with hex grid visualization.

- [ ] Project setup — Vite + React + TypeScript
- [ ] Hex grid renderer — SVG hex board with coordinates, terrain zones, bases
- [ ] Unit rendering — faction colors, unit type labels/icons, HP bars (simple shapes initially)
- [ ] Game flow UI — setup screen (faction selection, army comp), placement phase, gameplay
- [ ] Interaction — click to select → show valid moves → click to move/attack → show roll result
- [ ] HUD / info panels — turn indicator, selected unit stats, event log sidebar, faction ability reminders
- [ ] Game state display — base control timer, units remaining, turn counter
- [ ] Undo support — undo last action within current turn (leveraging immutable state)
- [ ] Responsive layout — desktop browsers minimum; tablet-friendly stretch goal

**Verification:**
- Play a full hot-seat game, verify all rules enforced correctly
- Verify all faction abilities work in UI

---

### Phase 4: Basic AI Bots (Medium Difficulty)

> **Status:** Not started
> **Depends on:** Phase 1, Phase 2; UI integration depends on Phase 3 (can develop in parallel)

**Goal:** Create a "Medium" difficulty AI for each faction so a single player can playtest vs computer.

- [ ] AI interface — `Bot`: given `GameState`, return `Action[]` for the turn (stateless)
- [ ] Evaluation heuristics — material advantage, board control, threat assessment, leader safety
- [ ] Generic strategy layer — target selection, movement strategy, combat decision thresholds
- [ ] Faction-specific tactics for all 11 factions:
  - Aztecs: Priest positioning, Jaguar sacrifice tracking
  - Bulgars: Terrain exploitation, Khan Krum anti-terrain positioning
  - English: Arthur upgrade timing, Longbowman crit positioning
  - Huns: Placeholder (stats TBD) — basic mounted tactics
  - Japanese: Samurai multi-adjacent engagement, Nobunaga dual-attack
  - Mongols: Rush strategy (2-turn win), Kheshig full-movement attacks
  - Muscovites: Token placement, Streltsy positioning
  - Ottomans: Medic healing priority, Janissary reload management
  - Romans: Formation maintenance (Legionnaire adjacency), Caesar redirect
  - Vandals: Lone-wolf positioning (Raider/Genseric solo bonuses)
  - Vikings: Eric double-attack targeting, Berserker aggression
- [ ] Army composition selection — default "recommended" comp per faction
- [ ] Placement logic — ranged behind melee, leader protected
- [ ] "Play vs AI" mode in the web UI

**Verification:**
- Each bot completes full games without errors or illegal moves
- Bots make reasonable (not random) moves — manual observation
- Bot vs Bot games produce varied outcomes

---

### Phase 5: Game Logging & Statistics Tracking

> **Status:** Not started
> **Depends on:** Phase 2, Phase 4

**Goal:** Structured data collection from games for balance analysis.

- [ ] Game result records — factions, army comps, winner, win condition, turn count, seed, damage per unit, survivors
- [ ] Per-unit statistics — avg damage dealt, avg survival time, kill count, death rate
- [ ] Per-faction statistics — win rate overall, win rate by matchup, avg game length, win condition distribution
- [ ] SQLite database (`better-sqlite3`) — tables: `games`, `game_units`, `game_events`
- [ ] CSV/JSON export for external analysis

**Verification:**
- Run 100 bot games, verify all stats computed correctly
- Spot-check individual game records against replay

---

### Phase 6: AI vs AI Simulation Runner

> **Status:** Not started
> **Depends on:** Phase 4, Phase 5

**Goal:** Headless CLI tool that runs thousands of games and produces balance reports.

- [ ] CLI tool — `npm run simulate -- --factionA romans --factionB vikings --games 1000 --seed 42`
- [ ] Scenario configuration — JSON config files for matchups, army comp, board size, terrain, game count
- [ ] Parallel execution — Node `worker_threads` for concurrent games (target: 1000+ games/minute)
- [ ] Progress reporting — CLI progress bar, ETA
- [ ] Result aggregation:
  - Matchup matrix (win rate for all 55 faction pairs)
  - Confidence intervals for win rate differences
  - Outlier detection (extreme win rates)
  - Game length distributions
- [ ] Report output — Markdown/HTML reports saved to `reports/` with timestamp
- [ ] Deterministic runs — same master seed → same results (critical for before/after comparisons)

**Verification:**
- Round-robin tournament (all 55 faction pairs) completes without errors
- Same seed produces identical results
- Parallelism doesn't affect determinism

---

### Phase 7: Balance Analysis Dashboard

> **Status:** Not started
> **Depends on:** Phase 3, Phase 6

**Goal:** Visual dashboard for interpreting simulation results.

- [ ] Web dashboard — matchup matrix heatmap, faction tier list, per-unit performance charts, game length distributions
- [ ] Comparison mode — upload two reports (before/after balance change), show deltas per matchup
- [ ] Drill-down — click matchup cell → game length distribution, common army comps, example replays
- [ ] Replay viewer — step through recorded games in the UI (board state at each turn)

**Verification:**
- Dashboard correctly renders simulation data
- Comparison mode shows accurate deltas

---

### Phase 8: Advanced AI — Easy / Medium / Hard

> **Status:** Not started
> **Depends on:** Phase 4, Phase 6

**Goal:** Three difficulty tiers per faction for varied playtesting and nuanced simulations.

- [ ] Easy bots — simplified heuristics, intentional suboptimal play, no faction-specific tactics
- [ ] Medium bots — Phase 4 bots (already built)
- [ ] Hard bots — multi-turn lookahead (minimax or MCTS), opponent modeling, optimized faction play, adaptive strategy
- [ ] Difficulty as simulation variable — e.g., "Does faction X's easy bot beat faction Y's hard bot?" → imbalance signal
- [ ] ELO ratings — per faction×difficulty, tracked over time as balance evolves

**Verification:**
- Easy loses to Hard >80% (same faction mirror match)
- Difficulty differences are perceptible in UI play
- Hard bots produce longer, more strategic games

---

### Phase 9 (Stretch): Online Multiplayer

> **Status:** Not started
> **Depends on:** Phase 1, Phase 3

**Goal:** Remote play over the network.

- [ ] WebSocket server — engine runs server-side (authoritative), clients send actions, server validates
- [ ] Lobby system — create/join rooms, faction selection, ready-up
- [ ] Reconnection — handle disconnects gracefully, game state preserved
- [ ] Spectator mode — watch ongoing games

**Verification:**
- Two players on different machines complete a full game
- Disconnect/reconnect preserves state
- All rules enforced server-side

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript | Shared between engine, UI, and simulator |
| Engine | Pure TS, zero deps | Runs in Node (simulations) and browser (UI) |
| RNG | seedrandom / xorshift | Reproducible simulations |
| UI | React 18 + Vite | Fast dev, team familiarity |
| Rendering | SVG hex grid | Simpler than Canvas for interactive elements |
| AI | Rule-based heuristics | Predictable, debuggable, sufficient for balance testing |
| Database | SQLite (better-sqlite3) | Lightweight, queryable simulation results |
| Simulator | Node.js + worker_threads | Parallel headless games |
| Testing | Vitest | Fast, TS-native, Vite-compatible |
| Online (stretch) | WebSocket (ws / Socket.io) | Real-time game state sync |

## Project Structure

```
matt-board-game/
├── docs/                    # Game design docs + this roadmap
│   ├── core-rules.md
│   ├── balance-testing.md
│   ├── factions/            # One file per faction
│   └── ROADMAP.md           # ← You are here
├── src/
│   ├── engine/              # Pure game logic (no UI deps)
│   │   ├── types.ts
│   │   ├── hex.ts
│   │   ├── board.ts
│   │   ├── combat.ts
│   │   ├── movement.ts
│   │   ├── game.ts
│   │   ├── rng.ts
│   │   ├── validation.ts
│   │   ├── events.ts
│   │   ├── replay.ts
│   │   ├── abilities/       # Per-ability handlers
│   │   └── data/factions/   # Faction JSON/TS data files
│   ├── ai/                  # Bot implementations
│   │   ├── types.ts
│   │   ├── evaluate.ts      # Shared heuristics
│   │   ├── strategies/      # Per-faction bot logic
│   │   └── difficulty.ts    # Easy/Medium/Hard wrappers
│   ├── ui/                  # React web app
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── simulator/           # Headless simulation runner
│   │   ├── cli.ts
│   │   ├── runner.ts
│   │   ├── worker.ts
│   │   └── reporter.ts
│   └── analysis/            # Statistics & reporting
│       ├── stats.ts
│       ├── matchup.ts
│       └── dashboard/
├── tests/                   # Mirror src/ structure
├── reports/                 # Generated simulation reports
├── scenarios/               # Simulation scenario configs
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Open Design Questions

These are tracked as TBD in the codebase — built with pluggable interfaces so they can be filled in without refactoring:

| Question | Current Plan |
|----------|-------------|
| Terrain system (types, effects) | Define interface + placement rules; implement effects when finalized |
| Aztec sacrifice mechanic | Stub with TODO |
| Attila the Hun stats | Placeholder stats similar to other leaders; swap when finalized |
| Janissary "3/2" movement | Config flag supporting both interpretations |
| Army composition flexibility | Configurable rules (3-5-1 as default) |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| TypeScript monorepo | Single package, shared engine — simplest for small team |
| Pure functions over immutable state | Enables undo, replay, and safe parallel simulation |
| Seeded RNG from day one | Non-negotiable for reproducible balance testing |
| Data-driven faction/unit definitions | Balance changes = data file edits, not code changes |
| SQLite for results | Lightweight, queryable, familiar |
| Rule-based AI (not ML) | Predictable, debuggable, sufficient for balance testing |
| Hot-seat first | Online multiplayer is a stretch goal |
