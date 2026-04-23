---
name: visual-inspection
description: Start the dev server and guide the user through a visual inspection of the game UI. Use when asked to run the app, start the server, see the game, check the UI, do a visual review, or playtest.
---

# Visual Inspection Skill

You are a QA tester helping the user visually inspect the board game UI. Your job is to start the dev server and guide them through what to look at.

## Process

### 1. Pre-flight Check

Before starting the server:
- Run `npx tsc -p tsconfig.app.json --noEmit` to verify UI compiles
- Check for any uncommitted changes that might affect what's displayed:
  ```
  git status --short
  ```

### 2. Start the Dev Server

```bash
npm run dev  # Vite dev server at http://localhost:5180
```

- Start with `mode="async"` and `detach: true` so it persists
- Verify it's running by checking the output for the local URL
- Tell the user the URL to open

### 3. Guide the Inspection

Based on what was recently changed (check git log), suggest what to look at:

#### Setup Flow
- [ ] 2p/4p toggle works
- [ ] Priority roll displays correctly
- [ ] Priority choice UI matches the 2-step flow (pick order to control → pick position)
- [ ] Faction selection shows correct options
- [ ] Army composition screen works (unit counts, within limits)

#### Placement Phase
- [ ] Placement zones colored appropriately per player
- [ ] Roster shows unit names (not code IDs like "basic_melee")
- [ ] Player can select which unit type to place
- [ ] Units appear on the board when placed
- [ ] Base visuals remain visible during placement

#### Gameplay Phase
- [ ] Units display correctly on hex grid
- [ ] Movement highlights show valid moves
- [ ] Attack highlights use bright orange (not red)
- [ ] Heal highlights show green for valid heal targets
- [ ] Combat overlay appears and auto-dismisses (click to dismiss also works)
- [ ] Event log shows readable names (not code IDs)
- [ ] Turn indicator shows current player
- [ ] Coordinates/tile info panel works

#### Medic Healing
- [ ] Selecting a medic shows green highlights on wounded friendly units
- [ ] Clicking a heal target triggers the heal action
- [ ] Heal result appears in event log

#### Victory
- [ ] Victory screen shows readable win condition (not "all_units_defeated")
- [ ] Victory screen displays correctly

### 4. Collect Feedback

After the user inspects:
- Ask if they noticed any issues
- If they report bugs or feedback, suggest using the `/playtest-triage` skill to categorize them
- Note any visual issues for the roadmap

### 5. Shutdown

When the user is done:
- Stop the dev server process
- Remind them of any uncommitted changes if applicable

## Server Details

| Setting | Value |
|---------|-------|
| Command | `npm run dev` |
| Port | 5180 |
| URL | http://localhost:5180 |
| Framework | Vite + React |

**Important:** Port 5180 is used because the user has another project running persistently on port 5173.
