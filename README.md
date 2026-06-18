<div align="center">

# ⚔️ Kingshot Hero Gear Planner

**Plan your Red hero gear upgrades — see costs, leftovers, and stat bonuses at a glance.**

![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e?logo=javascript&logoColor=000)
![Pico.css](https://img.shields.io/badge/Styled%20with-Pico.css-13795b)
![No build step](https://img.shields.io/badge/Build-none-success)
![Runs offline](https://img.shields.io/badge/Runs-offline-blue)

</div>

---

## ✨ What it is

A single-page, fully client-side web app — **no server, no build step, no installation**. Just open it in a browser and start planning. It's built with vanilla JavaScript and [Pico.css](https://picocss.com/) (from a CDN), plus a little custom CSS for the game-style gear tiles.

It models the three troop types (**Archer · Infantry · Cavalry**), each with four gear slots (**Helmet · Gloves · Chest · Boots**), across two upgrade axes:

| Axis | Range |
| --- | --- |
| 🔮 **Imbue / Enhancement** | Base → +19 → +39 → +59 → +79 → +99 → +100 |
| 🔨 **Forge level** | Lv.10 → Lv.20 |

It also tracks your **backpack** of four materials — Mythic Gear, Mithril, Enhancement XP, and Forge Hammers — and tells you whether a plan is affordable.

## 🚀 Features

- 🔄 **Current → target previews** for every gear piece, with live per-piece cost breakdowns.
- 🎒 **Backpack cost checks** — per-material and overall "Enough / Missing" status. Enter `0` for a material to treat it as unlimited.
- 🔒 **Edit-current lock guard** — current levels are locked by default so planned targets aren't changed by accident; unlock per piece or all at once.
- 🪄 **Suggestion presets** — Balanced, Attack, Defense, Bear, and Castle auto-plans, previewed in a modal before you apply them.
- 💾 **Named save slots** stored in `localStorage`, with unsaved-changes tracking and revert-to-saved.
- 📋 **Backup & share** — export/import setups as JSON, including copy/paste via the clipboard.
- 📊 **Imbuement bonus summary** grouped by Gear Specialty / Conquest / Expedition.
- 📱 **Mobile-friendly** draggable backpack bottom-sheet drawer.

## 🕹️ How to use it

1. **Open `index.html`** in any modern browser — that's it, no setup required.
2. Open the **🎒 Backpack** editor and enter your available materials.
3. For each troop tab, set your **Current** gear levels (unlock the lock first), then raise the **Target** levels.
4. Review the costs and leftovers, or tap a **🪄 Suggest upgrades** preset to auto-generate a plan and preview it.
5. **💾 Save** the configuration to a named slot, or export it to share or back up.

> 🔐 Your data lives only in your browser's `localStorage` — nothing is uploaded.

## 🗂️ Code structure

```
index.html          # Layout, Pico.css CDN link, app containers, suggestion modal
app.js              # All application logic (see below)
styles.css          # Custom game-tile styling layered on top of Pico.css
assets/
  gears/            # 12 gear icons, named troop_slot.png (e.g. archer_helmet.png)
  materials/        # 4 material icons (mythic, mithril, exp, hammers)
README.md           # This file
```

### Inside `app.js`

| Area | What it does |
| --- | --- |
| **Data model & cost tables** | `troops`, `slots`, `resources`, stage/forge value lists, and the `expReqs` / `forgeReqs` cost tables. Helpers (`enhancementCost`, `forgeCost`, `gearCost`, `totalCost`) compute requirements for any current → target range. |
| **State & persistence** | `state` holds the backpack and per-piece gear. Named configs save under `localStorage` keys (`ksGearPlanner.active`, `ksGearPlanner.configs`, `ksGearPlanner.config.<id>`, `ksGearPlanner.activeConfig`), with a one-time migration from legacy numbered slots. |
| **Rendering** | `render()` rebuilds the material strip, troop tabs, gear cards, and plan overview. Resource statuses refresh in place so a focused input is never destroyed mid-edit. |
| **Suggestion engine** | Preset weights (`troopWeights`, `statWeights`) drive `makeSuggestion()`, which greedily allocates affordable upgrades and previews them before applying. |
| **Bonus stats** | `aggregateGains()` rolls up imbuement bonuses and the specialty-stat (Lethality/Health) model into the overview's stats card. |
| **Mobile drawer** | A pointer-driven, draggable bottom-sheet for the backpack editor on small screens. |

### Gear data model

Each gear piece is `{ currentExp, currentForge, targetExp, targetForge }`, where `*Exp` is the imbue stage and `*Forge` is the forge level. Targets are always clamped to be at least the current value.

---

<div align="center">

© by Donotpetハナソ | #395

</div>
