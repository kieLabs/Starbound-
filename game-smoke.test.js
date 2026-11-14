const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../js/level-core.js');

class FakeElement {
  constructor(id = '') {
    this.id = id; this.textContent = ''; this.innerHTML = ''; this.style = {}; this.dataset = {};
    this.handlers = {}; this.classes = new Set();
    this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) };
  }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  click() { (this.handlers.click || []).forEach(fn => fn({ preventDefault() {} })); }
  querySelector() { return panel; }
  getBoundingClientRect() { return { width: 900, height: 500 }; }
  getContext() { return ctx2d; }
  setPointerCapture() {}
}
const noOp = () => {};
const ctx2d = new Proxy({
  createLinearGradient: () => ({ addColorStop: noOp }),
  createRadialGradient: () => ({ addColorStop: noOp }),
  measureText: () => ({ width: 10 }),
  roundRect: noOp
}, { get(target, key) { return target[key] || noOp; }, set(target, key, value) { target[key] = value; return true; } });
const elements = new Map();
function el(id) { if (!elements.has(id)) elements.set(id, new FakeElement(id)); return elements.get(id); }
const panel = new FakeElement('panel');
el('game').getContext = () => ctx2d;
el('overlay').querySelector = () => panel;
const local = new Map();
const localStorage = { getItem: k => local.has(k) ? local.get(k) : null, setItem: (k,v) => local.set(k, String(v)), removeItem: k => local.delete(k) };
const raf = [], globalHandlers = {};
const document = { getElementById: el, querySelectorAll: () => [], createElement: () => new FakeElement() };
const sandbox = {
  document, localStorage, LevelCore: Core, console, Math, JSON, Map, Set, Object, Number, String, Array,
  window: null, globalThis: null, devicePixelRatio: 1,
  addEventListener: (type, fn) => { (globalHandlers[type] ||= []).push(fn); },
  requestAnimationFrame: fn => { raf.push(fn); return raf.length; },
  setTimeout: () => 1, clearTimeout: noOp,
  ResizeObserver: class { observe() {} },
  confirm: () => true
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(require.resolve('../js/game.js'), 'utf8'), sandbox, { filename: 'game.js' });

assert.equal(raf.length, 1, 'game loop schedules a frame');
el('startBtn').click();
assert.equal(el('levelNo').textContent, '01', 'new journey loads sector one');
assert.ok(el('mission').textContent.length > 0, 'mission text is filled');
assert.ok(el('worldName').textContent.length > 0, 'world label is filled');
assert.equal(el('overlay').classList.contains('hidden'), true, 'launch hides the cover overlay');
assert.ok(local.has('starbound_v3_current'), 'generated level snapshot is stored locally');

// Simulate movement, one interact press, and several animation/update frames.
(globalHandlers.keydown || []).forEach(fn => fn({ key: 'd', repeat: false, preventDefault: noOp }));
let timestamp = 1000;
for (let i = 0; i < 8; i++) { const next = raf.shift(); assert.ok(next); timestamp += 17; next(timestamp); }
(globalHandlers.keyup || []).forEach(fn => fn({ key: 'd', preventDefault: noOp }));
(globalHandlers.keydown || []).forEach(fn => fn({ key: 'e', repeat: false, preventDefault: noOp }));

// Pause/resume buttons must be wired and return to the live game.
el('pauseBtn').click();
assert.equal(el('overlay').classList.contains('hidden'), false, 'pause opens the overlay');
el('resumeBtn').click();
assert.equal(el('overlay').classList.contains('hidden'), true, 'resume closes the overlay');

console.log('PASS: game initializes, starts a journey, persists level data, updates movement, renders, and pauses/resumes');
