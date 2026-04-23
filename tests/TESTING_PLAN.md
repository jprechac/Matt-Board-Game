# Testing Plan

> Comprehensive gap analysis, scenario catalog, and prioritized plan for achieving robust test coverage.

## Current Coverage Summary

### What's Well-Tested ✅

| Area | Tests | Type |
|------|-------|------|
| Hex math (coords, distance, neighbors, BFS, LOS) | 45 | Unit |
| Board creation, zones, boundaries | 20 | Unit |
| Seeded RNG determinism & distribution | 8 | Unit |
| Faction/unit data integrity | 20 | Unit |
| Combat math (to-hit, damage, crits, proximity) | 24 | Unit |
| Movement range, validation, reachability | 24 | Unit |
| Setup flow (priority, factions, army comp) | 16 | Integration |
| Placement flow | 5 | Integration |
| Gameplay basics (move, attack, end turn) | 14 | Integration |
| Action validation per phase | 11 | Integration |
| Game recording & replay system | 46 | Integration |
| 12 ability handlers (onAttack/onDefend/onMove) | 23 | Unit |
| UI components (rendering, clicks, hooks) | 60 | Component |

### What's Partially Tested ⚠️

| Area | What Exists | What's Missing |
|------|-------------|----------------|
| Post-attack movement | Math tested | No end-to-end scenario (attack → move → blocked) |
| Base control | Event emission tested | Timer win threshold not tested |
| Win conditions | Surrender tested | Elimination & base control victory not tested |
| Ability modifiers in combat | Handlers return correct mods | Not tested through full `applyAttackAction` flow |

### What's Not Tested ❌

| Area | Impact | Root Cause |
|------|--------|------------|
| **Scenario tests** (multi-action gameplay sequences) | HIGH — playtesting found 3 engine bugs that tests missed | No scenario test file exists |
| **Healing through engine** | HIGH — medic can't heal in game | `resolveHeal()` exists but isn't wired into any action handler |
| **Secondary attacks** | MEDIUM — samurai/Oda can't use ranged throw | `secondaryAttack` defined in data but not in `applyAttackAction` |
| **Extra attacks** (dual_attack, double_attack) | MEDIUM — ability returns `extraAttacks: 1` but engine ignores it | No multi-attack loop in combat resolution |
| **Base control win** | HIGH — game can't end via base control | `checkBaseControl` runs but timer may never trigger win |
| **Elimination win** | MEDIUM — verified in code review but never exercised in tests | Hard to set up: need all units of one player dead |
| **Mongol reduced base control timer** | LOW — constant exists but untested | Edge case for specific faction |
| **Terrain effects** | LOW — system not yet implemented | Planned for Phase 4 |
| **4-player games** | LOW — board tested, flow not | Only 2p games exercised in tests |
| **Active abilities** (`ability` action type) | MEDIUM — throws "not implemented" | Planned for future phase |
| **Reactive abilities** (redirect_attack) | LOW — stub only | Requires combat event hooks |

---

## Scenario Test Catalog

These are the scenarios that should exist in `tests/engine/scenarios.test.ts`. Each simulates a real gameplay situation by creating a game state and running a sequence of actions.

### Priority: 🔴 Critical (Phase 3.5)

These test rules that were already broken in playtesting.

| ID | Scenario | Actions | Verifies |
|----|----------|---------|----------|
| S01 | **Post-attack movement cap** | Move 2 → attack → move 1 → attempt move | Unit can't move more than 1 hex after attacking |
| S02 | **Post-attack movement with no remaining** | Move 3 (all movement) → attack → attempt move | Unit can't move at all (no base movement left) |
| S03 | **Samurai adjacency at melee range** | Position samurai adjacent to 2+ enemies → attack adjacent | Gets -1 to-hit modifier |
| S04 | **Samurai adjacency at range 2** | Position samurai with 2+ adjacent enemies → attack at range 2 | Does NOT get -1 to-hit (melee only) |
| S05 | **Priority 2-step flow** | Winner picks factionOrder+second, loser picks moveOrder+first | Correct faction and move orders set |

### Priority: 🟡 Important (Phase 3.5 Chunk 2 / Phase 4)

These test features that exist in the engine but have never been exercised end-to-end.

| ID | Scenario | Actions | Verifies |
|----|----------|---------|----------|
| S06 | **Unit elimination** | Attack enemy until HP=0 | Target removed from play, `unitKilled` event emitted |
| S07 | **Win by elimination** | Kill all enemy units | Game enters victory phase with `all_units_defeated` |
| S08 | **Win by base control** | Occupy enemy base for 3 turns | Base control timer triggers victory |
| S09 | **Base control timer reset** | Occupy base 2 turns, vacate, re-occupy | Timer resets to 0 when vacated |
| S10 | **Mongol reduced base control** | Mongol player occupies base for 2 turns | Victory at 2 instead of 3 |
| S11 | **Ranged proximity penalty** | Ranged unit attacks adjacent enemy | +1 to-hit penalty applied |
| S12 | **Ranged noProximityPenalty** | Samurai uses ranged throw at melee range | No proximity penalty (flag set) |
| S13 | **Streltsy blocks move-and-attack** | Melee unit moves then attacks Streltsy | Attack blocked by defense ability |
| S14 | **Streltsy allows stationary melee** | Melee unit attacks Streltsy without moving | Attack succeeds |
| S15 | **Formation bonus in combat** | Legionnaire attacks with adjacent ally | -1 to-hit modifier applied through engine |
| S16 | **Lone wolf bonus** | Raider attacks with no adjacent allies | -1 to-hit modifier applied through engine |
| S17 | **Kheshig full movement bonus** | Kheshig uses all movement then attacks | -1 to-hit modifier applied through engine |
| S18 | **Anti-basic damage** | Pillager attacks basic melee unit | +1 damage modifier applied through engine |

### Priority: 🟢 Nice-to-Have (Phase 4+)

These test edge cases and advanced features not yet fully implemented.

| ID | Scenario | Actions | Verifies |
|----|----------|---------|----------|
| S19 | **Heal action** | Medic uses ability on adjacent wounded ally | HP increases, medic's turn consumed |
| S20 | **Janissary reload cycle** | Janissary attacks → forced reload turn → attacks again | Reload state tracked, movement restricted during reload |
| S21 | **Extra attacks (double_attack)** | Viking leader attacks → gets second attack | Both attacks resolved against same or different targets |
| S22 | **Dual attack (Oda/Samurai)** | Japanese leader uses melee + ranged in one turn | Both primary and secondary attack profiles used |
| S23 | **Jaguar sacrifice counter** | Jaguar Warrior kills 2 enemies | `sacrificeCount` increments, +1 damage unlocked |
| S24 | **Dead unit cleanup** | Kill a unit, verify it can't be selected/moved/attacked | Dead units excluded from all interactions |
| S25 | **Turn reset** | End turn, verify all unit flags reset | `movementUsedThisTurn`, `hasAttackedThisTurn`, etc. all 0/false |
| S26 | **Active unit blocking** | Select unit A, try to select unit B | Only active unit can act while another is mid-turn |
| S27 | **Placement zone enforcement** | Try to place unit outside zone | Placement rejected |
| S28 | **Placement alternation** | Players alternate placing 2 units at a time | batchCount cycles correctly between players |
| S29 | **4-player setup flow** | 4 players complete full setup | All 4 players get factions, armies, placements |
| S30 | **Itzcoatl aura** | Aztec leader's aura affects allies within 2 hexes | Allies get -1 to-hit when in aura range |
| S31 | **Cossack slow** | Cossack starts turn adjacent to enemy | Movement reduced to 3 |
| S32 | **Terrain placement** | Place terrain in terrain zone | Terrain appears on board (when system implemented) |
| S33 | **Terrain combat effects** | Attack from/through terrain | Terrain modifiers applied (when system implemented) |

---

## Unwired Engine Features

These features have code written but are **not connected** to the game action flow. They need both engine wiring AND scenario tests.

| Feature | Code Location | What Exists | What's Missing |
|---------|---------------|-------------|----------------|
| **Healing** | `combat.ts:resolveHeal()` | Roll-based heal with thresholds, max HP cap | No `heal` action type; no `applyHealAction` in game.ts; `getUnitActions` doesn't return heal targets |
| **Secondary attacks** | `types.ts:UnitDefinition.secondaryAttack` | Attack profile defined on samurai/Oda | `applyAttackAction` always uses `attackerDef.attack`; no attack profile selection |
| **Extra attacks** | `abilities/types.ts:CombatModifiers.extraAttacks` | Returned by dual_attack, double_attack handlers | `applyAttackAction` doesn't loop for extra attacks; `hasAttackedThisTurn` set after first attack |
| **Active abilities** | `types.ts:AbilityAction` | Action type defined, handler interface has `canActivate`/`activate` | `applyActionDetailed` throws "not yet implemented" |
| **Terrain effects** | `types.ts:TerrainType`, board cells have terrain field | Type stubs, zone definitions | No terrain data, no combat/movement modifiers |
| **Basic ranged restriction** | `handlers.ts:basicRangedRestrictedMovement` | Handler registered with empty onMove | Restriction not enforced in movement validation |

---

## Implementation Plan

### Where Scenario Tests Fit in the Roadmap

| Phase | Testing Work | Rationale |
|-------|-------------|-----------|
| **Phase 3.5 Chunk 2** (current) | Add S01–S05 (critical scenarios for bugs we just fixed) | Verify the fixes actually work end-to-end |
| **Phase 4 Chunk 1** | Add S06–S18 as part of "wire healing, extra attacks, base control" | Test features as they're properly connected |
| **Phase 4 Chunk 2+** | Add S19–S28 alongside ability implementation | Test advanced abilities as they're built |
| **Phase 5+** | Add S29–S33 (4p, terrain) | Test features as they're implemented |

### File Structure for New Tests

```
tests/engine/scenarios.test.ts     # Multi-action gameplay scenarios (S01–S28)
tests/engine/scenarios-4p.test.ts  # 4-player specific scenarios (S29)
tests/engine/terrain.test.ts       # Terrain system tests (S32–S33, when implemented)
```

### Scenario Test Pattern

All scenario tests follow this structure:

```typescript
describe('Scenario: post-attack movement cap', () => {
  it('prevents movement beyond 1 hex after attacking', () => {
    // 1. ARRANGE: Create game state with units in specific positions
    const state = createScenarioState({
      units: [
        { id: 'warrior', typeId: 'basic_melee', player: 'player1', position: [5, 5] },
        { id: 'target', typeId: 'basic_melee', player: 'player2', position: [5, 6] },
      ],
    });

    // 2. ACT: Execute action sequence
    let s = applyAction(state, { type: 'move', unitId: 'warrior', to: adjacentTo(5, 6) });
    s = applyAction(s, { type: 'attack', unitId: 'warrior', targetId: 'target' });
    s = applyAction(s, { type: 'move', unitId: 'warrior', to: oneHexAway });

    // 3. ASSERT: Verify outcomes
    expect(getAvailableMovement(getUnit(s, 'warrior'))).toBe(0);
    expect(() => applyAction(s, { type: 'move', unitId: 'warrior', to: twoHexAway }))
      .toThrow('not reachable');
  });
});
```

---

## Test Quality Guidelines

### What Makes a Good Scenario Test

1. **Tests a rule, not an implementation** — "unit can't move after attacking" not "movementUsedAtAttack field is set"
2. **Uses real engine actions** — `applyAction()`, not direct function calls
3. **Verifies observable outcomes** — check game state, not internal fields
4. **Has a clear failure message** — test name describes the rule being violated
5. **Is self-contained** — doesn't depend on other tests' side effects

### What NOT to Scenario-Test

- Math that's already unit-tested (hex distance, RNG distribution)
- UI rendering (use component tests for that)
- Data integrity (faction stats — already in factions.test.ts)

### Coverage Targets

| Category | Current | Target | Notes |
|----------|---------|--------|-------|
| Engine unit tests | 249 | 260+ | Fill remaining ability gaps |
| Engine scenario tests | 0 | 30+ | S01–S28 |
| UI component tests | 60 | 70+ | Add scenario-related UI tests |
| Integration tests | 2 | 5+ | Add base control, elimination paths |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | Initial testing plan created. Identified 33 scenario tests across 3 priority tiers. |
