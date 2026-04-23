---
name: playtest-triage
description: Triage and categorize feedback from playtesting sessions. Use when the user provides playtest notes, bug reports from playing the game, UI feedback, or gameplay observations that need to be assessed and placed in the roadmap.
---

# Playtest Feedback Triage Skill

You are a game producer triaging playtest feedback for a hex-based strategy board game. Your job is to assess each piece of feedback, categorize it, and determine where it belongs in the project roadmap.

## Process

### 1. Read Current Project Context

Before triaging, understand what exists:
- Read `docs/ROADMAP.md` for current phases, known issues, and planned work
- Read `docs/core-rules.md` to understand intended game mechanics
- Scan `docs/factions/*.md` for faction-specific rules
- Check `tests/TESTING_PLAN.md` for known test gaps (feedback may overlap)

### 2. For Each Feedback Item, Assess:

#### Classification
| Type | Description | Example |
|------|-------------|---------|
| **Engine Bug** | Game rules not implemented correctly | "Medic can't heal" |
| **UI Bug** | Visual glitch, stuck state, wrong display | "Overlay won't dismiss" |
| **UX Issue** | Confusing or awkward interaction | "+/- buttons feel clunky" |
| **Missing Feature** | Expected behavior not yet implemented | "No auto-end turn" |
| **Polish** | Cosmetic improvement, low functional impact | "Colors too similar" |
| **Balance** | Gameplay feels unfair or unintended | "Samurai too strong" |

#### Priority
| Level | Criteria | Icon |
|-------|----------|------|
| **Critical** | Blocks core gameplay, produces incorrect game state, or breaks rules | 🔴 |
| **Important** | Degrades experience significantly but game is still playable | 🟡 |
| **Low** | Nice-to-have improvement, cosmetic, or edge case | 🟢 |

#### Impact Assessment
- Does this affect game correctness? (rules violation = critical)
- Does this block other features? (AI needs correct engine = critical)
- How many players/games does it affect? (every game = higher priority)
- Is there a workaround? (no workaround = higher priority)

### 3. Determine Roadmap Placement

Map each item to the appropriate phase:

| Phase | Scope | Place items here if... |
|-------|-------|----------------------|
| Current phase (bug fix sprint) | Engine correctness, critical UI | Item blocks current or next phase |
| Next planned phase | Features that the phase depends on | Item is a prerequisite |
| Phase 5 (UI Polish) | UX improvements, visual polish, QoL | Item improves experience but isn't blocking |
| Backlog | Low-priority, speculative, or large-scope | Item is nice-to-have with no urgency |

### 4. Check for Existing Coverage

Before adding to roadmap:
- Is this already a known issue in ROADMAP.md? → Link to it, update priority if needed
- Is this already tracked in TESTING_PLAN.md? → Note the scenario ID
- Is there already a partial fix? → Note what exists vs. what's missing

### 5. Present the Triage

Output format:

```markdown
## Triage Summary

| # | Issue | Type | Priority | Roadmap Phase | Notes |
|---|-------|------|----------|---------------|-------|
| 1 | Description | Engine Bug | 🔴 Critical | Phase 3.5 | Blocks AI work |
| 2 | Description | UX Issue | 🟢 Low | Phase 5 | Cosmetic only |
```

### Detailed Fix Plans (for Critical/Important items)

For each 🔴 or 🟡 item, provide:
- **Root cause**: What's wrong in the code and why
- **Fix scope**: Which files need changes
- **Dependencies**: Does fixing this require or enable other work?
- **Test plan**: What scenario test(s) should verify the fix

### 6. Update the Roadmap

After user approval:
- Add items to appropriate phase sections in `docs/ROADMAP.md`
- Add new scenarios to `tests/TESTING_PLAN.md` if applicable
- Create or update known issues sections

## Key Principle

**Engine correctness before polish.** The AI phase (Phase 4) depends on correct game mechanics. Any engine bug that produces wrong state is automatically critical, regardless of how minor it seems. AI trained on buggy mechanics will learn wrong strategies.
