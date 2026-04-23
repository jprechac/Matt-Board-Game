---
name: session-catchup
description: Catch up on project status after returning from a break. Use when asked to summarize current state, check where we left off, resume work, get a status update, or when the user says they're coming back after a break.
---

# Session Catchup Skill

You are a project manager helping a developer resume work on a hex-based strategy board game engine after a break. Your job is to provide a clear, actionable status update.

## Process

### 1. Read Project Status Sources (in this order)

1. **`docs/ROADMAP.md`** — The single source of truth for project status, phase/chunk plans, and known issues. Look at:
   - Each phase's `> **Status:**` line
   - Which chunks have ✅ (done), 🔄 (in progress), or no marker
   - Any `**Known Issues:**` sections
   - What the next planned chunk/phase is

2. **Session plan.md** — Check if there's an active plan with in-progress work

3. **SQL todos table** — Query for current todo status:
   ```sql
   SELECT id, title, status FROM todos ORDER BY
     CASE status WHEN 'in_progress' THEN 1 WHEN 'blocked' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END;
   ```

4. **Git log** — Check recent commits for what was last completed:
   ```
   git --no-pager log --oneline -10
   ```

5. **Working tree** — Check for uncommitted changes:
   ```
   git status --short
   ```

### 2. Run Health Checks

Verify the project builds and tests pass:

1. **TypeScript compilation**: `npx tsc --noEmit` (engine) and `npx tsc -p tsconfig.app.json --noEmit` (UI)
2. **Test suite**: `npm test` — note total count and any failures
3. **If tests fail**: Identify whether failures are pre-existing or from uncommitted changes

### 3. Present the Status Update

Structure the update as:

#### 📍 Where We Are
- Current phase and chunk (from ROADMAP)
- What was last completed (from git log)
- Any in-progress work (from todos/plan)

#### ✅ What's Working
- Test count and pass rate
- TypeScript compilation status
- Any uncommitted changes in the working tree

#### 🔜 What's Next
- The next todo/chunk from the roadmap
- Any blocked items and why
- Any known issues that need attention

#### ⚠️ Heads Up
- Any test failures or type errors discovered
- Any dependency issues
- Anything that changed since last session (if detectable)

### 4. Offer Next Steps

Ask the user what they'd like to do:
- Continue with the next roadmap item
- Review/test the current state (start dev server)
- Address any issues found during catchup
- Something else

## Key Project Files

| File | Purpose |
|------|---------|
| `docs/ROADMAP.md` | Project roadmap — phases, chunks, status, known issues |
| `docs/core-rules.md` | Game rules (source of truth for mechanics) |
| `docs/factions/*.md` | Per-faction rules and unit stats |
| `tests/TESTING_PLAN.md` | Test coverage gaps and scenario catalog |
| `tests/README.md` | Testing guide and conventions |
| `.github/copilot-instructions.md` | Development workflow conventions |
| `package.json` | Dependencies and scripts |

## Commands Reference

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests (Vitest) |
| `npx tsc --noEmit` | Typecheck engine |
| `npx tsc -p tsconfig.app.json --noEmit` | Typecheck UI |
| `npm run dev` | Start Vite dev server (port 5180) |
| `git --no-pager log --oneline -10` | Recent commits |
| `git status --short` | Uncommitted changes |

## Tone

Be concise and actionable. The user just got back and wants to quickly orient themselves, not read a novel. Use bullet points and tables. Highlight anything that needs attention.
