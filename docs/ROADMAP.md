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

> **Status:** ✅ Complete<br>
> **Depends on:** Nothing (this is the foundation)

**Goal:** Implement all game rules as a pure, testable, headless TypeScript library.

- [x] Data model & types — `GameState`, `Unit`, `Faction`, `Hex`, `Board`, `Action`, `Player`, `TurnPhase`, etc.
- [x] Faction & unit data files — all stats/abilities in JSON/TS data files (not hardcoded), enabling balance tweaks without code changes
- [x] Hex grid system — cube coordinates, distance, neighbors, line-of-sight, BFS pathfinding, range calculations
- [x] Seeded RNG — seedable PRNG (Mulberry32) instead of `Math.random()`. Non-negotiable for reproducible simulations
- [x] Board generation — 2-player (18×19) and 4-player (22×19) with base zones, placement zones, terrain zones
- [x] Movement system — hex occupancy, movement range, post-attack 1-hex restriction
- [x] Combat system — d8 rolls, To Hit thresholds, damage, ranged disadvantage at adjacent range, unit death
- [x] Special abilities — composable ability handlers (strategy/plugin pattern); TBD abilities get stub implementations
- [x] Terrain system (stub) — define interface + placement rules; plug in effects when rules finalized
- [x] Game state machine — Setup → Placement → Gameplay → Victory; turn tracking, base control timers
- [x] Action validation & execution — validate legality, return new immutable `GameState`
- [x] Setup phase logic — roll-off, faction selection, army composition (3-5-1), alternating placement
- [x] Win condition checking — base control timer (3 turns / 2 for Mongols), all-units-defeated, surrender
- [x] Unit tests — extensive coverage for every mechanic (195 tests across 10 test files)

<details>
<summary>Implementation chunks</summary>

#### Chunk 1: Foundation ✅

1. Project setup — `package.json`, `tsconfig.json`, `vitest.config.ts`
2. `src/engine/types.ts` — All game types, interfaces, and constants
3. `src/engine/rng.ts` — Seeded Mulberry32 PRNG (deterministic d8 rolls)
4. `src/engine/hex.ts` — Cube coordinates, distance, neighbors, LOS, BFS pathfinding, range
5. `src/engine/data/` — Basic units + all 11 faction data files with stats/ability identifiers
6. Tests: hex math, RNG determinism, faction data completeness (72 tests)

#### Chunk 2: Board + Movement + Combat ✅

1. `src/engine/board.ts` — Board generation (18×19 / 22×19), base zones, placement zones, terrain zones
2. Terrain system stub — interface + placement rules
3. `src/engine/movement.ts` — Movement validation, occupancy, pathfinding, post-attack restriction
4. `src/engine/combat.ts` — d8 rolls, To Hit, damage, ranged proximity penalty
5. `src/engine/abilities/` — Composable ability handler system + all 25 faction ability implementations
6. Tests: board creation, movement, combat, all 11 faction abilities (156 total tests)

#### Chunk 3: Game Flow + Integration ✅

1. `src/engine/game.ts` — State machine: Setup → Placement → Gameplay → Victory
2. `src/engine/validation.ts` — Action legality, returns new immutable GameState
3. Setup phase logic — roll-off, faction selection, army comp (3-5-1), alternating placement
4. Win conditions — base control timer (3/2 turns for Mongols), all-units-defeated, surrender
5. Integration test — full scripted game (programmatic moves, verify final state)
6. Unit tests: game flow, validation, setup, win conditions

</details>

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

**Known Issues:**
- [x] **Streltsy defense ability** — Fixed: now checks attacker's attack range, only blocks melee (range 1) move-and-attack.
- [ ] **Vandals Heavy Cavalry** missing ability implementation — design doc says "-1 To Hit penalty if attacking a unit in melee range" but no handler exists and no `abilityId` is assigned in faction data.
- [ ] **Stub abilities** — `priest_buff`, `upgrade_unit`, `redirect_attack`, `medic_heal`, `siege_movement_buff`, `attila_tbd` are registered but have no real logic (return `{}` or `true`). Will be filled in as terrain and active-ability actions are implemented.
- [ ] **Ability actions** — `useAbility` action type exists in types but `applyAction` throws "not implemented". Active abilities (as opposed to passive hooks) need a handler dispatch system.
- [ ] **4-player game flow** — Board zones are correct (2v2 teams share top/bottom bases on wider board), but game.ts setup/placement logic doesn't yet handle 4-player team mechanics (team roll-off, A→C→B→D placement order, team-based win conditions).
- [ ] **Terrain system** — Fully stubbed; design doc says "Jordan note: I don't know how Terrain works." Blocked on rules finalization.
- [ ] **Test coverage gaps** — `getReachableHexes()` not directly tested; combat tests use seed-hunting pattern; ~12 abilities lack dedicated tests; validation.ts gameplay validators undertested.
- [x] **Missing getLegalActions API** — Fixed: `getUnitActions()` + `getAllLegalActions()` added in `src/engine/actions.ts`. Needed by Phase 3 UI and Phase 4 AI.
- [x] **Missing baseControlChanged + empty serialization tests** — Fixed: both test gaps from audit covered in `tests/engine/actions.test.ts`.
- [ ] **Board visual polish** (low priority) — Placement zones and bases need more visual distinction beyond color (e.g. patterns, borders, icons). General hex grid aesthetics could be improved.
- [x] 🔴 **Roll-off priority choice incorrect** — Fixed in Phase 3.5 Chunk 1: 2-step flow with `loserChoosePriority` step.
- [x] 🔴 **Ottoman medic can't heal** — Fixed in Phase 3.5 Chunk 2: `HealAction` type, handler in game.ts, `healTargets` in UnitActions, UI heal targeting.
- [x] 🔴 **Post-attack movement exploit** — Fixed in Phase 3.5 Chunk 1: `movementUsedAtAttack` snapshot tracks post-attack movement.
- [x] 🔴 **Samurai adjacency ability unclear** — Fixed in Phase 3.5 Chunk 1: melee range guard added to handler.
- [x] 🟡 **Placement: player can't choose unit order** — Fixed in Phase 3.5 Chunk 2: clickable roster with player-appropriate zone colors.
- [x] 🟡 **Combat overlay gets stuck** — Fixed in Phase 3.5 Chunk 2: split useEffects, eventKey counter, click-to-dismiss.
- [x] 🟢 **Attack highlight color blends with red base** — Fixed in Phase 3.5 Chunk 2: bright orange highlight.
- [x] 🟢 **Display names show code IDs** — Fixed in Phase 3.5 Chunk 2: `formatUnitName()` / `formatWinCondition()` / `formatFactionName()`.
- [ ] 🟢 **Army selection UX** — +/- melee counter is awkward; screen mostly blank. Create reusable UnitStatCard showing full stats + ability description; use in army builder + gameplay hover/popup. Show leader info.
- [ ] 🟢 **Auto-end turn** — When all units are exhausted (no actions remaining), auto-dispatch endTurn.
- [ ] 🟢 **View enemy unit details** — Allow clicking enemy units to see stats in read-only UnitInfoPanel (without action highlights).
- [x] 🟢 **Victory text formatting** — Fixed in Phase 3.5 Chunk 2: same `formatWinCondition()` utility.

---

### Phase 2: Game Event & Replay System

> **Status:** ✅ Complete<br>
> **Depends on:** Phase 1

**Goal:** Record every game event for replay, debugging, logging, and statistics.

*This phase is early in the roadmap intentionally — without structured event recording from the start, debugging bot behavior, computing statistics, and replaying games requires painful retrofitting later.*

- [x] Event log system — 16 event types defined in `src/engine/events.ts`
- [x] Game recorder — `src/engine/recorder.ts` + `applyActionDetailed` in game.ts
- [x] Replay player — `src/engine/replay.ts` with lazy state caching, action/event/turn navigation
- [x] Serialization — `src/engine/serialization.ts` with schema versioning, event count verification

<details>
<summary>Implementation chunks</summary>

#### Chunk 1: Event Types + Game Recorder ✅

1. `src/engine/events.ts` — Event type definitions: `UnitMoved`, `AttackRolled`, `DamageDealt`, `UnitKilled`, `AbilityUsed`, `HealPerformed`, `TurnStarted`, `TurnEnded`, `UnitTurnEnded`, `BaseControlChanged`, `BaseControlTimerTick`, `GameWon`, `GameStarted`, `UnitPlaced`, `FactionSelected`, `ArmyCompositionSet`; base event interface with `timestamp`, `turnNumber`, `type`, `playerId`
2. `src/engine/recorder.ts` — Game recorder: captures event stream, stores initial GameState + RNG seed + board config, provides `record(event)` hook, produces `GameRecording` object
3. Integrate recorder into `game.ts` — emit events from action execution (move, attack, ability, turn end, win)
4. Tests: event emission correctness, recorder captures all actions from scripted game

#### Chunk 2: Replay Player + Serialization ✅

1. `src/engine/replay.ts` — Replay player: reconstruct GameState at any point from `GameRecording`, `stepForward()` / `stepBackward()`, `goToTurn(n)`, `goToEvent(index)`; leverages deterministic RNG
2. `src/engine/serialization.ts` — JSON export/import: `serializeRecording()` / `deserializeRecording()`, schema versioning, import validation
3. Tests: record → replay → verify states match at every step; forward/backward stepping consistency; export → import round-trip; corrupted JSON import error handling

</details>

**Verification:**
- Record a scripted game, replay it, verify states match
- Export/import round-trip test

---

### Phase 3: Web UI — Manual Playtesting

> **Status:** ✅ Complete<br>
> **Depends on:** Phase 1, Phase 2

**Goal:** Playable hot-seat (same screen, two players alternate) web app with hex grid visualization.

- [x] Project setup — Vite + React + TypeScript
- [x] Hex grid renderer — SVG hex board with coordinates, terrain zones, bases
- [x] Unit rendering — faction colors, unit type labels/icons, HP bars (simple shapes initially)
- [x] Game flow UI — setup screen (faction selection, army comp), placement phase, gameplay
- [x] Interaction — click to select → show valid moves → click to move/attack → show roll result
- [x] HUD / info panels — turn indicator, selected unit stats, event log sidebar, faction ability reminders
- [x] Game state display — base control timer, units remaining, turn counter
- [x] Undo support — undo last action within current turn (leveraging immutable state)
- [x] Responsive layout — desktop browsers minimum; tablet-friendly stretch goal

<details>
<summary>Implementation chunks</summary>

#### Chunk 1: Project Setup + Hex Grid Renderer ✅

1. Add Vite + React 18 to existing monorepo: `src/ui/` directory, `App.tsx`, `main.tsx`, Vite config, updated `package.json` scripts (`dev`, `build:ui`, `preview`), `index.html`
2. `src/ui/components/HexGrid.tsx` — SVG hex board renderer: hex grid from Board data, coordinate labels (toggle), zone coloring (base, placement, terrain), responsive sizing
3. `src/ui/components/HexCell.tsx` — Individual hex: terrain indicators, hover highlight, click handler
4. `src/ui/styles/` — Player colors, grid styling, responsive layout base
5. Tests: component renders correctly, correct hex count for 2p/4p boards

#### Chunk 2: Unit Rendering + Selection Interaction ✅

1. `src/ui/components/UnitToken.tsx` — Unit on hex: faction color, type label, HP bar, leader marker, dead state
2. `src/ui/components/UnitInfoPanel.tsx` — Selected unit details: stats, ability state, action availability
3. Selection flow: click unit → select → show info + valid moves (blue) + valid targets (red) → click to execute → deselect
4. `src/ui/hooks/useGameState.ts` — React state: hold GameState, action dispatch, selected unit, computed valid moves/targets
5. Tests: selection flow, valid moves/targets display

#### Chunk 3: Game Flow UI + HUD ✅

1. `src/ui/App.tsx` — Phase router: menu → setup → placement → gameplay → victory
2. `src/ui/components/SetupScreen.tsx` — Roll-off, faction selection, army composition builder with privacy handoff
3. `src/ui/components/PlacementScreen.tsx` — Placement zones highlighted, click-to-place from roster, batch tracking
4. `src/ui/components/TurnIndicator.tsx` — Current player, turn number, base control timer
5. `src/ui/components/EventLog.tsx` — Scrollable event log, color-coded by event type
6. Tests: setup flow completes, placement transitions correctly

#### Chunk 4: Combat UI + Undo + Polish ✅

1. `src/ui/components/CombatOverlay.tsx` — Attack result toast: hit/miss/crit indicator, damage, target destroyed
2. Ability info in UnitInfoPanel — ability description display from handler registry
3. Undo: within-turn undo via immutable RecordedGame history stack (already in useGameState hook)
4. Victory screen: winner, win condition, final stats (turns, actions, kills, units alive), Play Again
5. Responsive layout: viewport meta, flex layout, min-height
6. Tests: CombatOverlay (hit/miss/crit/kill), App menu navigation, full engine E2E lifecycle

</details>

**Verification:**
- Play a full hot-seat game, verify all rules enforced correctly
- Verify all faction abilities work in UI

---

### Phase 3.5: Playtest Bug Fixes

> **Status:** ✅ Complete (Chunk 1 + Chunk 2)<br>
> **Depends on:** Phase 3<br>
> **Must complete before:** Phase 4 (AI depends on correct engine behavior)

**Goal:** Fix critical engine bugs and important UI issues found during Phase 3 playtesting. Add scenario-level tests to prevent regressions.

**🔴 Critical — Engine Bugs (2 chunks):**

<details>
<summary>✅ Chunk 1: Engine Rule Fixes (Complete)</summary>

1. **Roll-off priority choice** — Reworked to 2-step flow: winner picks order to control + position; loser picks remaining. New `loserChoosePriority` SetupStep.
2. **Post-attack movement exploit** — Fixed with `movementUsedAtAttack` snapshot in combat.ts. Movement capped correctly after attacking.
3. **Samurai adjacency ability** — Added melee range guard in handler. Returns empty modifiers for non-adjacent attacks.

*22 files changed, 414 insertions, 101 deletions. 309 tests passing.*

</details>

<details>
<summary>Chunk 2: Heal Action + UI Fixes + Scenario Tests</summary>

1. **Medic heal action** — Create `heal` action type, implement handler in game.ts using existing `resolveHeal`, add `healTargets` to UnitActions, update UI to dispatch heal on ally click for medic units.
2. **Combat overlay stuck** — Fix `useEffect` dependency in CombatOverlay to use stable key per attack event, preventing timer reset on new events.
3. **Placement roster selection** — Let player choose which unit to place (clickable roster, not static order). Fix zone coloring during placement phase.
4. **Display name cleanup** — Add `formatDisplayName()` utility; apply to unit names, win conditions, and anywhere code IDs are shown in UI.
5. **Attack highlight color** — Use distinct color (bright orange or pulsing) for attack targets so they don't blend with red player's base zone.
6. **Scenario tests (S01–S05)** — Add `tests/engine/scenarios.test.ts` with critical gameplay scenarios: post-attack movement cap, samurai melee guard, priority 2-step flow. See [`tests/TESTING_PLAN.md`](../tests/TESTING_PLAN.md) for full catalog.

</details>

**📋 Testing Documentation:**
- [`tests/README.md`](../tests/README.md) — Testing guide: how to run, write, and organize tests
- [`tests/TESTING_PLAN.md`](../tests/TESTING_PLAN.md) — 33 scenario tests cataloged across 3 priority tiers, gap analysis, unwired feature inventory

**🟢 QoL Backlog (defer to Phase 5 or later):**
- Army selection UX: reusable UnitStatCard component, leader info, better layout
- Auto-end turn when all units exhausted
- View enemy unit details in read-only mode
- Board visual polish (patterns, borders, icons for zones)

---

### Phase 4: Basic AI Bots (Medium Difficulty)

> **Status:** ✅ Complete<br>
> **Depends on:** Phase 1, Phase 2; UI integration depends on Phase 3 (can develop in parallel)

**Goal:** Create a "Medium" difficulty AI for each faction so a single player can playtest vs computer.

- [x] AI interface — `Bot`: given `GameState`, return `Action[]` for the turn (stateless)
- [x] Evaluation heuristics — material advantage, board control, threat assessment, leader safety
- [x] Generic strategy layer — target selection, movement strategy, combat decision thresholds
- [x] Faction-specific tactics for all 11 factions:
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
- [x] Army composition selection — default "recommended" comp per faction
- [x] Placement logic — ranged behind melee, leader protected
- [x] "Play vs AI" mode in the web UI

<details>
<summary>Implementation chunks</summary>

#### Chunk 1: AI Framework + Evaluation Heuristics ✅ Complete

1. `src/ai/types.ts` — `Bot` interface (stateless: GameState + PlayerId → Action[]), `BotConfig` for difficulty/faction params
2. `src/ai/evaluate.ts` — Board evaluation heuristics: material advantage (weighted HP), board control, threat assessment, leader safety, base control urgency, unit positioning
3. `src/ai/placement.ts` — Default army composition per faction, placement heuristics (ranged back, melee front, leader protected)
4. `src/ai/strategies/generic.ts` — Generic strategy: target selection (prioritize low-HP/high-value/in-base), movement (advance/retreat), combat thresholds, turn sequencing
5. Tests: evaluation scores are reasonable, placement is legal, generic bot completes games without illegal moves
6. **Scenario tests (S06–S18):** Wire unwired engine features (healing, base control victory, elimination victory) and add corresponding scenario tests. See [`tests/TESTING_PLAN.md`](../tests/TESTING_PLAN.md) §Important scenarios.

#### Chunk 2: Faction-Specific Tactics (11 factions) ✅ Complete

1. `src/ai/strategies/aztecs.ts` — Priest positioning, Jaguar sacrifice tracking
2. `src/ai/strategies/bulgars.ts` — Terrain exploitation, Khan Krum anti-terrain positioning
3. `src/ai/strategies/english.ts` — Arthur upgrade timing, Longbowman crit positioning
4. `src/ai/strategies/huns.ts` — Placeholder basic mounted tactics
5. `src/ai/strategies/japanese.ts` — Samurai multi-adjacent engagement, Nobunaga dual-attack
6. `src/ai/strategies/mongols.ts` — Rush strategy (2-turn win), Kheshig full-movement attacks
7. `src/ai/strategies/muscovites.ts` — Token placement strategy, Streltsy positioning
8. `src/ai/strategies/ottomans.ts` — Medic healing priority, Janissary reload management
9. `src/ai/strategies/romans.ts` — Formation maintenance, Caesar redirect
10. `src/ai/strategies/vandals.ts` — Lone-wolf positioning (Raider/Genseric solo bonuses)
11. `src/ai/strategies/vikings.ts` — Eric double-attack targeting, Berserker aggression
12. `src/ai/strategies/index.ts` — Strategy registry: faction → strategy mapping
13. Tests per faction: bot plays 10 games without errors, verifies ability usage

#### Chunk 3: Bot Runner + UI Integration ✅ Complete

1. `src/ai/bot-runner.ts` — Incremental `stepBot()` + `runBotTurnActions()` batch helper, validation, fallback on invalid actions
2. `src/ai/difficulty.ts` — Difficulty wrapper: Medium = faction strategy, Easy/Hard = stubs for Phase 8
3. `src/ui/hooks/useAIPlayer.ts` — Cancellable AI turn execution hook with abort refs, delay between actions, visual feedback
4. UI integration: "Play vs AI" menu option, AI setup screen (faction + difficulty picker), AI auto-executes turns, controls disabled during AI turn
5. `src/cli/bot-match.ts` — Bot vs Bot CLI: `npm run bot-match -- --faction1 romans --faction2 vikings --seed 42`
6. Tests: stepBot, runBotTurnActions, difficulty factory, all 11 factions complete games via bot runner (381 tests passing)

</details>

**Verification:**
- Each bot completes full games without errors or illegal moves
- Bots make reasonable (not random) moves — manual observation
- Bot vs Bot games produce varied outcomes

---

### Phase 5: Game Logging & Statistics Tracking

> **Status:** Not started<br>
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

> **Status:** Not started<br>
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

> **Status:** Not started<br>
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

> **Status:** Not started<br>
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

> **Status:** Not started<br>
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
