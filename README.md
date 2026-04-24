# ⚔️ Hex Wars

A turn-based strategy board game featuring 11 historical factions battling for territorial control on a hex grid. Currently in active design with plans to build a digital version for playtesting and balance simulation.

> **Status:** Game design in progress · Digital implementation not yet started
> See the [Roadmap](docs/ROADMAP.md) for the full development plan.

## The Game

Two or four players command armies of 9 units across a hex-grid battlefield. Choose a faction, compose your army, and outmaneuver your opponent to seize their base — or destroy them entirely.

### Win Conditions

- **Base Control** — Occupy your opponent's base for 3 consecutive turns (2 if playing Mongols)
- **Elimination** — Defeat all enemy units
- **Surrender**

### How It Plays

Each turn, you activate all your units in any order. Every unit can **move**, **attack**, and use a **special ability** — in any sequence. Combat is resolved with a d8 roll against a To Hit threshold, and each faction's unique units bring different tactical options to the table.

### Factions

| Faction | Leader | Playstyle |
|---------|--------|-----------|
| 🏛️ Romans | Julius Caesar | Formation synergy — units strengthen each other when adjacent |
| 🏴 Vikings | Eric the Red | Relentless aggression — leader attacks twice per turn |
| 🏯 Japanese | Oda Nobunaga | Versatile samurai — dual melee and ranged attacks |
| 🐎 Mongols | Genghis Khan | Lightning conquest — only needs 2 turns to capture a base |
| 🌿 Aztecs | Itzcoatl | Ritual warfare — sacrifice mechanics and support magic |
| ⚔️ English | King Arthur | Elite upgrades — promote basic units into specialty fighters |
| 🐴 Bulgars | Khan Krum | Terrain masters — cavalry that thrives in natural terrain |
| 🏹 Ottomans | Suleiman | Siege and sustain — powerful ranged units backed by medics |
| 🛡️ Vandals | Genseric | Lone wolves — units hit harder when fighting solo |
| 🏰 Muscovites | Ivan the Terrible | Area control — buff tokens that empower nearby allies |
| 🗡️ Huns | Attila the Hun | Mounted warfare — fast, mobile army *(stats WIP)* |

## Project Structure

```
docs/
├── cli.md                 # CLI tools usage guide
├── core-rules.md          # Complete game rules and mechanics
├── balance-testing.md     # Balance testing framework
├── ROADMAP.md             # Development roadmap and backlog
└── factions/              # Detailed stats and abilities for each faction
    ├── aztecs.md
    ├── bulgars.md
    ├── english.md
    ├── huns.md
    ├── japanese.md
    ├── mongols.md
    ├── muscovites.md
    ├── ottomans.md
    ├── romans.md
    ├── vandals.md
    └── vikings.md
```

## Quick Start

```bash
npm install --legacy-peer-deps   # Install dependencies
npm test                          # Run all tests
npm run dev                       # Start web UI at localhost:5180
npm run bot-match                 # Run an AI vs AI match (see docs/cli.md)
```

## Roadmap

The long-term goal is a fully playable digital version with AI opponents and automated balance testing. The plan is broken into 9 phases:

1. **Core Game Engine** — TypeScript rules engine (hex grid, combat, abilities, all faction logic)
2. **Event & Replay System** — Game recording for debugging and statistics
3. **Web UI** — Playable browser app with hex grid visuals (hot-seat multiplayer)
4. **AI Bots** — Medium-difficulty AI for each faction (play vs computer)
5. **Statistics Tracking** — Per-game, per-unit, and per-faction analytics in SQLite
6. **Simulation Runner** — Headless CLI tool for running thousands of AI-vs-AI games
7. **Balance Dashboard** — Visual matchup heatmaps, tier lists, and before/after comparisons
8. **Difficulty Tiers** — Easy, Medium, and Hard AI per faction with ELO tracking
9. **Online Multiplayer** — WebSocket-based remote play *(stretch goal)*

Full details in [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

This is a personal project by a small group of friends. If you're interested in the design or have feedback, feel free to open an issue — we'd love to hear from other tabletop/strategy game enthusiasts.

## License

Not yet determined.
