---
name: chunk-implementation
description: Execute a roadmap chunk end-to-end following the project's standard workflow. Use when asked to implement a chunk, start the next phase, build the next feature set, or do the next roadmap item. Handles the full plan-implement-test-commit cycle.
---

# Chunk Implementation Skill

You are a senior engineer implementing a chunk from the project roadmap. Follow the established workflow precisely.

## Workflow

### Phase 0: Preparation

1. **Read the chunk plan** from `docs/ROADMAP.md`
   - Find the current phase and the specific chunk to implement
   - Read all items listed in the chunk (files to create/modify, features, tests)

2. **Verify prerequisites**
   - Check that prior chunks in this phase are marked ✅
   - Run `npm test` to confirm baseline (all tests passing)
   - Run `npx tsc --noEmit` to confirm clean compilation

3. **Update tracking**
   ```sql
   UPDATE todos SET status = 'in_progress' WHERE id = 'CHUNK_ID';
   ```

### Phase 1: Research & Plan

4. **Explore the codebase** for context on all files you'll touch
   - Read current implementations of files you'll modify
   - Understand existing patterns, interfaces, and conventions
   - Check for related tests that might need updates

5. **Draft implementation plan**
   - List specific changes per file
   - Identify risks and edge cases
   - Note any decisions that need user input

6. **Get rubber-duck critique** on the plan
   - Present the plan to the rubber-duck agent
   - Adopt findings that prevent bugs or test failures
   - Document any findings you set aside and why

### Phase 2: Implement

7. **Implement changes** following project conventions:
   - Pure functions over immutable state
   - Seeded RNG everywhere (never `Math.random()`)
   - Data-driven faction/unit definitions
   - TypeScript strict mode
   - `Segoe UI` font family for any UI text

8. **Write tests** for every new function/feature:
   - Unit tests for pure functions
   - Integration tests for state transitions
   - Scenario tests for multi-action sequences (in `tests/engine/scenarios.test.ts`)
   - Follow patterns in `tests/README.md`

### Phase 3: Validate

9. **Run all checks**:
   ```bash
   npx tsc --noEmit                         # Engine typecheck
   npx tsc -p tsconfig.app.json --noEmit    # UI typecheck
   npm test                                  # All tests
   ```

10. **Fix any failures** — iterate until all green

11. **If UI changes were made**, offer to start dev server for visual verification:
    ```bash
    npm run dev  # Starts at localhost:5180
    ```

### Phase 4: Commit & Update

12. **Commit** with the standard format:
    ```
    Phase N Chunk M: Title - summary of deliverables

    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
    ```

13. **Push** to remote

14. **Update ROADMAP.md**:
    - Mark chunk items with `- [x]`
    - Add ✅ to chunk header
    - Update phase status line
    - Add any new known issues discovered

15. **Update SQL tracking**:
    ```sql
    UPDATE todos SET status = 'done' WHERE id = 'CHUNK_ID';
    ```

## Code Conventions Reference

| Convention | Rule |
|-----------|------|
| State management | Every action produces a new `GameState` (immutable) |
| Randomness | Use `SeededRNG` from `src/engine/rng.ts` |
| Faction data | Changes go in `src/engine/data/`, not code |
| Testing | Vitest with `npm test` |
| Abilities | Composable handler/registry in `src/engine/abilities/` |
| Board positions | Use `offsetToCube()` in tests, never raw `cube()` |
| UI Font | `Segoe UI` everywhere |
| Dev server port | 5180 (not 5173, which is used by another project) |
| npm installs | Use `--legacy-peer-deps` flag (React 19 conflicts) |

## Key Files

| File | Role |
|------|------|
| `docs/ROADMAP.md` | Chunk plans, status tracking |
| `src/engine/types.ts` | Central type definitions |
| `src/engine/game.ts` | Core state machine |
| `src/engine/validation.ts` | Action validation |
| `src/engine/actions.ts` | Legal action enumeration |
| `src/engine/combat.ts` | Attack/heal resolution |
| `src/engine/abilities/handlers.ts` | Ability implementations |
| `tests/engine/scenarios.test.ts` | Scenario tests |

## Error Recovery

- If tests fail after implementation, read the error carefully and fix
- If type errors appear, check that all new types are exported and imported correctly
- If a scenario test fails, verify board positions use `offsetToCube()` not `cube()`
- If the rubber-duck critique reveals a fundamental issue, revise the plan before continuing
- If you get stuck on repeated failures, call the rubber-duck agent for analysis
