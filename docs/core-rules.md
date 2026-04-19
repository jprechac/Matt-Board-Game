# Core Rules

**Table of Contents**

- [Fundamentals](#fundamentals)
- [Setup](#setup)
- [Gameplay](#gameplay)
- [Armies](#armies)
- [Appendix](#appendix)

## Fundamentals

This board game is a turn-based military strategy game where each player controls an army and wants to take control of the opponent's base. Each turn, units move around the board, attack the opponent's units, and attempt to have full control of the opponent's base for 3 turns. 

Players assume control of an army based on real-life civilizations, such as the Huns, Vikings, and the Roman Empire. 

### Players

The game is played by either 2 or 4 players. The game is played as a 1v1 with 2 players or 2 teams of 2 (2v2) with 4 players.

### Board

The board is played on a rectangular hex-grid board, 18x19 in a 2-player game and 18x22 in a 4-player game (wider than it is tall). Each player has a *Base* of 7 squares (4 in the back, 3 in the front) along the back middle of their side of the board. Each player has a *Placement Zone* on their side of the board where units can be placed during the [**Setup**](#setup) phase. This *Placement Zone* is the nearest 3 rows on each player's side of the board.

The board also features modifiable [**Terrain**](#terrain), which each player can select from a set pool of options and place 2 Terrain pieces during their setup phase. Players can place Terrain anywhere their *Terrain Placement Zone* which is the nearest 5 rows on their side of the board.

Each unit exists in 1 hex on the grid. Only 1 unit can be in 1 hex at a time, and units cannot move through hexes occupied by another unit.

### Terrain

Jordan note: I don't know how **Terrain** works.[^#6]

## Setup

Before beginning, each player rolls an 8-sided the die. The player (or team in 2v2 games) with the highest roll decides whether they would like to pick their faction first or whether they move first. The other play (or team) decides the other.
> For example, if Player A rolls higher and decides they will choose their faction second, Player B then gets to decide whether they will have the first or second move in the game.

### Selecting the Army Composition

In the order decided by the initial roll, players decide which [Faction](#factions) they will play. Once each player has selected their faction, players begin blindly deciding their army composition. Armies are comprised of 3 groups: [**Basic Units**](#basic-units), [**Specialty Units**](#faction-specific-units), and the [**Leader**](#faction-specific-units). All armies have the following group composition[^#5]: 

| Unit Group | Number of Units |
| :----- | :--- |
| Basic | 3 |
| Specialty | 5 |
| Leader | 1 |

As noted, this is a *blind selection* - so the opposing players do not know what army composition others have selected until the [Placement](#placing-units) phase. In 2v2 games, allies may coordinate army composition.

### Placing units

Players alternate placing units within their *Placement Zone* 2-at-a-time until all units have been placed. The player who moves first will place first.

> In 2v2 games, players alternate between teams and players, so if Players A and B are on a team, and Players C and D on the other, the placement order is A -> C -> B -> D. 

Army compositions are hidden from opposing players until those units are placed on the board. However, players cannot change their composition once the placements have begun.

### Placing terrain

Jordan note: I don't know how [**Terrain**](#terrain) works.[^#6]

## Gameplay

### On your turn

During their turn, a player may move and attack with all of their units. Each unit must take all of its actions before the next unit can start their actions - as soon as the next unit takes an action, the previous unit's turn is complete. Players may take actions with their units in any order.

#### Actions

Each unit has 3 actions it can take during its turn: [**Move**](#moving), [**Attack**](#attacking), and [**Special Ability**](#special-ability). Each of these actions can be taken in any aequence (with some restrictions on moving after attacking).

#### Moving

A unit can move a number of tiles up to its listed **Movement** stat. Units can move to any open tile on the board, but cannot move into or through any tile occupied by another unit, object, or impassable terrain. 

A unit may use up to its maximum Movement prior to attacking. However, once a unit uses its Attack action, it may then only move up to 1 tile, unless it has already used all of its Movement.

#### Attacking

When a unit attacks another unit, the attacking unit must roll an 8-sided die ("d8"). The unit's **To Hit** bonus determines what die roll results in a hit. For example, a Basic Melee unit has a To Hit of *+4*, so if the die roll is 4 or higher, the attack hits and deals the amount of damage listed for that unit - in this case, 2 damage.

All attacks have a **Range**, which determines how many tiles a unit can attack in. A Range of 1 is melee range, and any range above 1 is generally a ranged attack.

**Ranged attacking rules**

A few special rules apply to ranged attacks: 
1. A ranged attack may target any unit within its radius.
2. A ranged attack at melee range (i.e., targetting an adjacent unit) is conducted at disadvantage
3. Critical hits

#### Special Ability

### Winning

The first player to control their opponent's base for 3 turns wins the game.

To control the base, the attacking player must start their turn with at least 1 unit in the opponent's base and no opposing units. If defending units enter the base, the 3-turn timer is *paused*; if attacking units leave the base (or are defeated), the timer is *reset*.

There are two additional win conditions: 
- Defeating all of the opponents units
- Surrender

## Armies

Each army has a number of basic and specialty units. Each faction has their own unique specialty units and uses the same basic units.

### Basic Units

Basic units are shared across factions. They are simple units with no unique capabilities that frorm the foundation of each army.

| Name | HP | Movement | Range | Damage | To Hit | Special Ability |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| Melee | 5 | 2 | 1 | 2 | 4+ | None | 
| Ranged | 4 | 2 | 4 | 1 | 5+ (7+) | Can only move 1 tile prior to attacking.[^#4] |

### Faction-Specific Units

The game has the following factions: 

| Faction | Leader | Unique Units |
| --- | --- | :--- |
| [Aztecs](factions/aztecs.md) | Itzcoatl | Jaguar Warrior, Priest |
| [Bulgars](factions/bulgars.md) | Khan Krum | Light Cavaly, Heavy Cavalry |
| [English](factions/english.md) | King Arthur | Longbowman, Knight |
| [Huns](factions/huns.md) | Attila the Hun | Mounted Archer, Mounted Swordsman |
| [Japanese](factions/japanese.md) | Oda Nobunaga | Samurai |
| [Mongols](factions/mongols.md) | Genghis Khan | Kheshig, Pillager |
| [Muscovites](factions/muscovites.md) | Ivan the Terrible | Streltsy, Cossack Cav |
| [Ottomans](factions/ottomans.md) | Suleiman the Magnificent | Medic, Janissary |
| [Romans](factions/romans.md) | Julius Casesar | Legionnarie, Centurion |
| [Vandals](factions/vandals.md) | Geneseric | Heavy Cavalry, Raider |
| [Vikings](factions/vikings.md) | Eric the Red | Axe Thrower, Berserker |

Each faction has their own 

## Appendix

### A. Definitions

| Term | Definition | Synonyms & Acronyms |
| :--- | :--- | :--- |
| Health Points | The amount of damage a unit cane take before dying. | HP |
| Death | Occurs when a unit has lost all of their hit points. Removes the unit from the board. The unit may no longer take actions and no longer takes space on the game board. | Dying |
| Faction | | |
| Army | | |
| Movement |
| Range |
| Damage |
| To Hit |
| Special Ability |

### B. FAQ



<!-- Footnotes -->
### Footnotes
[^#4]: Clarification: Based on this rule, Basic Ranged units can only ever move 1 tile on a turn where they Attack, regardless of whether that movement is before or after the attack. Is this correct? [#4](https://github.com/jprechac/Matt-Board-Game/issues/4)
[^#5]: Based on initial playtesting, is the 3-5-1 composition going to remain? [#5](https://github.com/jprechac/Matt-Board-Game/issues/5)
[^#6]: Need clarity on how Terrain works.[#6](https://github.com/jprechac/Matt-Board-Game/issues/6)
