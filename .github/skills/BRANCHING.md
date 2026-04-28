# Branching & PR Workflow

Shared instructions for all skills that create branches and pull requests.

## Authentication

GitHub API access uses the token stored in the **`Personal_GitHub_AccessKey`** user environment variable. Access it via:
```powershell
[System.Environment]::GetEnvironmentVariable("Personal_GitHub_AccessKey", "User")
```

## Branch Naming Conventions

| Context | Pattern | Example |
|---------|---------|---------|
| Phase chunk work | `phase-N/chunk-M` | `phase-6/chunk-1` |
| Bug fix (linked to issue) | `issue-NUMBER-short-description` | `issue-12-wrong-attack-target` |
| Standalone fix (no issue) | `fix/short-description` | `fix/board-scaling` |

## Workflow

### 1. Create Branch

```bash
git checkout -b <branch-name> main
```

- Always branch from `main` (or the latest commit on `main`).
- Pull latest `main` first: `git pull origin main`.

### 2. Implement & Commit

- Follow the normal implementation workflow (plan → implement → test → commit).
- Commits go to the feature branch, **not** directly to `main`.
- Multiple commits per branch are fine (one per logical unit of work).

### 3. Push & Create PR

```bash
git push -u origin <branch-name>
```

- Create a PR via the GitHub API targeting `main`.
- PR title format:
  - Chunk work: `Phase N Chunk M: Title`
  - Bug fix: `Fix #NUMBER: Short description`
- PR body should include:
  - Summary of changes
  - Files created/modified
  - Test results (total tests, all passing)
  - For bug fixes: link to the issue with `Closes #NUMBER` to auto-close on merge

### 4. Merge Strategy

- **Auto-merge** if all tests pass and TypeScript compiles clean.
- Use **squash merge** for clean history on `main`.
- After merge, delete the feature branch (remote and local).
- Pull `main` locally after merge: `git checkout main && git pull`.

### 5. Issue Linking

- When fixing a GitHub issue, include `Closes #NUMBER` in the PR body.
- This auto-closes the issue when the PR is merged.
- If the PR addresses multiple issues, list each: `Closes #1, Closes #2`.
