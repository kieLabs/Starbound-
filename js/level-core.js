/* STARBOUND procedural level engine. Deterministic, offline, GitHub Pages friendly. */
(function (root) {
  "use strict";

  const TYPES = ["ORB", "SHARDS", "SWITCH", "SWING", "DODGE", "TWIN"];
  const WORLDS = [
    { id: "dark-forest", name: "Dark Forest", sky: ["#081b1b", "#162d2c"], far: "#173c36", ground: "#64766a", accent: "#a6d9a2", danger: "#d34d54", plants: ["vine", "thorn", "glowflower", "mushroom"], creatures: ["spider", "snake", "wolf", "bat", "insect"] },
    { id: "haunted-forest", name: "Haunted Forest", sky: ["#090b18", "#242238"], far: "#29283b", ground: "#747480", accent: "#d4d6ef", danger: "#a36bcb", plants: ["dead-tree", "ghost-vine", "pale-mushroom"], creatures: ["ghost", "shadow", "bat", "spider"] },
    { id: "alien-planet", name: "Alien Planet", sky: ["#100b2c", "#34205c"], far: "#452c70", ground: "#62517f", accent: "#6effeb", danger: "#ff5a9d", plants: ["alien-tree", "glowflower", "spore"], creatures: ["alien-spider", "glider", "mutant", "glowling"] },
    { id: "frozen-world", name: "Frozen World", sky: ["#0a1c32", "#3d6888"], far: "#7397ae", ground: "#b4d6e7", accent: "#e4fbff", danger: "#43c4ff", plants: ["frost-pine", "ice-crystal"], creatures: ["ice-wolf", "bat", "frost-crawler"] },
    { id: "desert-world", name: "Desert World", sky: ["#542a24", "#d18b55"], far: "#bd8050", ground: "#c59a68", accent: "#ffe0a2", danger: "#e85c38", plants: ["cactus", "dry-bush", "desert-flower"], creatures: ["scorpion", "snake", "sand-worm", "vulture"] },
    { id: "volcanic-world", name: "Volcanic World", sky: ["#1d0908", "#62251b"], far: "#733328", ground: "#40383a", accent: "#ffae45", danger: "#ff572d", plants: ["ash-tree", "ember-root"], creatures: ["magma-beast", "fire-bat", "lava-crawler"] },
    { id: "underground-caves", name: "Underground Caves", sky: ["#070b18", "#18243a"], far: "#27364b", ground: "#555e70", accent: "#73d9ff", danger: "#c65cff", plants: ["crystal", "glow-moss", "cave-fungus"], creatures: ["cave-spider", "worm", "bat", "blind-crawler"] },
    { id: "abandoned-world", name: "Abandoned World", sky: ["#101722", "#39414a"], far: "#4c5159", ground: "#777b80", accent: "#b1d6db", danger: "#f05b66", plants: ["rust-vine", "cracked-tree", "wire-weed"], creatures: ["drone", "shadow", "mutant", "crawler"] },
    { id: "swamp-world", name: "Swamp World", sky: ["#071a17", "#27483b"], far: "#315d4a", ground: "#536c54", accent: "#b1e18b", danger: "#b2e03c", plants: ["swamp-root", "carnivore", "mushroom", "hanging-moss"], creatures: ["crocodile", "swamp-spider", "leech", "frog-beast"] },
    { id: "sky-world", name: "Sky World", sky: ["#155078", "#83bce0"], far: "#a7cde0", ground: "#8598a9", accent: "#f4fbff", danger: "#ffcf54", plants: ["cloud-tree", "sky-flower", "floating-vine"], creatures: ["sky-ray", "storm-bird", "cloud-jelly"] },
    { id: "crystal-reef", name: "Crystal Reef", sky: ["#061f32", "#075b70"], far: "#16768a", ground: "#477c8c", accent: "#7ef9ee", danger: "#ff6cbe", plants: ["coral", "crystal", "sea-fan"], creatures: ["jelly", "reef-stalker", "angler", "shell-beast"] },
    { id: "toxic-garden", name: "Toxic Garden", sky: ["#111b12", "#3b5427"], far: "#526d32", ground: "#596b43", accent: "#dbff68", danger: "#b5ff27", plants: ["poison-bloom", "spore-tree", "thorn", "carnivore"], creatures: ["toxic-spider", "moth", "acid-slug", "vine-beast"] },
    { id: "moon-graveyard", name: "Moon Graveyard", sky: ["#090d1a", "#303952"], far: "#4a5269", ground: "#858b9c", accent: "#d5e2ff", danger: "#a78bfa", plants: ["moon-tree", "bone-shrub", "lunar-crystal"], creatures: ["wraith", "moon-wolf", "void-bat"] },
    { id: "clockwork-depths", name: "Clockwork Depths", sky: ["#17171d", "#42404b"], far: "#57535a", ground: "#77716a", accent: "#f1c36a", danger: "#fa7458", plants: ["copper-root", "gear-flower"], creatures: ["gear-drone", "clock-spider", "steam-hound"] },
    { id: "storm-wastes", name: "Storm Wastes", sky: ["#111c2a", "#526276"], far: "#687887", ground: "#7b827f", accent: "#d2ecff", danger: "#fff16b", plants: ["wind-bent-tree", "static-weed"], creatures: ["storm-wolf", "lightning-moth", "dust-crawler"] },
    { id: "fungal-kingdom", name: "Fungal Kingdom", sky: ["#160d24", "#4d2857"], far: "#633e69", ground: "#756078", accent: "#ffb8ed", danger: "#e56cff", plants: ["giant-mushroom", "spore-tree", "glow-cap"], creatures: ["spore-spider", "mushroom-ogre", "glow-moth"] }
  ];

  const WEATHER = ["clear", "sunset", "night", "moonlit", "rain", "thunderstorm", "fog", "snow", "blizzard", "sandstorm", "wind", "ashfall", "meteor-shower", "alien-mist"];
  const OBJECTIVES = [
    { id: "portal", name: "Reach the portal", hint: "Find a safe route to the exit." },
    { id: "collect", name: "Collect every star", hint: "Gather all glowing star shards." },
    { id: "switches", name: "Restore the ancient nodes", hint: "Activate every glowing control node." },
    { id: "artifact", name: "Recover the lost artifact", hint: "Find the hidden relic and escape." },
    { id: "survive", name: "Survive the hostile world", hint: "Stay alive until the portal unlocks." },
    { id: "rescue", name: "Find the trapped signal", hint: "Reach the signal beacon and escape." },
    { id: "boss", name: "Defeat the world guardian", hint: "Wait for its weak moment and strike." }
  ];
  const ENEMIES = ["spider", "snake", "wolf", "bat", "scorpion", "insect", "ghost", "shadow", "alien-spider", "glider", "mutant", "ice-wolf", "sand-worm", "magma-beast", "cave-spider", "worm", "crocodile", "drone", "sky-ray", "jelly", "wraith", "gear-drone", "storm-wolf", "spore-spider"];

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hash32(v) {
    let h = 2166136261;
    const str = String(v);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function getDifficulty(number) {
    const n = Math.max(1, Math.floor(Number(number) || 1));
    return Math.floor(1 + Math.log2(n) * 1.35 + n / 42);
  }
  function difficultyName(d) {
    if (d < 3) return "HARD";
    if (d < 6) return "VERY HARD";
    if (d < 10) return "EXPERT";
    if (d < 16) return "EXTREME";
    return "NIGHTMARE";
  }
  function worldIndexFor(number) {
    // A coprime stride walks the full world registry without consecutive repeats,
    // and remains constant-time even at very high level numbers.
    const index = Math.max(0, Math.floor(number) - 1);
    return (index * 5 + Math.floor(index / WORLDS.length)) % WORLDS.length;
  }
  function pick(r, list) { return list[Math.floor(r() * list.length)]; }
  function makeLevel(number, seedOverride) {
    const n = Math.max(1, Math.floor(Number(number) || 1));
    const seed = seedOverride == null ? hash32("starbound:" + n) : (seedOverride >>> 0);
    const r = rng(seed);
    const world = WORLDS[worldIndexFor(n)];
    const type = TYPES[(n - 1) % TYPES.length];
    const difficulty = getDifficulty(n);
    const width = 2300 + Math.floor(r() * 420) + Math.min(850, difficulty * 34);
    const groundY = 425;
    const platforms = [];
    const pits = [];
    const platformCount = 9 + Math.min(9, Math.floor(difficulty * 0.65)) + Math.floor(r() * 5);
    for (let i = 0; i < platformCount; i++) {
      const x = 300 + i * ((width - 650) / Math.max(1, platformCount - 1)) + (r() - 0.5) * 110;
      platforms.push({ x: Math.max(230, Math.min(width - 300, Math.round(x))), y: 255 + Math.floor(r() * 112), w: 86 + Math.floor(r() * 100), h: 14, moving: r() < Math.min(.13 + difficulty * .012, .38), amplitude: 25 + Math.floor(r() * 55), phase: r() * 6.28, speed: .012 + r() * .018, baseX: x });
    }
    const pitCount = Math.min(4, 1 + Math.floor(difficulty / 5) + Math.floor(r() * 2));
    for (let i = 0; i < pitCount; i++) {
      const x = 650 + i * ((width - 1300) / Math.max(1, pitCount - 1)) + (r() - .5) * 80;
      const w = 92 + Math.floor(r() * 72);
      pits.push({ x: Math.round(x), y: groundY, w, h: 100, kind: "pit" });
      // A low stepping stone makes each generated pit physically crossable.
      platforms.push({ x: Math.round(x - w * .14), y: groundY - 42 - Math.floor(r() * 14), w: Math.round(w * .46), h: 12, moving: false, amplitude: 0, phase: 0, speed: 0, baseX: x - w * .14 });
      platforms.push({ x: Math.round(x + w * .24), y: groundY - 55 - Math.floor(r() * 20), w: Math.round(w * .5), h: 12, moving: false, amplitude: 0, phase: 0, speed: 0, baseX: x + w * .24 });
    }

    const level = {
      number: n, seed, type, difficulty, difficultyName: difficultyName(difficulty), world,
      width, groundY, weather: pick(r, WEATHER), timeOfDay: pick(r, ["day", "sunset", "night", "moonlit"]),
      hero: { x: 90, y: groundY - 34 }, goal: { x: width - 110, y: groundY - 58, r: 30 },
      platforms, hazards: pits.slice(), shards: [], objects: [], switches: [], anchors: [], enemies: [], plants: [], events: [],
      description: "", objective: null, requiredStars: 0, artifact: null, rescue: null, boss: null,
      generation: { version: 3, algorithm: pick(r, ["ridge", "cavern", "broken-bridge", "floating-steps", "vertical-maze"]) }
    };

    // Secondary hazards are spaced away from the start and portal.
    const hazardKinds = ["spikes", "laser", "acid", "falling-rock", "steam-vent"];
    const extraHazards = 2 + Math.min(5, Math.floor(difficulty / 3));
    for (let i = 0; i < extraHazards; i++) {
      const x = 420 + r() * (width - 850);
      if (pits.some(p => Math.abs(p.x - x) < 150)) continue;
      const kind = pick(r, hazardKinds);
      level.hazards.push({ x: Math.round(x), y: kind === "laser" ? groundY - 100 : groundY - 12, w: 28 + Math.floor(r() * 62), h: kind === "laser" ? 90 : 22, kind, phase: r() * 6.28, active: true, cooldown: 0 });
    }

    // Puzzle-family mechanics retained from the original project.
    if (type === "ORB") {
      level.description = "Push the energy core onto the glowing floor plate.";
      level.objects.push({ x: Math.round(width * (.40 + r() * .12)), y: groundY - 26, r: 22, vx: 0, vy: 0, kind: "core" });
      level.switches.push({ x: Math.round(width * (.77 + r() * .05)), y: groundY - 8, kind: "plate", active: false });
    } else if (type === "SHARDS") {
      level.description = "Collect every star shard, then reach the portal.";
      level.requiredStars = 4 + Math.min(5, Math.floor(difficulty / 3)) + Math.floor(r() * 3);
      for (let i = 0; i < level.requiredStars; i++) level.shards.push({ x: Math.round(330 + i * ((width - 700) / Math.max(1, level.requiredStars - 1)) + (r() - .5) * 100), y: groundY - 75 - Math.floor(r() * 155), got: false, value: 1 });
    } else if (type === "SWITCH") {
      level.description = "Find the control nodes and activate them to unlock the exit.";
      const count = 1 + Math.min(2, Math.floor(difficulty / 7));
      for (let i = 0; i < count; i++) level.switches.push({ x: Math.round(width * (.38 + i * .19)), y: groundY - 8, kind: "switch", active: false });
      level.objects.push({ x: Math.round(width * .29), y: groundY - 24, r: 19, vx: 0, vy: 0, kind: "crate" });
    } else if (type === "SWING") {
      level.description = "Grapple to the anchors and swing across the broken route.";
      level.requiredStars = 2 + Math.floor(r() * 2);
      for (let i = 0; i < 3 + Math.floor(r() * 2); i++) level.anchors.push({ x: Math.round(width * (.28 + i * .17)), y: 130 + Math.floor(r() * 110), radius: 245 });
      for (let i = 0; i < level.requiredStars; i++) level.shards.push({ x: Math.round(width * (.42 + i * .16)), y: 240 + Math.floor(r() * 100), got: false, value: 1 });
    } else if (type === "DODGE") {
      level.description = "Read the rhythm of the energy gates and activate the exit node.";
      level.switches.push({ x: Math.round(width * .82), y: groundY - 8, kind: "switch", active: false });
      for (let i = 0; i < 3 + Math.min(3, Math.floor(difficulty / 5)); i++) level.hazards.push({ x: Math.round(width * (.34 + i * .105)), y: groundY - (70 + Math.floor(r() * 38)), w: 24, h: 75 + Math.floor(r() * 30), kind: "laser", phase: r() * 6.28, active: true, cooldown: 0 });
    } else if (type === "TWIN") {
      level.description = "Move both energy cores onto their matching floor plates.";
      level.objects.push({ x: Math.round(width * .30), y: groundY - 22, r: 19, vx: 0, vy: 0, kind: "core" }, { x: Math.round(width * .57), y: groundY - 22, r: 19, vx: 0, vy: 0, kind: "core" });
      level.switches.push({ x: Math.round(width * .46), y: groundY - 8, kind: "plate", active: false }, { x: Math.round(width * .79), y: groundY - 8, kind: "plate", active: false });
    }

    // Additional objective twists, not just a different background.
    const objectiveId = type === "SHARDS" || type === "SWING" ? "collect" : type === "SWITCH" || type === "DODGE" || type === "ORB" || type === "TWIN" ? "switches" : pick(r, ["portal", "survive", "rescue", "artifact"]);
    level.objective = { ...OBJECTIVES.find(o => o.id === objectiveId) };
    if (type === "ORB") level.objective = { id: "switches", name: "Power the exit plate", hint: "Push the energy core onto its floor plate." };
    if (type === "TWIN") level.objective = { id: "switches", name: "Power both exit plates", hint: "Push both energy cores onto their matching plates." };
    if (type === "SWING") level.objective = { id: "collect", name: "Swing through the star field", hint: "Use your tether and collect every star shard." };
    if (objectiveId === "artifact" && !["ORB", "TWIN"].includes(type)) level.artifact = { x: Math.round(width * (.60 + r() * .18)), y: groundY - 80 - Math.floor(r() * 110), collected: false };
    if (objectiveId === "rescue") level.rescue = { x: Math.round(width * (.63 + r() * .17)), y: groundY - 42, rescued: false };
    if (objectiveId === "survive") level.surviveFrames = 60 * (18 + Math.min(20, difficulty * 1.3));

    // Environmental life: world-specific plants and creatures.
    const plantCount = 12 + Math.floor(r() * 10);
    for (let i = 0; i < plantCount; i++) level.plants.push({ x: Math.round(160 + r() * (width - 320)), y: groundY - 2 - Math.floor(r() * 8), kind: pick(r, world.plants), scale: .55 + r() * 1.1, phase: r() * 6.28 });
    const enemyCount = Math.min(3 + Math.floor(difficulty * .75), 15);
    for (let i = 0; i < enemyCount; i++) {
      const kind = pick(r, world.creatures.length ? world.creatures : ENEMIES);
      level.enemies.push({ kind, x: Math.round(450 + r() * (width - 900)), y: groundY - 24 - (kind.includes("bat") || kind.includes("glider") || kind.includes("ray") ? 100 + r() * 80 : 0), baseY: groundY - 24, vx: (r() < .5 ? -1 : 1) * (.55 + r() * .65 + difficulty * .025), range: 50 + r() * 95, phase: r() * 6.28, hp: 1, active: true, attack: pick(r, ["patrol", "chase", "ambush", "wall-crawl"]) });
    }
    const eventKinds = ["falling-tree", "bridge-collapse", "meteor", "rockfall", "hidden-cave", "wind-burst", "shadow", "portal-rift", "spider-drop", "earthquake"];
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) level.events.push({ kind: pick(r, eventKinds), x: Math.round(600 + r() * (width - 950)), triggered: false, timer: 0 });

    // Keep required ground-based puzzle pieces on solid ground, not inside generated pits.
    const moveToSolidGround = (x) => {
      let value = x;
      for (const pit of pits) {
        if (Math.abs(value - pit.x) < pit.w / 2 + 52) {
          value = pit.x + pit.w / 2 + 92;
          if (value > width - 190) value = pit.x - pit.w / 2 - 92;
        }
      }
      return Math.max(180, Math.min(width - 180, Math.round(value)));
    };
    for (const object of level.objects) object.x = moveToSolidGround(object.x);
    for (const control of level.switches) control.x = moveToSolidGround(control.x);

    if (n % 10 !== 0 && r() < Math.min(.16 + difficulty * .009, .34)) {
      const sideId = pick(r, ["artifact", "rescue", "survive"]);
      level.sideObjective = { ...OBJECTIVES.find(o => o.id === sideId) };
      if (sideId === "artifact") level.artifact = { x: Math.round(width * (.58 + r() * .2)), y: groundY - 85 - Math.floor(r() * 100), collected: false };
      if (sideId === "rescue") level.rescue = { x: Math.round(width * (.58 + r() * .2)), y: groundY - 42, rescued: false };
      if (sideId === "survive") level.surviveFrames = 60 * (16 + Math.min(24, difficulty * 1.4));
      level.description += " Bonus: " + level.sideObjective.name.toLowerCase() + ".";
    }

    if (n % 10 === 0 || objectiveId === "boss") {
      const bossKind = pick(r, ["giant-spider", "alien-beast", "shadow-guardian", "cave-worm", "ice-titan", "magma-brute", "haunted-warden"]);
      level.boss = { kind: bossKind, name: bossKind.replace(/-/g, " ").toUpperCase(), x: Math.round(width * .72), y: groundY - 65, hp: 3 + Math.floor(difficulty / 6), maxHp: 3 + Math.floor(difficulty / 6), phase: 0, vulnerable: false, attackTimer: 80, defeated: false, radius: 42 + Math.min(16, difficulty) };
      level.objective = { ...OBJECTIVES.find(o => o.id === "boss") };
      level.description = "Defeat the world guardian. Strike only when its core glows.";
    }

    return level;
  }

  function fingerprint(level) {
    if (!level) return "";
    const round = n => Math.round(Number(n) || 0);
    const data = {
      seed: level.seed,
      type: level.type,
      world: level.world && level.world.id,
      weather: level.weather,
      width: round(level.width),
      platforms: (level.platforms || []).map(p => [round(p.x), round(p.y), round(p.w), !!p.moving]),
      hazards: (level.hazards || []).map(h => [round(h.x), round(h.w), h.kind]),
      anchors: (level.anchors || []).map(a => [round(a.x), round(a.y)]),
      shards: (level.shards || []).map(s => [round(s.x), round(s.y)]),
      enemies: (level.enemies || []).map(e => [e.kind, round(e.x), e.attack]),
      events: (level.events || []).map(e => [e.kind, round(e.x)]),
      objective: level.objective && level.objective.id
    };
    return hash32(JSON.stringify(data)).toString(16).padStart(8, "0");
  }
  function similarityFingerprint(level) {
    if (!level) return "";
    const bucket = n => Math.round((Number(n) || 0) / 85);
    const data = {
      type: level.type, world: level.world && level.world.id, objective: level.objective && level.objective.id,
      width: bucket(level.width),
      platforms: (level.platforms || []).map(p => [bucket(p.x), bucket(p.y), bucket(p.w)]),
      hazards: (level.hazards || []).map(h => [bucket(h.x), bucket(h.w), h.kind]),
      anchors: (level.anchors || []).map(a => [bucket(a.x), bucket(a.y)]),
      shards: (level.shards || []).map(s => [bucket(s.x), bucket(s.y)]),
      switches: (level.switches || []).map(s => [bucket(s.x), s.kind]),
      enemies: (level.enemies || []).map(e => [e.kind, bucket(e.x)]),
      events: (level.events || []).map(e => [e.kind, bucket(e.x)])
    };
    return hash32(JSON.stringify(data)).toString(16).padStart(8, "0");
  }

  function validateLevel(level) {
    const errors = [];
    if (!level || !Number.isFinite(level.number)) errors.push("missing level number");
    if (!level || !Number.isFinite(level.width) || level.width < 1500) errors.push("invalid world width");
    if (!level || !level.hero || !Number.isFinite(level.hero.x) || !Number.isFinite(level.hero.y)) errors.push("missing start position");
    if (!level || !level.goal || !Number.isFinite(level.goal.x) || level.goal.x <= (level.hero && level.hero.x || 0)) errors.push("missing or unreachable exit position");
    if (level && level.goal && level.goal.x >= level.width) errors.push("exit outside world bounds");
    if (level && (!Array.isArray(level.platforms) || !Array.isArray(level.hazards) || !Array.isArray(level.anchors))) errors.push("missing geometry arrays");
    if (level && (level.hazards || []).some(h => h.kind === "pit" && h.w > 190)) errors.push("pit exceeds validated jump span");
    if (level) {
      for (const pit of (level.hazards || []).filter(h => h.kind === "pit")) {
        if (!(level.platforms || []).some(p => p.x < pit.x + pit.w / 2 && p.x + p.w > pit.x - pit.w / 2)) errors.push("pit has no stepping platform");
        if ((level.objects || []).some(o => Math.abs(o.x - pit.x) < pit.w / 2 + 30)) errors.push("puzzle object placed inside a pit");
        if ((level.switches || []).some(o => Math.abs(o.x - pit.x) < pit.w / 2 + 30)) errors.push("control placed inside a pit");
      }
    }
    if (level && level.hero && level.goal && (level.shards || []).some(s => s.x < level.hero.x || s.x > level.goal.x)) errors.push("collectible outside playable route");
    if (level && level.hero && level.goal && (level.switches || []).some(s => s.x < level.hero.x || s.x > level.goal.x)) errors.push("switch outside playable route");
    if (level && level.boss && (!Number.isFinite(level.boss.hp) || level.boss.hp < 1)) errors.push("invalid boss state");
    return { valid: errors.length === 0, errors };
  }

  function generateUniqueLevel(number, history) {
    const records = Array.isArray(history) ? history : [];
    const used = new Set(records.map(item => typeof item === "string" ? item : item && item.fingerprint).filter(Boolean));
    const similar = new Set(records.map(item => item && typeof item === "object" ? item.similarity : null).filter(Boolean));
    let candidate;
    for (let attempt = 0; attempt < 1000; attempt++) {
      const seed = hash32("candidate:" + number + ":" + attempt);
      candidate = makeLevel(number, seed);
      candidate.fingerprint = fingerprint(candidate);
      candidate.similarity = similarityFingerprint(candidate);
      candidate.attempt = attempt;
      if (validateLevel(candidate).valid && !used.has(candidate.fingerprint) && !similar.has(candidate.similarity)) return candidate;
    }
    throw new Error("Unable to create a unique valid level after 1000 attempts");
  }

  const api = { makeLevel, generateUniqueLevel, fingerprint, similarityFingerprint, validateLevel, getDifficulty, difficultyName, TYPES, WORLDS, WEATHER, OBJECTIVES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LevelCore = api;
})(typeof window !== "undefined" ? window : globalThis);
