# Pending GitHub Issues — Game Design Questions

> **Instructions:** Create these in [jprechac/Matt-Board-Game](https://github.com/jprechac/Matt-Board-Game/issues).
> Tag all new issues with the **`question`** label.
> For existing issues, add the comment as described.

---

## Updates to Existing Issues

### #3 — "Need Attila's Stats" → Add Comment

```
**Implementation update:** Attila currently has placeholder stats in the engine
(HP: 9, Move: 4, Range: 1, Dmg: 3, ToHit: 3) — same as the standard leader profile.
His ability is coded as `attila_tbd` (empty placeholder).

**What's still needed:**
1. Are the placeholder stats correct, or does Attila have unique stats?
2. What is Attila's special ability? Every other leader has a defining ability
   (e.g., Eric double-attack, Caesar redirect, Genghis base rush).
   What makes Attila unique?

See `src/engine/data/factions/huns.ts` and `src/engine/abilities/handlers.ts`.
```

### #6 — "Need clarity on how Terrain works" → Add Comment

```
**Implementation update:** The engine has stub infrastructure for terrain but
no actual terrain system yet. Specifically:
- Bulgar `terrain_hit_bonus` ability is coded but returns empty (no terrain to check)
- Bulgar `nullify_terrain` (Khan Krum) is a passive stub
- `TerrainType` in types.ts is an empty stub
- Terrain placement step exists in SetupStep but throws "not yet implemented"

**Specific questions needed to implement:**
1. What terrain types exist? (forest, hills, water, walls?)
2. How is terrain placed? Before/during game? By players or predefined maps?
3. What bonuses/penalties does terrain provide? (cover, movement cost, LoS?)
4. Does terrain block movement entirely or just slow it?
5. How does Khan Krum's "nullify terrain" work — remove terrain, or ignore bonuses?
```

### #5 — "Alter the army composition?" → No changes needed

Already has Matt's comment about simulating 6-specialty / 4-basic variants.
The AI framework now has default compositions per faction that can be used for these simulations.

---

## New Issues to Create

### Issue 1: What does the Aztec Priest's buff ability do?

**Title:** What does the Aztec Priest's buff ability do?
**Label:** `question`
**Body:**
```
The Aztec Priest has an ability called `priest_buff` described as "Can reduce
enemy to-hit or increase ally damage for a turn." The implementation is a
complete stub — actual mechanics are undefined.

**Questions:**
1. Is this an active ability (costs the Priest's action) or passive (aura)?
2. Does it reduce enemy to-hit, increase ally damage, or is it player's choice?
3. What's the range? Adjacent only, or within X hexes?
4. Does it last for one turn or until the Priest acts again?
5. Can the Priest also attack, or is buffing their only action (like the Ottoman
   Medic's heal replaces their attack)?

Reference: `src/engine/abilities/handlers.ts` line 42
```

---

### Issue 2: How does the Roman Centurion's "command attack" work?

**Title:** How does the Roman Centurion's "command attack" work?
**Label:** `question`
**Body:**
```
The Centurion's ability (`command_attack`) is described as "Can command a Basic
Melee unit to attack again." This is currently a stub.

**Questions:**
1. Does the Centurion use their own action to command, or is this in addition
   to their normal attack?
2. Must the basic melee unit be adjacent to the Centurion?
3. Does the commanded unit need to have already attacked this turn, or can it
   be a unit that hasn't acted yet (giving it a bonus action)?
4. Can the commanded unit move before/after the extra attack?
5. Is there a limit? (Once per turn seems implied)

Reference: `src/engine/abilities/handlers.ts` line 264
```

---

### Issue 3: What are the rules for King Arthur's unit upgrade?

**Title:** What are the rules for King Arthur's unit upgrade ability?
**Label:** `question`
**Body:**
```
King Arthur can "upgrade one basic unit to a corresponding specialty unit
before it takes damage." Partial validation exists but is not fully implemented.

**Questions:**
1. Is this an active ability (action cost) or automatic/passive?
2. Can Arthur upgrade any basic type to any specialty?
   Or does basic_melee → Knight and basic_ranged → Longbowman specifically?
3. How many upgrades per game? One total? One per turn? Unlimited?
4. Does "before it takes damage" mean the basic unit must be at full HP?
5. Does the upgrade happen during Arthur's turn, or can it trigger at any time?
6. Does the upgraded unit keep its current activation state (already moved, etc.)?

Reference: `src/engine/abilities/handlers.ts` line 70
```

---

### Issue 4: How do Ivan the Terrible's tokens work?

**Title:** How do Ivan the Terrible's tokens work?
**Label:** `question`
**Body:**
```
Ivan's ability (`place_tokens`) lets him "place up to 2 tokens buffing allies
within 2 hexes with -1 ToHit." Parameters are coded (tokenCount=2, buffRange=2)
but the placement flow is undefined.

**Questions:**
1. When are tokens placed? Separate action type, or happens automatically?
2. Are tokens placed on specific hexes, or do they follow Ivan?
3. Are tokens permanent once placed, or do they expire/get removed?
4. Can tokens be moved after placement?
5. Do tokens stack if both placed on the same hex (for -2 ToHit)?
6. Can enemies destroy or interact with tokens?

Reference: `src/engine/abilities/handlers.ts` — token params defined but no logic
```

---

### Issue 5: What units count as "siege" for Suleiman's movement buff?

**Title:** What units count as "siege" for Suleiman's movement buff?
**Label:** `question`
**Body:**
```
Suleiman the Magnificent's ability (`siege_movement_buff`) gives "+1 movement
to siege units within 3 hexes." However, no units are currently tagged as "siege."

**Questions:**
1. Which Ottoman units are classified as "siege"? Janissaries? All specialty units?
2. Or is "siege" a unit tag that could apply across factions in the future?
3. Does the buff apply to Suleiman himself?
4. Is the +1 movement permanent while in range, or activated per turn?

Reference: `src/engine/abilities/handlers.ts` — ability coded but no `siege`
tag exists on any unit definition.
```

---

### Issue 6: How do secondary attacks work in gameplay? (Nobunaga / Samurai)

**Title:** How do secondary attacks trigger in gameplay? (Nobunaga / Samurai)
**Label:** `question`
**Body:**
```
Oda Nobunaga and the Samurai both have a `secondaryAttack` defined (Range: 2,
Dmg: 1, ToHit: 6). The `dual_attack` ability grants "+1 extraAttacks."
The trigger mechanism is unclear.

**Questions:**
1. Does the player choose which attack to use, or does the engine automatically
   use primary (melee) then secondary (ranged)?
2. With dual_attack, can the unit attack two different targets
   (melee one enemy, ranged another)?
3. Or must both attacks target the same unit?
4. Can the secondary ranged attack be used standalone? (e.g., at range 2 where
   melee can't reach)
5. The `noProximityPenalty` flag on the secondary — does this bypass the
   standard ranged proximity penalty entirely?

Reference: `src/engine/data/factions/japanese.ts` and handlers.ts line 88
```

---

### Issue 7: Is the Janissary reload automatic or player-controlled?

**Title:** Is the Janissary reload automatic or player-controlled?
**Label:** `question`
**Body:**
```
The Janissary has a `janissary_reload` ability: "Must skip turn to reload;
movement reduced to 2 on reload turns." The implementation tracks `needsReload`.

**Questions:**
1. After firing, does the Janissary automatically enter reload state, or does
   the player choose when to reload?
2. During a reload turn, can the Janissary move (at reduced speed) but not
   attack? Or is the entire turn skipped?
3. Can the player delay firing to avoid the reload penalty
   (e.g., just move without attacking)?
4. Does reload take exactly 1 full turn, or could it be modified?

Reference: `src/engine/abilities/handlers.ts` — janissaryReload handler
```

---

### Issue 8: Should there be a maximum game length or draw condition?

**Title:** Is there a maximum game length or draw condition?
**Label:** `question`
**Body:**
```
Currently the game ends only by:
1. **Elimination** — all enemy units destroyed
2. **Base control** — occupy enemy base for 3 turns (2 for Mongols)

**Questions:**
1. Should there be a maximum turn limit? (e.g., 50 turns → draw or tiebreaker)
2. If the game stalemates (neither side can progress), what happens?
3. Are there any other win conditions planned?
   (e.g., leader assassination = instant win?)
4. For AI bot testing we use a 2000-action cap — should real games have a
   similar safeguard?

This matters for both game balance and AI strategy design.
```

---

## Summary

| # | Action | Issue |
|---|--------|-------|
| — | Comment on #3 | Attila stats exist; ability is the gap |
| — | Comment on #6 | 5 specific terrain questions |
| 1 | **New** | Aztec Priest buff mechanics |
| 2 | **New** | Centurion command attack rules |
| 3 | **New** | King Arthur upgrade rules |
| 4 | **New** | Ivan's token placement |
| 5 | **New** | Suleiman "siege" classification |
| 6 | **New** | Secondary attack triggers (Japanese) |
| 7 | **New** | Janissary reload cycle |
| 8 | **New** | Max game length / draw condition |
