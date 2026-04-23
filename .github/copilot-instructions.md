# Copilot Instructions

## Project Overview

This is a hex-based strategy board game engine in TypeScript. The project follows a phased roadmap (`docs/ROADMAP.md`) where each phase is broken into sequentially-dependent chunks. The ROADMAP is the single source of truth for project status, chunk plans, and known issues.

## Development Workflow

### Phase & Chunk Structure

- Work is organized into **Phases** (major milestones) and **Chunks** (implementable units within a phase).
- Each chunk has strict dependency ordering — chunks within a phase are sequential; phases may depend on prior phases.
- Chunk plans live in `docs/ROADMAP.md` under each phase as collapsible `<details>` blocks.
- Each chunk lists: specific files to create/modify, what to implement, and what tests to write.

### Planning a Chunk

When planning new chunks for a phase:

1. Analyze the ROADMAP to understand the phase's goals and dependencies.
2. Review the codebase to understand what's already built.
3. Break the phase into chunks with clear boundaries — each chunk should be independently committable and testable.
4. Each chunk plan should list specific files, implementation items, and test expectations.
5. Add chunk plans to `docs/ROADMAP.md` as `<details>` blocks under the phase.

### Implementing a Chunk

When implementing a chunk:

1. Read the chunk plan from `docs/ROADMAP.md`.
2. Implement all items listed in the chunk.
3. Write tests for every new module/function.
4. Ensure all tests pass (`npm test`) and TypeScript compiles clean (`npx tsc --noEmit`).
5. Commit with message format: `Phase N Chunk M: Title - summary of deliverables`.

### Validating a Chunk

After a chunk is completed (by any agent or session):

1. **Run all tests**: `npm test` — verify all pass, note the total count.
2. **Type check**: `npx tsc --noEmit` — verify zero errors.
3. **Code review**: Review new/changed files for correctness against game rules in `docs/core-rules.md` and `docs/factions/*.md`.
4. **Update ROADMAP**: 
   - Mark the chunk with ✅ in the `<details>` block.
   - Check off completed checklist items (`- [x]`).
   - Update the phase status line (e.g., "Chunk 2 of 3" → "Chunk 3 of 3").
5. **Log issues**: Add any bugs or issues found to the **Known Issues** section under the relevant phase in the ROADMAP as `- [ ]` items with file location, description, and fix guidance.

### Tracking Status

- Phase status is tracked in the `> **Status:**` line under each phase heading.
- Chunk status uses emoji: ✅ (done), 🔄 (in progress), no marker (not started).
- Individual deliverables use `- [x]` / `- [ ]` checkboxes.
- Known issues use `- [ ]` under a `**Known Issues:**` heading within the phase.

## Code Conventions

- **Pure functions over immutable state** — every action produces a new `GameState`.
- **Seeded RNG everywhere** — use `SeededRNG` from `src/engine/rng.ts`, never `Math.random()`.
- **Data-driven faction/unit definitions** — balance changes are data file edits in `src/engine/data/`, not code changes.
- **TypeScript strict mode** with ES2022 modules.
- **Vitest** for testing (`npm test`).
- **Ability system** uses a composable handler/registry pattern (`src/engine/abilities/`).

## Copilot Skills

Custom skills are in `.github/skills/`. Use them by name in prompts or with `/skillname`.

| Skill | When to Use | What It Does |
|-------|-------------|--------------|
| **session-catchup** | Returning after a break, "where are we?", status check | Reads ROADMAP + git log + tests, presents current state and next steps |
| **chunk-implementation** | "Implement the next chunk", "start Phase X" | Full workflow: plan → rubber-duck critique → implement → test → commit → push |
| **test-scenario-audit** | "Check test gaps", "audit coverage", after adding features | Scans engine code vs. tests vs. game rules, identifies missing scenarios |
| **playtest-triage** | User provides playtest notes or bug reports | Classifies each item (bug/UX/polish), assigns priority, maps to roadmap phase |
| **visual-inspection** | "Run the app", "let me see the UI", visual review | Starts dev server (port 5180), provides checklist of what to inspect |

## Key Files

- `docs/ROADMAP.md` — Project roadmap, phase/chunk plans, status tracking, known issues.
- `docs/core-rules.md` — Game rules (source of truth for mechanics).
- `docs/factions/*.md` — Per-faction rules and unit stats (source of truth for abilities).
- `src/engine/` — Pure game engine (no UI dependencies).
- `tests/engine/` — Engine test files (mirrors `src/engine/` structure).
