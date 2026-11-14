(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const $ = id => document.getElementById(id);
  const STORAGE = {
    level: "starbound_v3_level", best: "starbound_v3_best", stars: "starbound_v3_stars",
    history: "starbound_v3_history", current: "starbound_v3_current", sound: "starbound_v3_sound"
  };
  const safeGet = (key, fallback = null) => { try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch (_) { return fallback; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, String(value)); } catch (_) { say("Browser storage is full; progress may not persist."); } };
  const safeRemove = key => { try { localStorage.removeItem(key); } catch (_) {} };

  let viewW = 900, viewH = 500, scale = 1, dpr = 1;
  let level = null, hero = null, platforms = [], hazards = [], objects = [], shards = [], switches = [], anchors = [], enemies = [], plants = [], events = [];
  let camera = 0, frame = 0, lastTime = 0, accumulator = 0, started = false, paused = false, finished = false, gameOver = false;
  let rope = null, totalStars = Number(safeGet(STORAGE.stars, "0")) || 0, levelStartFrame = 0, checkpointX = 90, toastTimer = 0, shake = 0;
  let levelNo = Math.max(1, Number(safeGet(STORAGE.level, safeGet("sb_level", "1"))) || 1);
  let best = Math.max(levelNo, Number(safeGet(STORAGE.best, safeGet("sb_best", "1"))) || 1);
  let keys = Object.create(null), pressed = Object.create(null), particles = [], activeEvents = [], lastWorldId = "";
  let soundOn = safeGet(STORAGE.sound, "1") !== "0", audioContext = null, ambienceOsc = null, ambienceGain = null;
  let currentLevelSnapshot = null;

  $("best") && ($("best").textContent = best);
  $("shards").textContent = totalStars;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    scale = rect.height / 500;
    viewH = 500;
    viewW = rect.width / Math.max(.45, scale);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas);
  addEventListener("resize", resize, { passive: true });
  resize();

  function say(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1900);
  }
  function rand(seed) { let x = seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function unlockAudio() {
    if (!soundOn || audioContext) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioContext = new AC();
      ambienceOsc = audioContext.createOscillator();
      ambienceGain = audioContext.createGain();
      ambienceOsc.type = "sine";
      ambienceOsc.frequency.value = 54;
      ambienceGain.gain.value = .012;
      ambienceOsc.connect(ambienceGain).connect(audioContext.destination);
      ambienceOsc.start();
    } catch (_) { audioContext = null; }
  }
  function tone(freq = 440, duration = .09, type = "sine", volume = .045) {
    if (!soundOn) return;
    unlockAudio();
    if (!audioContext) return;
    try {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      osc.connect(gain).connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
    } catch (_) {}
  }
  function setSound(value) {
    soundOn = !!value;
    safeSet(STORAGE.sound, soundOn ? "1" : "0");
    if (!soundOn && audioContext) {
      try { ambienceGain.gain.value = 0; } catch (_) {}
    } else unlockAudio();
  }
  function updateAmbience() {
    if (!audioContext || !ambienceOsc || !ambienceGain || !soundOn || !level) return;
    const frequency = level.world.id.includes("haunted") || level.world.id.includes("graveyard") ? 42 : level.world.id.includes("alien") ? 68 : level.world.id.includes("frozen") ? 58 : 52;
    ambienceOsc.frequency.setTargetAtTime(frequency, audioContext.currentTime, .8);
    ambienceGain.gain.setTargetAtTime(level.weather === "thunderstorm" ? .02 : .009, audioContext.currentTime, .8);
  }

  function getHistory() {
    try { const parsed = JSON.parse(safeGet(STORAGE.history, "[]")); return Array.isArray(parsed) ? parsed : []; }
    catch (_) { return []; }
  }
  function saveHistory(fingerprint, similarity) {
    const history = getHistory();
    history.push({ fingerprint, similarity });
    safeSet(STORAGE.history, JSON.stringify(history.slice(-2500)));
  }
  function loadLevel(number, fresh = false) {
    levelNo = Math.max(1, Math.floor(number));
    let generated = null;
    if (!fresh) {
      try {
        const cached = JSON.parse(safeGet(STORAGE.current, "null"));
        if (cached && cached.number === levelNo && CoreValid(cached)) generated = cached;
      } catch (_) {}
    }
    if (!generated) {
      const history = getHistory();
      generated = LevelCore.generateUniqueLevel(levelNo, history);
      saveHistory(generated.fingerprint, generated.similarity || LevelCore.similarityFingerprint(generated));
      safeSet(STORAGE.current, JSON.stringify(generated));
    }
    if (!CoreValid(generated)) {
      generated = LevelCore.generateUniqueLevel(levelNo, getHistory());
      safeSet(STORAGE.current, JSON.stringify(generated));
    }
    level = generated;
    currentLevelSnapshot = clone(level);
    instantiateLevel();
    started = true; paused = false; finished = false; gameOver = false;
    safeSet(STORAGE.level, levelNo);
    $("levelNo").textContent = String(levelNo).padStart(2, "0");
    $("worldName").textContent = level.world.name.toUpperCase() + " · " + level.difficultyName;
    $("mission").textContent = level.description || level.objective.name;
    $("weatherLabel").textContent = level.weather.replace(/-/g, " ").toUpperCase() + " · " + level.timeOfDay.toUpperCase() + (level.surviveFrames ? " · SURVIVE " + Math.ceil(level.surviveFrames / 60) + "S" : "");
    $("difficulty").textContent = level.difficultyName;
    $("shards").textContent = totalStars;
    $("health").textContent = "3";
    camera = 0; frame = 0; levelStartFrame = 0; checkpointX = 90;
    lastWorldId = level.world.id;
    updateAmbience();
  }
  function CoreValid(lvl) {
    return !!(lvl && LevelCore.validateLevel(lvl).valid);
  }
  function instantiateLevel() {
    platforms = clone(level.platforms || []);
    hazards = clone(level.hazards || []);
    objects = clone(level.objects || []);
    shards = clone(level.shards || []);
    switches = clone(level.switches || []);
    anchors = clone(level.anchors || []);
    enemies = clone(level.enemies || []);
    plants = clone(level.plants || []);
    events = clone(level.events || []);
    particles = []; activeEvents = []; rope = null;
    hero = { x: level.hero.x, y: level.hero.y, vx: 0, vy: 0, w: 18, h: 36, ground: false, face: 1, health: 3, hurt: 0, invulnerable: 0, anim: 0 };
  }
  function startNewJourney() {
    const progress = Number(safeGet(STORAGE.level, "1")) || 1;
    if (progress > 1 && !window.confirm("Start a new Starbound journey? Your current local progress will be reset.")) return;
    [STORAGE.level, STORAGE.best, STORAGE.stars, STORAGE.history, STORAGE.current].forEach(safeRemove);
    totalStars = 0; best = 1; levelNo = 1;
    $("best").textContent = "1"; $("shards").textContent = "0";
    loadLevel(1, true);
    hideOverlay(); unlockAudio(); say("A new world has been generated.");
  }
  function continueJourney() {
    loadLevel(levelNo, false); hideOverlay(); unlockAudio(); say("Journey resumed — stay alert.");
  }
  function hideOverlay() { $("overlay").classList.add("hidden"); }
  function showOverlay(title, html, actions = {}) {
    const overlay = $("overlay"), panel = overlay.querySelector(".panel");
    panel.innerHTML = `<div class="eyebrow">STARBOUND · GAMERKIE</div><h1>${title}</h1>${html}`;
    overlay.classList.remove("hidden");
    Object.entries(actions).forEach(([id, fn]) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn, { once: true }); });
  }
  function openHome() {
    const wasStarted = started && !gameOver && !finished;
    paused = started;
    const resumeLabel = wasStarted ? "RESUME" : (safeGet(STORAGE.current) ? "CONTINUE" : "START ADVENTURE");
    showOverlay("STAR<span>BOUND</span>", `<p>ONE HERO. INFINITE WORLDS.<br>NO TWO JOURNEYS ALIKE.</p><div class="menu-buttons"><button id="newJourney" class="primary">NEW JOURNEY</button><button id="resumeJourney" class="secondary">${resumeLabel}</button></div><div class="menu-links"><button id="mapHome">WORLD MAP</button><button id="settingsHome">SETTINGS</button><button id="howHome">HOW TO PLAY</button></div>`, {
      newJourney: startNewJourney,
      resumeJourney: () => { if (wasStarted) { paused = false; hideOverlay(); } else if (safeGet(STORAGE.current)) continueJourney(); else startNewJourney(); },
      mapHome: showWorldMap,
      settingsHome: showSettings,
      howHome: showHowTo
    });
  }
  function showWorldMap() {
    const cards = LevelCore.WORLDS.map((w, i) => `<span class="world-chip">${String(i + 1).padStart(2, "0")} · ${w.name}</span>`).join("");
    showOverlay("WORLD MAP", `<p>Worlds rotate as your journey continues. Each sector combines a different environment, weather pattern and puzzle layout.</p><div class="world-list">${cards}</div><button id="mapBack" class="secondary">BACK</button>`, { mapBack: openHome });
  }
  function showSettings() {
    showOverlay("SETTINGS", `<p>Sound effects and atmospheric tone: <b>${soundOn ? "ON" : "OFF"}</b></p><button id="toggleSound" class="primary">${soundOn ? "TURN SOUND OFF" : "TURN SOUND ON"}</button><p class="small-note">Mobile tip: rotate your device to landscape for a wider view. Fullscreen is available from your browser.</p><button id="settingsBack" class="secondary">BACK</button>`, {
      toggleSound: () => { setSound(!soundOn); showSettings(); }, settingsBack: openHome
    });
  }
  function showHowTo() {
    showOverlay("HOW TO PLAY", `<p><b>MOVE</b> with A/D or left/right arrows.<br><b>JUMP</b> with Space, W or ↑.<br><b>GRAPPLE</b> with E near a glowing anchor; press E again to release.<br><b>INTERACT</b> with switches and vulnerable boss cores using E.<br>Push glowing cores onto floor plates. Collect stars and look for the portal.</p><button id="howBack" class="secondary">BACK</button>`, { howBack: openHome });
  }
  $("startBtn").addEventListener("click", startNewJourney);
  $("continueBtn").addEventListener("click", continueJourney);
  $("pauseBtn").addEventListener("click", () => { if (!started || finished || gameOver) return; paused ? (paused = false, hideOverlay()) : (paused = true, showOverlay("PAUSED", `<p>Take a breath. The world is still waiting.</p><button id="resumeBtn" class="primary">RESUME</button><button id="restartBtn" class="secondary">RESTART LEVEL</button><button id="homeBtn" class="secondary">MAIN MENU</button>`, { resumeBtn: () => { paused = false; hideOverlay(); }, restartBtn: restartLevel, homeBtn: openHome })); });
  $("worldMapBtn").addEventListener("click", showWorldMap);
  $("settingsBtn").addEventListener("click", showSettings);
  $("howBtn").addEventListener("click", showHowTo);

  function restartLevel() {
    if (!currentLevelSnapshot) return;
    level = clone(currentLevelSnapshot); instantiateLevel();
    paused = false; finished = false; gameOver = false; frame = 0; camera = 0; checkpointX = 90;
    hideOverlay(); say("Level restarted.");
  }
  function finishLevel() {
    if (finished) return;
    finished = true; tone(760, .18, "triangle", .07); tone(980, .23, "sine", .05);
    levelNo++;
    best = Math.max(best, levelNo);
    safeSet(STORAGE.level, levelNo); safeSet(STORAGE.best, best);
    $("best") && ($("best").textContent = best);
    showOverlay("SECTOR CLEARED", `<p>${level.world.name} survived.<br>Stars collected: <b>${totalStars}</b><br>Next world: unknown.</p><button id="nextLevel" class="primary">NEXT LEVEL</button><button id="replayLevel" class="secondary">REPLAY LEVEL</button>`, {
      nextLevel: () => { loadLevel(levelNo, true); hideOverlay(); say("Level " + levelNo + " · a new world awaits."); },
      replayLevel: () => { levelNo--; safeSet(STORAGE.level, levelNo); restartLevel(); }
    });
  }
  function triggerGameOver(message) {
    if (gameOver) return;
    gameOver = true; paused = true; rope = null; tone(110, .35, "sawtooth", .05);
    showOverlay("YOU FELL INTO THE UNKNOWN", `<p>${message || "The world claimed another traveller."}<br>Sector ${levelNo} · ${level.world.name}</p><button id="retryBtn" class="primary">TRY AGAIN</button><button id="gameHomeBtn" class="secondary">MAIN MENU</button>`, {
      retryBtn: restartLevel, gameHomeBtn: openHome
    });
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if ((k === "e" || k === "enter") && !e.repeat && started && !paused) interact();
    if (k === "escape" && started && !finished && !gameOver) $("pauseBtn").click();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  document.querySelectorAll("[data-key]").forEach(button => {
    const k = button.dataset.key;
    const mapped = { left: "arrowleft", right: "arrowright", jump: " ", interact: "e" }[k];
    button.addEventListener("pointerdown", e => {
      e.preventDefault(); unlockAudio();
      if (k === "interact") { if (started && !paused) interact(); return; }
      keys[mapped] = true; pressed[mapped] = true;
      try { button.setPointerCapture(e.pointerId); } catch (_) {}
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(evt => button.addEventListener(evt, e => { e.preventDefault(); keys[mapped] = false; }));
    button.addEventListener("contextmenu", e => e.preventDefault());
  });

  function nearestAnchor() {
    let bestAnchor = null, distance = Infinity;
    for (const a of anchors) {
      const d = Math.hypot(a.x - hero.x, a.y - (hero.y - 8));
      if (d < distance && d < (a.radius || 245)) { bestAnchor = a; distance = d; }
    }
    return bestAnchor;
  }
  function interact() {
    if (!started || paused || finished || gameOver || !hero) return;
    unlockAudio();
    if (level.boss && !level.boss.defeated && Math.hypot(hero.x - level.boss.x, hero.y - level.boss.y) < 105) {
      if (level.boss.vulnerable) {
        level.boss.hp--; tone(230, .12, "square", .07); say("Guardian hit! " + Math.max(0, level.boss.hp) + " remaining.");
        if (level.boss.hp <= 0) { level.boss.defeated = true; tone(520, .4, "triangle", .08); say("World guardian defeated!"); }
      } else say("The guardian is protected. Wait for its core to glow!");
      return;
    }
    const sw = switches.find(s => !s.active && Math.abs(s.x - hero.x) < 90 && Math.abs((s.y - 16) - hero.y) < 75 && s.kind !== "plate");
    if (sw) { sw.active = true; tone(620, .14, "sine"); say("Ancient node activated."); return; }
    if (rope) { rope = null; tone(310, .06); say("Tether released."); return; }
    const a = nearestAnchor();
    if (a) {
      rope = { x: a.x, y: a.y, len: Math.max(78, Math.min(220, Math.hypot(a.x - hero.x, a.y - hero.y))) };
      tone(540, .09, "triangle"); say("Grapple attached — swing!");
    } else say("No anchor or control in reach.");
  }

  function isOverPit(x) { return hazards.some(h => h.kind === "pit" && x > h.x - h.w / 2 && x < h.x + h.w / 2); }
  function updatePlatforms(dt) {
    for (const p of platforms) {
      if (p.moving) p.x = p.baseX + Math.sin(frame * p.speed + p.phase) * p.amplitude;
    }
  }
  function moveHero(dt) {
    const left = keys.arrowleft || keys.a, right = keys.arrowright || keys.d;
    const jump = pressed[" "] || pressed.arrowup || pressed.w;
    const wind = level.weather === "wind" || level.weather === "thunderstorm" || level.weather === "blizzard" ? Math.sin(frame * .016) * .38 : 0;
    const acceleration = level.weather === "snow" || level.weather === "blizzard" ? 690 : 930;
    if (left) { hero.vx -= acceleration * dt; hero.face = -1; }
    if (right) { hero.vx += acceleration * dt; hero.face = 1; }
    hero.vx += wind * 60 * dt;
    const friction = hero.ground ? (level.weather === "rain" ? .93 : level.weather === "ice" ? .985 : .82) : .985;
    hero.vx *= Math.pow(friction, dt * 60);
    hero.vx = Math.max(-310, Math.min(310, hero.vx));
    if (jump && hero.ground) { hero.vy = -390; hero.ground = false; tone(280, .07, "triangle", .035); }
    hero.vy = Math.min(720, hero.vy + 1050 * dt);
    const oldBottom = hero.y + hero.h / 2;
    hero.x += hero.vx * dt;
    hero.y += hero.vy * dt;
    hero.ground = false;

    // Rope tether: preserve tangential momentum and remove radial velocity at its limit.
    if (rope) {
      const dx = hero.x - rope.x, dy = hero.y - 8 - rope.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > rope.len) {
        const nx = dx / dist, ny = dy / dist;
        hero.x = rope.x + nx * rope.len;
        hero.y = rope.y + ny * rope.len + 8;
        const radial = hero.vx * nx + hero.vy * ny;
        hero.vx -= radial * nx;
        hero.vy -= radial * ny;
        hero.vx += -ny * 12 * dt;
      }
    }

    const pit = isOverPit(hero.x);
    if (!pit && hero.y + hero.h / 2 >= level.groundY && hero.vy >= 0) {
      hero.y = level.groundY - hero.h / 2; hero.vy = 0; hero.ground = true;
    }
    for (const p of platforms) {
      const bottom = hero.y + hero.h / 2;
      if (hero.x + 10 > p.x && hero.x - 10 < p.x + p.w && oldBottom <= p.y + 9 && bottom >= p.y && hero.vy >= 0) {
        hero.y = p.y - hero.h / 2; hero.vy = 0; hero.ground = true;
        if (p.moving) hero.x += (p.x - (p._lastX == null ? p.x : p._lastX));
      }
      p._lastX = p.x;
    }
    hero.x = Math.max(18, Math.min(level.width - 18, hero.x));
    hero.anim += dt * (Math.abs(hero.vx) > 15 ? 11 : 3);
    if (hero.ground && hero.x > checkpointX + 350) checkpointX = hero.x;
    if (hero.y > 650) damage("You fell into the darkness.", true);
  }

  function updateObjects(dt) {
    for (const o of objects) {
      o.vy = Math.min(650, (o.vy || 0) + 980 * dt);
      o.x += (o.vx || 0) * dt; o.y += o.vy * dt;
      if (o.y + o.r >= level.groundY && !isOverPit(o.x)) { o.y = level.groundY - o.r; o.vy = 0; }
      for (const p of platforms) if (o.x + o.r > p.x && o.x - o.r < p.x + p.w && o.y + o.r >= p.y && o.y + o.r < p.y + 24 && o.vy >= 0) { o.y = p.y - o.r; o.vy = 0; }
      if (Math.abs(hero.x - o.x) < o.r + 18 && Math.abs(hero.y - o.y) < o.r + 25) {
        o.x += hero.vx * dt * 1.3 + hero.face * 24 * dt;
        o.vx = Math.max(-210, Math.min(210, (o.vx || 0) * .86 + hero.vx * .18));
      }
      o.vx *= Math.pow(.97, dt * 60);
    }
    for (const s of switches) if (s.kind === "plate") {
      s.active = objects.some(o => Math.abs(o.x - s.x) < 34 && Math.abs(o.y - (level.groundY - 18)) < 46);
    }
  }
  function collectItems() {
    for (const s of shards) if (!s.got && Math.hypot(hero.x - s.x, hero.y - s.y) < 30) {
      s.got = true; totalStars += s.value || 1; $("shards").textContent = totalStars; safeSet(STORAGE.stars, totalStars); tone(820, .12, "sine");
    }
    if (level.artifact && !level.artifact.collected && Math.hypot(hero.x - level.artifact.x, hero.y - level.artifact.y) < 34) { level.artifact.collected = true; say("Ancient artifact recovered!"); tone(690, .2, "triangle"); }
    if (level.rescue && !level.rescue.rescued && Math.hypot(hero.x - level.rescue.x, hero.y - level.rescue.y) < 38) { level.rescue.rescued = true; say("Signal found. Survivor rescued!"); tone(620, .2); }
  }
  function damage(message, fatalFall = false) {
    if (hero.invulnerable > 0 || gameOver) return;
    hero.health--; hero.invulnerable = 1.35; hero.hurt = .35; rope = null;
    $("health").textContent = Math.max(0, hero.health);
    tone(95, .18, "sawtooth", .07); say(message || "You were hit!"); shake = 9;
    if (hero.health <= 0) { triggerGameOver(message || "The creature caught you."); return; }
    hero.x = checkpointX; hero.y = level.groundY - 55; hero.vx = 0; hero.vy = 0;
    if (fatalFall) say("The void pulled you down. Checkpoint restored.");
  }
  function updateHazards(dt) {
    for (const h of hazards) {
      if (h.kind === "pit") continue;
      const active = h.kind === "laser" ? Math.sin(frame * .045 + h.phase) > -.14 : h.kind === "steam-vent" ? Math.sin(frame * .03 + h.phase) > .25 : h.kind === "falling-rock" ? Math.sin(frame * .018 + h.phase) > .65 : true;
      h.active = active;
      if (active && hero.x > h.x - h.w / 2 - 9 && hero.x < h.x + h.w / 2 + 9 && hero.y + hero.h / 2 > h.y - (h.kind === "laser" ? 0 : 10)) damage("Hazard! Time your crossing.");
    }
  }
  function updateEnemies(dt) {
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = hero.x - e.x;
      if (e.attack === "chase" && Math.abs(dx) < 230) e.x += Math.sign(dx) * (85 + level.difficulty * 4) * dt;
      else e.x += e.vx * 60 * dt;
      if (Math.abs(e.x - (e.startX || (e.startX = e.x))) > e.range) e.vx *= -1;
      if (e.kind.includes("bat") || e.kind.includes("glider") || e.kind.includes("ray") || e.kind.includes("jelly") || e.kind.includes("moth")) e.y = e.baseY + Math.sin(frame * .04 + e.phase) * 22;
      if (Math.hypot(hero.x - e.x, hero.y - e.y) < 27) damage("A " + e.kind.replace(/-/g, " ") + " attacked you!");
    }
  }
  function updateBoss(dt) {
    const b = level.boss;
    if (!b || b.defeated) return;
    b.phase += dt * 2.2;
    b.vulnerable = Math.sin(b.phase) > .52;
    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      b.attackTimer = Math.max(1.2, 3.1 - level.difficulty * .035);
      if (Math.abs(hero.x - b.x) < 350) {
        const direction = Math.sign(hero.x - b.x) || -1;
        particles.push({ x: b.x + direction * 38, y: level.groundY - 14, vx: direction * 190, vy: -120, life: 1.2, kind: "shock" });
      }
    }
    b.x += Math.sin(b.phase * .55) * 35 * dt;
    if (Math.hypot(hero.x - b.x, hero.y - b.y) < b.radius + 19 && b.vulnerable) damage("The guardian struck back!");
  }
  function updateEvents(dt) {
    for (const e of events) {
      if (!e.triggered && Math.abs(hero.x - e.x) < 125) {
        e.triggered = true; e.timer = 4.5; shake = Math.max(shake, 4);
        say(({ "falling-tree": "A dead tree is crashing down!", "bridge-collapse": "The ground is breaking!", meteor: "Meteor incoming!", rockfall: "Rockfall! Move!", "hidden-cave": "A hidden cave entrance has appeared.", "wind-burst": "A violent wind gust hits!", shadow: "Something is watching from the dark.", "portal-rift": "A strange rift tears through the air.", "spider-drop": "Something is dropping from above!", earthquake: "Earthquake! Keep moving!" })[e.kind] || "A strange event begins.");
        if (e.kind === "spider-drop") enemies.push({ kind: "spider", x: e.x, y: 160, baseY: level.groundY - 24, vx: -1.5, range: 150, phase: 0, hp: 1, active: true, attack: "chase" });
        if (e.kind === "meteor" || e.kind === "rockfall") particles.push({ x: e.x, y: 40, vx: -30, vy: 230, life: 2.2, kind: "meteor" });
        if (e.kind === "bridge-collapse" && !hazards.some(h => h.kind === "pit" && Math.abs(h.x - e.x) < 80)) hazards.push({ x: e.x, y: level.groundY, w: 108, h: 100, kind: "pit", dynamic: true });
        if (e.kind === "falling-tree") e.impact = false;
      }
      if (e.triggered) { e.timer -= dt; if (e.kind === "wind-burst" && e.timer > 0) hero.vx += Math.sign(hero.x - e.x || 1) * 50 * dt; }
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === "meteor" ? 30 : 280) * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
  }
  function objectiveUnlocked() {
    if (level.boss && !level.boss.defeated) return false;
    const allSwitches = switches.length === 0 || switches.every(s => s.active);
    const allShards = shards.every(s => s.got);
    let coreReady = true;
    if (level.type === "ORB" || level.type === "TWIN" || level.type === "SWITCH" || level.type === "DODGE") coreReady = allSwitches;
    if (level.type === "SHARDS" || level.type === "SWING") coreReady = allShards;
    if (!coreReady) return false;
    if (level.artifact && !level.artifact.collected) return false;
    if (level.rescue && !level.rescue.rescued) return false;
    if (level.surviveFrames && frame - levelStartFrame < level.surviveFrames) return false;
    return true;
  }
  function update(dt) {
    if (!started || paused || finished || gameOver || !level) return;
    frame++; levelStartFrame = levelStartFrame || frame;
    if (hero.invulnerable > 0) hero.invulnerable -= dt;
    if (hero.hurt > 0) hero.hurt -= dt;
    updatePlatforms(dt);
    moveHero(dt);
    updateObjects(dt);
    collectItems();
    updateHazards(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateEvents(dt);
    if (level.weather === "thunderstorm" && frame % 470 < 3) { tone(55, .48, "sawtooth", .035); shake = Math.max(shake, 5); }
    if (hero.ground && hero.x > checkpointX + 220) checkpointX = hero.x;
    camera = Math.max(0, Math.min(level.width - viewW, hero.x - viewW * .36));
    if (hero.x > level.width * .92 && objectiveUnlocked()) finishLevel();
    if (Math.hypot(hero.x - level.goal.x, hero.y - level.goal.y) < 68 && objectiveUnlocked()) finishLevel();
    if (shake > 0) shake = Math.max(0, shake - 24 * dt);
    Object.keys(pressed).forEach(k => delete pressed[k]);
  }

  function line(x1, y1, x2, y2, color = "#fff", width = 2) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function circle(x, y, r, color, stroke = null, width = 2) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); } }
  function rounded(x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }

  function drawBackground() {
    const world = level.world;
    const grad = ctx.createLinearGradient(0, 0, 0, 500);
    grad.addColorStop(0, world.sky[0]); grad.addColorStop(1, world.sky[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, viewW, 500);
    const isNight = ["night", "moonlit"].includes(level.timeOfDay) || level.weather === "night";
    const sunX = viewW * .77, sunY = level.timeOfDay === "sunset" ? 235 : 92;
    circle(sunX, sunY, isNight ? 30 : 36, isNight ? "#d9e1ff" : level.timeOfDay === "sunset" ? "#ffad68" : "#ffe9a6");
    if (isNight) { circle(sunX - 9, sunY - 8, 29, world.sky[0]); }
    for (let i = 0; i < 80; i++) {
      const x = (i * 137.5 - camera * .08) % viewW, y = (i * 73) % 235;
      if (isNight || level.world.id.includes("alien") || level.world.id.includes("cave")) circle((x + viewW) % viewW, y, i % 5 === 0 ? 1.5 : .7, i % 3 === 0 ? world.accent : "#dceaff");
    }
    // Distant hills and world silhouettes.
    ctx.fillStyle = world.far;
    ctx.beginPath(); ctx.moveTo(0, 360);
    for (let x = 0; x <= viewW + 30; x += 30) ctx.lineTo(x, 300 + Math.sin((x + camera * .12) * .009) * 32 + Math.cos((x + camera * .1) * .021) * 18);
    ctx.lineTo(viewW, 500); ctx.lineTo(0, 500); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#08111b66";
    for (let i = 0; i < 14; i++) {
      const x = (i * 110 - camera * .22) % (viewW + 120);
      const xx = (x + viewW + 120) % (viewW + 120) - 60;
      const base = 385 + Math.sin(i * 7) * 15;
      if (["sky-world", "alien-planet"].includes(world.id)) {
        ctx.beginPath(); ctx.ellipse(xx, base, 42, 10 + (i % 3) * 5, 0, 0, Math.PI * 2); ctx.fill();
      } else if (world.id.includes("abandoned") || world.id.includes("clockwork")) {
        ctx.fillRect(xx, base - 95 - (i % 4) * 24, 28 + (i % 3) * 15, 110);
        ctx.fillRect(xx - 5, base - 105 - (i % 4) * 24, 40 + (i % 3) * 15, 10);
      } else {
        ctx.fillRect(xx, base - 60 - (i % 4) * 18, 8, 75);
        circle(xx + 4, base - 75 - (i % 4) * 18, 25 + (i % 3) * 8, "#07121c55");
      }
    }
  }

  function drawGround() {
    const c = level.world.ground;
    ctx.fillStyle = c;
    ctx.fillRect(camera - 40, level.groundY, level.width + viewW, 100);
    ctx.fillStyle = level.world.accent; ctx.globalAlpha = .65; ctx.fillRect(camera - 40, level.groundY, level.width + viewW, 3); ctx.globalAlpha = 1;
    for (const h of hazards) if (h.kind === "pit") {
      ctx.fillStyle = "#020308"; ctx.fillRect(h.x - h.w / 2, level.groundY - 4, h.w, 120);
      ctx.fillStyle = level.world.danger; ctx.globalAlpha = .25; ctx.fillRect(h.x - h.w / 2, level.groundY + 18, h.w, 3); ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 60; i++) {
      const x = (i * 71 + level.seed % 67) % level.width;
      if (x < camera - 10 || x > camera + viewW + 10) continue;
      ctx.fillStyle = i % 2 ? "#ffffff18" : "#00000018";
      ctx.fillRect(x, level.groundY + 14 + (i % 5) * 12, 12 + (i % 4) * 7, 2);
    }
  }
  function drawPlatforms() {
    for (const p of platforms) {
      ctx.fillStyle = "#0a0d16"; ctx.fillRect(p.x, p.y + p.h, p.w, 8);
      ctx.fillStyle = level.world.ground; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = level.world.accent; ctx.globalAlpha = .8; ctx.fillRect(p.x, p.y, p.w, 3); ctx.globalAlpha = 1;
      if (p.moving) { circle(p.x + p.w / 2, p.y - 5, 3, level.world.accent); }
    }
  }
  function drawPlant(p) {
    const sway = Math.sin(frame * .025 + p.phase) * 5;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.scale, p.scale);
    const kind = p.kind;
    if (kind.includes("crystal") || kind.includes("ice")) {
      ctx.fillStyle = level.world.accent; ctx.shadowColor = level.world.accent; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-4, -35); ctx.lineTo(3, -52); ctx.lineTo(10, -4); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    } else if (kind.includes("cactus")) {
      ctx.strokeStyle = "#71a66c"; ctx.lineWidth = 8; ctx.lineCap = "round"; line(0, 0, 0, -37, "#71a66c", 8); line(0, -20, -12, -30, "#71a66c", 6); line(-12, -30, -12, -39, "#71a66c", 5); line(0, -27, 12, -34, "#71a66c", 6);
    } else if (kind.includes("mushroom") || kind.includes("fungus") || kind.includes("spore")) {
      ctx.fillStyle = "#c3a3d9"; ctx.fillRect(-3, -18, 6, 18); ctx.fillStyle = level.world.accent; ctx.beginPath(); ctx.ellipse(0, -20, 17, 9, 0, Math.PI, Math.PI * 2); ctx.fill(); circle(-5, -24, 2, "#fff"); circle(6, -22, 2, "#fff");
    } else if (kind.includes("dead") || kind.includes("moon") || kind.includes("cracked") || kind.includes("ash")) {
      line(0, 0, sway * .3, -65, "#d8d8e2", 5); line(0, -38, -22 + sway, -57, "#c5c5d0", 3); line(0, -46, 22 + sway, -67, "#c5c5d0", 3); line(0, -29, 18, -37, "#c5c5d0", 3);
    } else if (kind.includes("carnivore") || kind.includes("poison") || kind.includes("bloom")) {
      line(0, 0, sway, -28, "#6fb56e", 5); ctx.fillStyle = "#e76a8b"; ctx.beginPath(); ctx.ellipse(sway, -31, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 5; i++) line(sway, -31, sway + Math.cos(i * 1.25) * 18, -31 + Math.sin(i * 1.25) * 13, "#80bb65", 3);
    } else {
      line(0, 0, sway, -42, "#638f69", 4); ctx.fillStyle = level.world.accent; ctx.beginPath(); ctx.ellipse(-10 + sway, -26, 13, 5, -.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(11 + sway, -37, 13, 5, .5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawEnemies() {
    for (const e of enemies) if (e.active) {
      const x = e.x, y = e.y, k = e.kind;
      ctx.save(); ctx.translate(x, y);
      const tint = k.includes("ghost") || k.includes("wraith") || k.includes("shadow") ? "#c5c6eb" : k.includes("alien") || k.includes("mutant") ? "#82ffc9" : k.includes("magma") ? "#ff8048" : k.includes("ice") ? "#a8ebff" : k.includes("scorpion") ? "#d5a06b" : "#333d4d";
      ctx.fillStyle = tint; ctx.shadowColor = tint; ctx.shadowBlur = k.includes("ghost") || k.includes("alien") ? 12 : 0;
      if (k.includes("bat") || k.includes("glider") || k.includes("ray") || k.includes("moth")) {
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-28, -24 + Math.sin(frame * .2) * 8, -24, 4); ctx.quadraticCurveTo(-12, 8, -3, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(28, -24 - Math.sin(frame * .2) * 8, 24, 4); ctx.quadraticCurveTo(12, 8, 3, 0); ctx.fill();
      } else if (k.includes("spider")) {
        circle(0, 0, 10, tint); circle(7, -4, 5, tint);
        for (let i = 0; i < 4; i++) { const a = (i / 3) * Math.PI - Math.PI / 2; line(-3, 1, -18, Math.sin(a) * 15, tint, 2); line(4, 1, 20, Math.sin(a) * 15, tint, 2); }
      } else if (k.includes("snake") || k.includes("worm") || k.includes("crawler") || k.includes("leech")) {
        ctx.beginPath(); ctx.moveTo(-17, 4); ctx.quadraticCurveTo(-3, -13, 8, 2); ctx.quadraticCurveTo(18, 12, 22, -5); ctx.lineWidth = 8; ctx.strokeStyle = tint; ctx.stroke(); circle(21, -5, 6, tint);
      } else if (k.includes("wolf") || k.includes("hound") || k.includes("crocodile") || k.includes("beast") || k.includes("ogre")) {
        rounded(-17, -13, 34, 24, 9, tint); ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-15, -24); ctx.lineTo(-2, -16); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(17, -23); ctx.lineTo(15, -8); ctx.fill();
      } else { circle(0, 0, 13, tint); circle(-5, -4, 2, "#ffefae"); circle(6, -4, 2, "#ffefae"); }
      ctx.shadowBlur = 0; circle(5, -4, 2.2, "#ff3b54");
      ctx.restore();
    }
  }
  function drawBoss() {
    const b = level.boss; if (!b || b.defeated) return;
    ctx.save(); ctx.translate(b.x, b.y); const glow = b.vulnerable ? "#fff2a6" : "#fb525f";
    ctx.shadowColor = glow; ctx.shadowBlur = b.vulnerable ? 24 : 9;
    circle(0, 0, b.radius, b.vulnerable ? "#8d574d" : "#292c3a", glow, 4);
    circle(-15, -8, 6, b.vulnerable ? "#fff" : "#ff4058"); circle(15, -8, 6, b.vulnerable ? "#fff" : "#ff4058");
    circle(0, 8, b.vulnerable ? 11 : 6, glow);
    ctx.shadowBlur = 0; ctx.fillStyle = "#fff"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.fillText(b.name + " · " + b.hp + "/" + b.maxHp, 0, -b.radius - 16);
    ctx.restore();
  }
  function drawHazards() {
    for (const h of hazards) {
      if (h.kind === "pit") continue;
      const x = h.x - h.w / 2;
      if (h.kind === "laser") {
        ctx.fillStyle = "#3e4c62"; ctx.fillRect(x, h.y, h.w, h.h);
        if (h.active) { ctx.shadowColor = "#ff375d"; ctx.shadowBlur = 18; ctx.fillStyle = "#ff4567"; ctx.fillRect(x, h.y, h.w, h.h); ctx.shadowBlur = 0; }
      } else if (h.kind === "spikes") {
        ctx.fillStyle = "#222936"; ctx.fillRect(x, level.groundY - 8, h.w, 8); ctx.fillStyle = level.world.danger;
        for (let px = x; px < x + h.w; px += 14) { ctx.beginPath(); ctx.moveTo(px, level.groundY); ctx.lineTo(px + 7, level.groundY - 20); ctx.lineTo(px + 14, level.groundY); ctx.fill(); }
      } else {
        ctx.fillStyle = h.kind === "acid" ? "#a5dc42" : h.kind === "falling-rock" ? "#7b7b86" : "#ff9a58";
        ctx.globalAlpha = .75; ctx.fillRect(x, h.y - 7, h.w, 10); ctx.globalAlpha = 1;
        circle(x + h.w / 2, h.y - 9, 4, "#fff3b0");
      }
    }
  }
  function drawItems() {
    for (const a of anchors) {
      circle(a.x, a.y, 7, "#ff9a3c", "#fff0ce", 2); circle(a.x, a.y, 13, "#ff9a3c33");
    }
    if (rope) { line(hero.x, hero.y - 8, rope.x, rope.y, "#f8faff", 2); circle(rope.x, rope.y, 4, "#fff"); }
    for (const s of switches) {
      ctx.shadowColor = s.active ? "#65ffe4" : level.world.accent; ctx.shadowBlur = 12;
      rounded(s.x - 17, level.groundY - 9, 34, 8, 3, s.active ? "#65ffe4" : "#ff9e43"); circle(s.x, level.groundY - 17, 5, s.active ? "#65ffe4" : "#ff9e43"); ctx.shadowBlur = 0;
    }
    for (const o of objects) {
      circle(o.x, o.y, o.r, o.kind === "core" ? "#d9edf5" : "#aab7c5", "#e7f8ff", 2); circle(o.x - 7, o.y - 7, 5, "#fff"); circle(o.x + 6, o.y + 6, 3, "#657b91");
    }
    for (const s of shards) if (!s.got) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(frame * .025);
      ctx.shadowColor = "#67f4ff"; ctx.shadowBlur = 18; ctx.fillStyle = "#eaffff";
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    }
    if (level.artifact && !level.artifact.collected) { ctx.shadowColor = "#f5bd63"; ctx.shadowBlur = 20; circle(level.artifact.x, level.artifact.y, 10, "#ffda77", "#fff4c1"); ctx.shadowBlur = 0; }
    if (level.rescue && !level.rescue.rescued) { circle(level.rescue.x, level.rescue.y, 15, "#4cdddc", "#d3ffff"); circle(level.rescue.x, level.rescue.y - 22, 7, "#b5ffff"); }
    const unlocked = objectiveUnlocked();
    circle(level.goal.x, level.goal.y, level.goal.r, unlocked ? "#123a42" : "#202a38", unlocked ? "#62f4ff" : "#73849a", 4);
    ctx.strokeStyle = unlocked ? "#62f4ff" : "#74869b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(level.goal.x, level.goal.y, level.goal.r - 9, frame * .02, frame * .02 + Math.PI * 1.55); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px Arial"; ctx.textAlign = "center"; ctx.fillText(unlocked ? "OPEN" : "LOCKED", level.goal.x, level.goal.y + 4);
  }
  function drawHero() {
    const x = hero.x, y = hero.y, orange = "#ff842e", step = Math.sin(hero.anim) * (Math.abs(hero.vx) > 18 ? 6 : 1);
    if (hero.invulnerable > 0 && Math.floor(frame / 5) % 2 === 0) ctx.globalAlpha = .35;
    circle(x, y - 14, 8, "#05070d", orange, 3); line(x, y - 5, x, y + 13, orange, 3);
    line(x, y, x - 11, y + 8, orange, 3); line(x, y, x + 11, y + 8, orange, 3);
    line(x, y + 13, x - 7 + step, y + 27, orange, 3); line(x, y + 13, x + 7 - step, y + 27, orange, 3);
    ctx.globalAlpha = 1;
  }
  function drawEventEffects() {
    for (const e of events) {
      if (!e.triggered || e.timer <= 0) continue;
      if (e.kind === "falling-tree") {
        ctx.save(); ctx.translate(e.x, level.groundY - 5); ctx.rotate(Math.min(1.25, (4.5 - e.timer) * .35));
        line(0, 0, 0, -115, "#9d8a70", 13); line(0, -70, -28, -94, "#819477", 7); line(0, -88, 26, -110, "#819477", 7); ctx.restore();
      } else if (e.kind === "hidden-cave") {
        ctx.shadowColor = level.world.accent; ctx.shadowBlur = 18; circle(e.x, level.groundY - 26, 22, "#0b1420", level.world.accent, 3); ctx.shadowBlur = 0;
      } else if (e.kind === "shadow" || e.kind === "portal-rift") {
        ctx.fillStyle = e.kind === "shadow" ? "#020207bb" : "#8e57ff55";
        ctx.beginPath(); ctx.ellipse(e.x, level.groundY - 48, 16 + Math.sin(frame * .08) * 4, 47, 0, 0, Math.PI * 2); ctx.fill();
        if (e.kind === "portal-rift") { ctx.strokeStyle = "#d5a8ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e.x, level.groundY - 48, 19, 49, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (e.kind === "earthquake") {
        ctx.strokeStyle = "#ffe0a044"; ctx.lineWidth = 2; line(e.x - 45, level.groundY + 22, e.x - 8, level.groundY + 37, ctx.strokeStyle, 2); line(e.x - 8, level.groundY + 37, e.x + 25, level.groundY + 20, ctx.strokeStyle, 2);
      }
    }
  }
  function drawParticles() {
    for (const p of particles) {
      if (p.kind === "meteor" || p.kind === "shock") {
        line(p.x, p.y, p.x - p.vx * .12, p.y - p.vy * .12, p.kind === "meteor" ? "#ffb35c" : "#ff547a", 4);
        circle(p.x, p.y, p.kind === "meteor" ? 7 : 5, p.kind === "meteor" ? "#ffe2a6" : "#ff547a");
      }
    }
  }
  function drawWeather() {
    const weather = level.weather;
    if (weather === "rain" || weather === "thunderstorm") {
      ctx.strokeStyle = "#b8e5ff77"; ctx.lineWidth = 1;
      for (let i = 0; i < 100; i++) { const x = (i * 43 + frame * 8) % viewW, y = (i * 79 + frame * 13) % 500; line(x, y, x - 6, y + 13, "#b8e5ff77", 1); }
    } else if (weather === "snow" || weather === "blizzard") {
      for (let i = 0; i < 55; i++) { const x = (i * 61 + Math.sin(frame * .01 + i) * 20) % viewW, y = (i * 37 + frame * (weather === "blizzard" ? 2.6 : 1.1)) % 500; circle(x, y, i % 5 === 0 ? 2.5 : 1.5, "#effaffbb"); }
    } else if (weather === "sandstorm" || weather === "ashfall") {
      ctx.fillStyle = weather === "sandstorm" ? "#cda06a22" : "#b9aeb222"; ctx.fillRect(0, 0, viewW, 500);
      for (let i = 0; i < 75; i++) { const x = (i * 57 + frame * 4) % viewW, y = (i * 41 + frame * 1.1) % 500; circle(x, y, 1.5, "#f5d4a088"); }
    } else if (weather === "fog" || weather === "alien-mist") {
      ctx.fillStyle = weather === "fog" ? "#c5d1d91e" : "#9d6dff22"; ctx.fillRect(0, 230 + Math.sin(frame * .01) * 16, viewW, 240);
    }
    if (weather === "thunderstorm" && frame % 470 < 4) { ctx.fillStyle = "#e9f6ff77"; ctx.fillRect(0, 0, viewW, 500); }
    if (["night", "moonlit"].includes(level.timeOfDay) || weather === "fog") {
      const vignette = ctx.createRadialGradient(viewW * .5, 240, 80, viewW * .5, 240, Math.max(viewW, 560));
      vignette.addColorStop(0, "#00000000"); vignette.addColorStop(1, "#00081488"); ctx.fillStyle = vignette; ctx.fillRect(0, 0, viewW, 500);
    }
  }
  function draw() {
    if (!level) { ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, viewW, 500); return; }
    ctx.clearRect(0, 0, viewW, 500);
    drawBackground();
    ctx.save();
    if (shake > 0) ctx.translate((Math.sin(frame * 2.4) * shake) / 2, (Math.cos(frame * 1.8) * shake) / 2);
    ctx.translate(-camera, 0);
    drawGround();
    for (const p of plants) drawPlant(p);
    drawPlatforms(); drawHazards(); drawItems(); drawEnemies(); drawBoss(); drawEventEffects(); drawParticles(); drawHero();
    ctx.restore();
    drawWeather();
    ctx.fillStyle = "#e8f3ffcc"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "left";
    ctx.fillText(level.type + " · " + level.generation.algorithm.toUpperCase(), 13, 18);
    ctx.textAlign = "right"; ctx.fillStyle = "#ffffffaa";
    ctx.fillText("WORLD " + (LevelCore.WORLDS.findIndex(w => w.id === level.world.id) + 1) + "/" + LevelCore.WORLDS.length, viewW - 13, 18);
    if (level.boss && !level.boss.defeated) {
      rounded(viewW / 2 - 80, 28, 160, 8, 4, "#101522");
      rounded(viewW / 2 - 80, 28, 160 * (level.boss.hp / level.boss.maxHp), 8, 4, "#ff596b");
    }
    if (paused) { ctx.fillStyle = "#0008"; ctx.fillRect(0, 0, viewW, 500); }
  }

  function loop(time) {
    const dt = Math.min(.05, (time - (lastTime || time)) / 1000 || 0);
    lastTime = time;
    accumulator += dt;
    const step = 1 / 60;
    let steps = 0;
    while (accumulator >= step && steps < 4) { update(step); accumulator -= step; steps++; }
    if (steps === 4) accumulator = 0;
    draw();
    requestAnimationFrame(loop);
  }

  // The initial screen is available even before the player starts the game.
  $("continueBtn").style.display = safeGet(STORAGE.current) ? "inline-block" : "none";
  level = null;
  resize();
  requestAnimationFrame(loop);
})();
