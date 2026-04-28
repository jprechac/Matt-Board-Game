---
name: bug-report
description: Document, branch, fix, test, and PR a bug. Use when a bug is found during playtesting, development, or reported by the user. Handles the full lifecycle from issue creation through verified fix and PR.
---

# Bug Report & Fix Skill

You are a senior engineer handling a bug report end-to-end. Follow this lifecycle precisely.

## Prerequisites

Read the shared branching instructions: `.github/skills/BRANCHING.md`

## Workflow

### Phase 0: Document the Bug

1. **Create a GitHub Issue** (if one doesn't already exist):
   - Title: Clear, concise description of the bug
   - Body should include:
     - **Steps to reproduce** (as specific as possible)
     - **Expected behavior**
     - **Actual behavior**
     - **Environment** (which phase/chunk, relevant files)
     - **Severity**: Critical / Important / Low
   - Labels: `bug`, and optionally `critical` for game-breaking issues
   - Use the `Personal_GitHub_AccessKey` env var for authentication

2. **Check for duplicates** — search existing issues first to avoid duplicates.

### Phase 1: Investigate

3. **Reproduce the bug** if possible:
   - Write a failing test that demonstrates the bug
   - If the bug is UI-only, document the reproduction steps clearly

4. **Root cause analysis**:
   - Identify the exact file(s) and line(s) where the bug originates
   - Understand why the current code produces the wrong behavior
   - Check if the bug affects other areas (related code paths)

### Phase 2: Branch & Fix

5. **Create a feature branch** following `.github/skills/BRANCHING.md`:
   ```bash
   git checkout main && git pull origin main
   git checkout -b issue-NUMBER-short-description
   ```

6. **Write regression tests FIRST** (TDD):
   - Write tests that fail with the current buggy behavior
   - Tests should verify the correct behavior described in the issue
   - Place tests in the appropriate test file (mirrors `src/` structure)

7. **Implement the fix**:
   - Make the minimal change needed to fix the bug
   - Ensure the regression tests now pass
   - Run the full test suite: `npm test`
   - Type check: `npx tsc --noEmit`

### Phase 3: PR & Merge

8. **Commit** with a clear message:
   ```
   Fix #NUMBER: Short description of the fix

   - Root cause: explanation
   - Fix: what was changed and why
   - Tests: N new regression tests added

   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

9. **Push and create a PR** following `.github/skills/BRANCHING.md`:
   - Title: `Fix #NUMBER: Short description`
   - Body: Include `Closes #NUMBER`, summary, test results
   - Auto-merge if all tests pass

10. **Clean up**:
    - After merge, delete the feature branch
    - Switch back to `main` and pull

### Phase 4: Verify

11. **Confirm the issue is closed** on GitHub after PR merge.
12. **Update ROADMAP.md** if the bug was listed in Known Issues.

## Key Principles

- **Every bug fix MUST include regression tests.** No exceptions. The test should fail without the fix and pass with it.
- **Minimal fixes.** Don't refactor unrelated code in a bug fix branch. Keep the diff focused.
- **Document root cause.** The PR description should explain *why* the bug happened, not just what was changed.
- **Check for related bugs.** If one code path is broken, similar paths might be too.

## Severity Guide

| Severity | Criteria | Response |
|----------|----------|----------|
| **Critical** | Incorrect game state, rule violation, data loss | Fix immediately, block other work |
| **Important** | Degraded experience, confusing UI, workaround exists | Fix before next phase |
| **Low** | Cosmetic, edge case, minor annoyance | Add to backlog |
