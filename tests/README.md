# Testing Guide

> How to run, write, and organize tests for the board game engine and UI.

## Quick Start

```bash
# Run all tests
npm test

# Run with watch mode
npx vitest

# Run specific file
npx vitest tests/engine/combat.test.ts

# Run tests matching a name pattern
npx vitest -t "samurai"

# Typecheck (engine + UI)
npx tsc --noEmit && npx tsc -p tsconfig.app.json --noEmit
```

## Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner & assertions |
| **@testing-library/react** | React component testing |
| **jsdom** | Browser DOM simulation (UI tests only) |

- Engine tests run in Node (no DOM needed)
- UI tests require `// @vitest-environment jsdom` at top of file

## File Organization

```
tests/
├── engine/                 # Pure engine logic tests
│   ├── abilities.test.ts   # Ability handler unit tests
│   ├── actions.test.ts     # Legal action enumeration + base control events
│   ├── board.test.ts       # Board creation, zones, boundaries
│   ├── combat.test.ts      # Attack resolution, healing math, validation
│   ├── game.test.ts        # Game state machine (setup → placement → gameplay)
│   ├── hex.test.ts         # Hex coordinate math, pathfinding, LOS
│   ├── integration.test.ts # Full game lifecycle (setup through surrender)
│   ├── movement.test.ts    # Movement range, validation, post-attack limits
│   ├── recorder.test.ts    # Game recording, event emission
│   ├── replay.test.ts      # Replay navigation, caching, serialization
│   ├── rng.test.ts         # Seeded RNG determinism, distribution
│   ├── validation.test.ts  # Action validation per phase
│   ├── scenarios.test.ts   # ← PLANNED: Multi-action game scenario tests
│   └── data/
│       └── factions.test.ts # Faction/unit data integrity
├── ui/                     # React component + hook tests
│   ├── e2e.test.tsx        # CombatOverlay, App menu, engine lifecycle
│   ├── gameFlow.test.tsx   # SetupScreen, TurnIndicator, EventLog
│   ├── gameState.test.tsx  # useGameState hook behavior
│   ├── hexGrid.test.tsx    # Hex rendering, layout, click handling
│   └── unitInteraction.test.tsx  # UnitToken, UnitInfoPanel
├── README.md               # This file
└── TESTING_PLAN.md          # Comprehensive testing plan & gap analysis
```

## Test Categories

### 1. Unit Tests
Test a single function in isolation with mock inputs. Most of our engine tests are this.

```typescript
// Example: testing an ability handler directly
const mods = ability.onAttack!(makeCtx(samurai, [samurai, enemy1, enemy2]), enemy1);
expect(mods.toHitModifier).toBe(-1);
```

### 2. Integration Tests
Drive the engine through `applyAction()` with real `GameState`, verifying state transitions.

```typescript
// Example: testing full setup flow
let state = createGame(config);
state = applyAction(state, { type: 'choosePriority', ... });
expect(state.setupState!.currentStep).toBe('loserChoosePriority');
```

### 3. Scenario Tests ← GAP
Create a board with positioned units and run multi-action sequences simulating real gameplay.
These are the tests most likely to catch rule bugs (and the type we're currently missing).

```typescript
// Example: testing post-attack movement cap end-to-end
// 1. Create game in gameplay phase with units positioned
// 2. Move unit adjacent to enemy
// 3. Attack enemy
// 4. Move 1 hex away → should succeed
// 5. Attempt move again → should fail
```

## Writing Tests

### Test Helpers

Most test files define a `makeUnit()` helper for creating Unit objects:

```typescript
function makeUnit(overrides: Partial<Unit> & { id: string; position: CubeCoord }): Unit {
  return {
    typeId: 'test', playerId: 'player1', factionId: 'vikings',
    category: 'specialty', currentHp: 5, maxHp: 5, movement: 3,
    hasMovedThisTurn: false, hasAttackedThisTurn: false,
    hasUsedAbilityThisTurn: false, movementUsedThisTurn: 0,
    movementUsedAtAttack: 0, activatedThisTurn: false,
    abilityState: {},
    ...overrides,
  };
}
```

### Ability Registration

Abilities must be registered before tests that use them:

```typescript
import { registerAllAbilities } from '../../src/engine/abilities/index.js';
registerAllAbilities(); // Call at module level or in beforeAll
```

### Setting Up a Full Game for Gameplay Testing

Use the 2-step priority flow:

```typescript
function setupToGameplay(seed = 42): GameState {
  let state = createGame({ boardSize: '2p', playerIds: ['player1', 'player2'], seed });
  const winner = state.currentPlayerId;
  const loser = state.players.find(p => p.id !== winner)!.id;
  state = applyAction(state, {
    type: 'choosePriority', playerId: winner,
    orderToControl: 'factionOrder', position: 'first',
  });
  state = applyAction(state, {
    type: 'choosePriority', playerId: loser, position: 'first',
  });
  // ... selectFaction, setArmyComposition, placeUnit for each unit ...
  return state;
}
```

## Gotchas

- **`movementUsedAtAttack`** — must be included in all makeUnit helpers (added in Phase 3.5)
- **`scrollTo`** — doesn't exist in jsdom; guard with `if (ref?.scrollTo)`
- **`screen.getByTestId`** — accumulates across renders in testing-library; use `container.querySelector` instead
- **`--legacy-peer-deps`** — required for npm installs due to React 19 peer dep conflicts
- **`@testing-library/dom`** — must be explicitly installed (not auto-pulled by React testing lib)

## Current Stats

| Metric | Value |
|--------|-------|
| Test files | 18 |
| Total tests | 309 |
| Engine tests | 249 |
| UI tests | 60 |
| Test runtime | ~5–6s |
