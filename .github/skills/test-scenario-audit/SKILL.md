---
name: test-scenario-audit
description: Comprehensive test coverage audit for the board game engine. Use when asked to check test gaps, plan test scenarios, audit testing coverage, find untested features, or expand test coverage. Also use when new engine features are added and need test plans.
---

# Test Scenario Audit Skill

You are a QA engineer specializing in game engine test coverage. Your job is to identify every testable scenario in the codebase and determine what's covered vs. missing.

## Process

### 1. Gather Current State

- Read `tests/TESTING_PLAN.md` for the existing gap analysis and scenario catalog (S01–S25+)
- Read `tests/README.md` for the testing guide, conventions, and current stats
- Run `npm test` to get the actual current test count and pass/fail status
- Scan all test files in `tests/engine/` and `tests/ui/` to understand what's covered

### 2. Analyze the Engine for Testable Behaviors

For each source file in `src/engine/`, identify:

- **Pure functions** that take inputs and return outputs → unit test candidates
- **State transitions** in game.ts (each action type in the switch) → integration test candidates
- **Validation rules** in validation.ts (each `validate*` function) → both positive and negative cases
- **Ability handlers** in abilities/handlers.ts → unit tests for each `onAttack`/`onDefend`/`onMove`
- **Combat resolution paths** in combat.ts → hit/miss/crit/kill for each profile type
- **Multi-action sequences** that only reveal bugs when chained → scenario test candidates

### 3. Cross-Reference with Game Rules

- Read `docs/core-rules.md` for the authoritative game mechanics
- Read each file in `docs/factions/` for faction-specific abilities and unit stats
- For every rule stated in the docs, verify there's a test that exercises it
- Flag any rule with no corresponding test as a gap

### 4. Categorize Scenarios

Use the priority system from TESTING_PLAN.md:

- 🔴 **Critical**: Tests for features that have had bugs in playtesting, or core mechanics that affect game correctness
- 🟡 **Important**: Tests for features that exist and work but have never been exercised end-to-end
- 🟢 **Nice-to-Have**: Edge cases, rare paths, features planned but not yet implemented

### 5. Generate Test Specifications

For each missing scenario, produce:

```
| ID | Scenario Name | Setup | Actions | Assertions | Priority |
```

Where:
- **Setup**: What game state is needed (which factions, unit positions, HP levels)
- **Actions**: The sequence of `applyAction()` calls
- **Assertions**: What to verify in the resulting state and events
- **Priority**: 🔴/🟡/🟢

### 6. Update Documentation

After the audit:
- Update `tests/TESTING_PLAN.md` with any new scenarios identified
- Update the "Current Stats" section in `tests/README.md` with accurate numbers
- If scenarios were implemented, mark them as complete in the plan

## Scenario Test Patterns

When writing or planning scenario tests, follow these patterns from the existing `tests/engine/scenarios.test.ts`:

```typescript
// Use offsetToCube() for board positions, NOT cube() — cube coords may not be on the board
const pos1 = offsetToCube(9, 9);
const neighbors = cubeNeighbors(pos1);
const validNeighbors = neighbors.filter(n => state.board.cells[hexKey(n)]);

// Helpers for state manipulation
moveUnitTo(state, unitId, position)  // Inject unit position
setUnitHp(state, unitId, hp)         // Set HP for wound scenarios
findUnit(state, typeId, playerId)    // Find a specific unit type

// Full setup to gameplay phase
const state = setupToGameplay(['faction1', 'faction2'], seed);
```

## Key Files to Inspect

- `src/engine/game.ts` — all action handlers, the main state machine
- `src/engine/validation.ts` — all validation rules
- `src/engine/combat.ts` — attack resolution, heal resolution
- `src/engine/actions.ts` — legal action enumeration
- `src/engine/abilities/handlers.ts` — all ability implementations
- `src/engine/movement.ts` — movement range, post-attack limits
- `src/engine/data/factions/` — all faction unit definitions
- `docs/core-rules.md` — authoritative game rules
- `docs/factions/*.md` — faction-specific rules

## Output Format

Present findings as:

1. **Summary**: X tests total, Y scenarios covered, Z gaps found
2. **Gap Table**: Organized by priority with full scenario specs
3. **Recommendations**: Which gaps to address first and why
4. **Updated TESTING_PLAN.md**: If changes were made
