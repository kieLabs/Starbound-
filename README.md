# STARBOUND — GamerKie Edition

**One hero. Infinite worlds. No two journeys alike.**

An original offline-first 2D physics, exploration, puzzle and survival platform adventure. Built with HTML5 Canvas, CSS and vanilla JavaScript. It is designed for GitHub Pages and Blogger iframe embedding; no backend, API key, paid service or build step is required.

## What is in this build

- Preserves the orange stickman, tether/grapple, momentum swing, platforming, pushable energy cores, collectible stars, switches, floor plates and portal exit.
- Seeded procedural level generation with six core puzzle families: ORB, SHARDS, SWITCH, SWING, DODGE and TWIN.
- Sixteen world themes: Dark Forest, Haunted Forest, Alien Planet, Frozen World, Desert World, Volcanic World, Underground Caves, Abandoned World, Swamp World, Sky World, Crystal Reef, Toxic Garden, Moon Graveyard, Clockwork Depths, Storm Wastes and Fungal Kingdom.
- Procedural platforms, pits, hazards, anchors, puzzle objects, collectibles, plants, enemies, event triggers and special guardian encounters.
- Day/night palettes and weather variants including rain, thunderstorm, fog, snow, blizzard, sandstorm, ashfall, meteor shower and alien mist. Rain, snow and wind also modify movement.
- Increasing difficulty, local level-history duplicate checks, level fingerprints and structural validation before a generated layout is used.
- Local progress, star totals, best level, generated-level history and settings saved in browser storage.
- Keyboard and touch controls, pause/restart, sound toggle, world list and help screen.

## Controls

**Desktop:** A/D or ←/→ to move; Space/W/↑ to jump; E to attach/release a tether or activate a nearby control; Escape to pause.

**Mobile:** use the on-screen ◀ ▶, GRAPPLE and JUMP buttons. Rotate to landscape for a wider play area. Browser fullscreen can be enabled from the browser menu.

## Test locally

Open `index.html` in a modern browser, or run a local static server from this directory. To test the procedural engine with Node.js:

```bash
npm test
```

The test suite checks deterministic generation, 120 valid sample levels, world variety, monotonic difficulty, local duplicate/similarity rejection and invalid-level rejection.

## Publish to GitHub Pages

1. Create a GitHub repository, for example `Starbound-GamerKie`.
2. Extract the ZIP and upload the **contents** of this folder to the repository root. `index.html` must be at the root, not inside an extra nested folder.
3. Commit and push the files to the `main` branch.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
6. Once the Pages deployment finishes, the game URL will be `https://YOUR-USERNAME.github.io/Starbound-GamerKie/` (replace the username and repository name).

The `.nojekyll` file is intentionally empty and must remain at the repository root.

## Blogger iframe

Open `blogger-embed.html`, replace `YOUR-USERNAME` with your GitHub username in the `data-src` URL, then paste the complete file content into a Blogger post using HTML view. It already uses the Starbound logo image URL you supplied, a Starbound Play Now cover, and the lazy iframe launch behavior.

## Important technical limits

- “Unlimited” means the generator can continue creating numbered sectors; the code does not ship a finite authored campaign. Generation is deterministic for a given level/seed.
- Duplicate and similarity history is stored in the current browser's local storage. GitHub Pages static hosting cannot coordinate history across different players or devices without a server.
- Generated layouts are structurally validated (start, exit, bounds, route item positions and pit spans), but this is not a formal proof that every randomly assembled physics situation is solvable. The current build uses guarded pit widths and step platforms to reduce unfair layouts.
- World visuals, plants, creatures, effects and sound cues are drawn/synthesized in code. There are no bundled third-party art/audio assets in this archive.
- Bosses have a vulnerability window; move close and press E when their core glows. Bosses are introduced at milestone sectors.

## Folder structure

```text
STARBOUND/
├── index.html
├── .nojekyll
├── README.md
├── blogger-embed.html
├── package.json
├── css/
│   └── style.css
├── js/
│   ├── level-core.js
│   └── game.js
├── tests/
│   └── level-core.test.js
└── assets/
    └── README.txt
```
