const assert = require('node:assert/strict');
const Core = require('../js/level-core.js');

assert.ok(Array.isArray(Core.TYPES), 'puzzle family registry exists');
assert.ok(Array.isArray(Core.WORLDS) && Core.WORLDS.length >= 12, 'world registry includes at least twelve worlds');

// Determinism: identical level number and seed produce identical geometry.
for (let n = 1; n <= 120; n++) {
  const a = Core.makeLevel(n);
  const b = Core.makeLevel(n);
  assert.equal(a.number, n);
  assert.equal(Core.fingerprint(a), Core.fingerprint(b));
  assert.ok(Core.TYPES.includes(a.type));
  assert.ok(Core.WORLDS.some(w => w.id === a.world.id));
  assert.ok(a.width >= 2000 && a.width <= 3600);
  assert.ok(a.goal.x < a.width && a.goal.x > a.hero.x);
  assert.ok(Core.validateLevel(a).valid, `level ${n} should pass validation: ${Core.validateLevel(a).errors.join(', ')}`);
  assert.ok(Array.isArray(a.platforms) && Array.isArray(a.enemies));
  assert.ok(Array.isArray(a.plants) && Array.isArray(a.events));
  assert.ok(a.weather && a.objective && a.difficulty >= 1);
}

// The initial rotation exposes every original puzzle family.
assert.equal(new Set(Array.from({ length: 6 }, (_, i) => Core.makeLevel(i + 1).type)).size, 6);

// Consecutive worlds must differ and the environment set must be varied.
const worlds = Array.from({ length: 60 }, (_, i) => Core.makeLevel(i + 1).world.id);
for (let i = 1; i < worlds.length; i++) assert.notEqual(worlds[i], worlds[i - 1]);
assert.ok(new Set(worlds).size >= 8);

// Difficulty increases in bands and never drops as level number rises.
let previous = 0;
for (let n = 1; n <= 600; n++) {
  const d = Core.getDifficulty(n);
  assert.ok(d >= previous, `difficulty dropped at level ${n}`);
  previous = d;
}
assert.ok(Core.getDifficulty(501) > Core.getDifficulty(10));

// Local-history duplicate rejection changes candidate seed and keeps history.
const first = Core.generateUniqueLevel(1, []);
const second = Core.generateUniqueLevel(1, [first]);
assert.notEqual(first.fingerprint, second.fingerprint);
assert.ok(second.attempt > 0);
assert.notEqual(first.similarity, second.similarity);
assert.ok(Core.validateLevel(second).valid);

// Generator must reject structurally invalid levels.
const broken = Core.makeLevel(4);
broken.goal = null;
assert.equal(Core.validateLevel(broken).valid, false);

console.log('PASS: 120 deterministic validated levels, world variety, monotonic difficulty, and duplicate avoidance');
