// Runs the actual disclosure effect with controller/graph doubles, not a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const boundary = source.indexOf('// Presentation only: React owns hidden forever.');
const start = source.indexOf('ctx.effect(function () {', boundary);
const label = '}, "fan-de-hai: disclosure-motion");';
const end = source.indexOf(label, start) + label.length;
assert.ok(boundary >= 0 && start > boundary && end > start);
const results = [];
function check(name, run) { run(); results.push(name); }
function fixture(initial = false) {
  const calls = { animations: [], writes: [], reads: 0, queries: new Map() };
  class Element {
    constructor(attributes = {}) { this.nodeType = 1; this.attrs = new Map(Object.entries(attributes)); this.children = []; this.parentElement = null; this.listeners = new Map(); this.styles = new Map(); }
    get id() { return this.attrs.get('id'); }
    get isConnected() { let top = this; while (top.parentElement) top = top.parentElement; return top.connected === true; }
    matches(selector) { return selector.split(',').some(part => { const m = part.trim().match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/); return m && this.attrs.has(m[1]) && (m[2] === undefined || this.attrs.get(m[1]) === m[2]); }); }
    closest(selector) { for (let el = this; el; el = el.parentElement) if (el.matches(selector)) return el; return null; }
    contains(other) { for (let el = other; el; el = el.parentElement) if (el === this) return true; return false; }
    querySelectorAll(selector) { calls.queries.set(this, (calls.queries.get(this) ?? 0) + 1); const found = []; const visit = node => { for (const child of node.children) { if (child.matches(selector)) found.push(child); visit(child); } }; visit(this); return found; }
    querySelector(selector) { assert.equal(selector, 'button[aria-controls]'); const queue = [...this.children]; while (queue.length) { const el = queue.shift(); if (el.attrs.has('aria-controls')) return el; queue.push(...el.children); } return null; }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    hasAttribute(name) { return this.attrs.has(name); }
    getBoundingClientRect() { calls.reads++; return { height: 240 }; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    removeEventListener(name, listener) { assert.equal(this.listeners.get(name), listener); this.listeners.delete(name); }
    animate(frames, options) { const entry = { el: this, frames, options, cancelled: false }; const animation = { finished: new Promise(() => {}), cancel() { entry.cancelled = true; } }; entry.animation = animation; calls.animations.push(entry); return animation; }
  }
  function append(parent, child) { if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1); parent.children.push(child); child.parentElement = parent; return child; }
  const page = new Element(); page.connected = true;
  const flow = append(page, new Element({ 'data-slot': 'conversation.chat.flow' }));
  let serial = 0;
  function group(parent = flow) { const root = append(parent, new Element({ 'data-step-process': '' })); const id = `body-${++serial}`; const button = append(root, new Element({ 'aria-controls': id })); const body = append(root, new Element({ 'data-step-process-body': '', id })); return { root, button, body }; }
  const existing = initial ? group() : null;
  const observers = [], media = { matches: false, listeners: new Map(), addEventListener(name, fn) { this.listeners.set(name, fn); }, removeEventListener(name, fn) { assert.equal(this.listeners.get(name), fn); this.listeners.delete(name); } };
  let dispose, detach;
  const context = vm.createContext({
    ctx: { effect(fn, name) { assert.equal(name, 'fan-de-hai: disclosure-motion'); dispose = fn(); } },
    matchMedia: () => media, document: { body: {} },
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe(target) { this.target = target; } disconnect() { this.disconnected = true; } },
    watchRoots(_selector, attach) { detach = attach(flow); return () => detach(); },
    ownStyles(el) { const prior = new Map(el.styles); return { set(name, value, priority) { calls.writes.push({ el, name, value, priority }); el.styles.set(name, value); }, restore() { el.styles = new Map(prior); } }; },
    getComputedStyle() { calls.reads++; return { display: 'block', opacity: '1', boxSizing: 'border-box', paddingTop: '0', paddingBottom: '0', borderTopWidth: '0', borderBottomWidth: '0' }; },
  });
  vm.runInContext(source.slice(start, end), context, { timeout: 1000 });
  calls.queries.clear();
  function child(target, ...addedNodes) { return { type: 'childList', target, addedNodes }; }
  function hidden(el, next) { const oldValue = el.getAttribute('hidden'); if (next === null) el.attrs.delete('hidden'); else el.attrs.set('hidden', next); return { type: 'attributes', attributeName: 'hidden', target: el, oldValue }; }
  const deliver = records => observers[0].callback(records);
  return { calls, flow, group, existing, Element, append, child, hidden, deliver, observers, media, dispose: () => dispose() };
}
function noMotion(h) { assert.equal(h.calls.animations.length, 0); assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.reads, 0); }
check('new group initial hidden commit never exposes or measures its body', () => {
  const h = fixture(), g = h.group();
  h.deliver([h.child(h.flow, g.root), h.hidden(g.body, 'until-found')]);
  noMotion(h); assert.equal(g.body.getAttribute('hidden'), 'until-found'); h.dispose();
});
check('initial hidden records are recognized even before the insertion record', () => {
  const h = fixture(), g = h.group();
  h.deliver([h.hidden(g.body, 'until-found'), h.child(h.flow, g.root)]);
  noMotion(h); h.dispose();
});
check('a new body mounted under an existing group retains its initial hidden state', () => {
  const h = fixture(true), g = h.existing, previous = g.body;
  g.root.children.splice(g.root.children.indexOf(previous), 1); previous.parentElement = null;
  const body = h.append(g.root, new h.Element({ 'data-step-process-body': '', id: previous.id }));
  h.deliver([h.child(g.root, body), h.hidden(body, 'until-found')]);
  noMotion(h); h.dispose();
});
check('new outer group and nested body initial hides both remain native', () => {
  const h = fixture(), g = h.group();
  h.deliver([h.child(h.flow, g.root), h.hidden(g.root, 'until-found'), h.hidden(g.body, 'until-found')]);
  noMotion(h); h.dispose();
});
check('nested additions scan only the outer added subtree once', () => {
  const h = fixture(), wrapper = h.append(h.flow, new h.Element()), g = h.group(wrapper);
  h.deliver([h.child(h.flow, wrapper), h.child(wrapper, g.root), h.child(g.root, g.body), h.hidden(g.body, 'until-found')]);
  noMotion(h); assert.equal(h.calls.queries.get(wrapper), 1); assert.equal(h.calls.queries.has(g.root), false); h.dispose();
});
check('an added group with no hide still animates its first later fold', () => {
  const h = fixture(), g = h.group(); h.deliver([h.child(h.flow, g.root)]);
  h.deliver([h.hidden(g.body, 'until-found')]);
  assert.equal(h.calls.animations.length, 1); assert.equal(h.calls.animations[0].options.duration, 180);
  assert.equal(g.body.getAttribute('hidden'), 'until-found'); h.dispose();
});
check('initial hide suppression does not consume the next real reveal or fold', () => {
  const h = fixture(), g = h.group(); h.deliver([h.child(h.flow, g.root), h.hidden(g.body, 'until-found')]);
  h.deliver([h.hidden(g.body, null)]); assert.equal(h.calls.animations.length, 1);
  h.deliver([h.hidden(g.body, 'until-found')]); assert.equal(h.calls.animations.length, 2); h.dispose();
});
check('groups present when the observer binds retain their first fold', () => {
  const h = fixture(true); h.deliver([h.hidden(h.existing.body, 'until-found')]);
  assert.equal(h.calls.animations.length, 1); h.dispose();
});
check('moving an existing group does not classify it as newly mounted', () => {
  const h = fixture(true), wrapper = h.append(h.flow, new h.Element()); h.append(wrapper, h.existing.root);
  h.deliver([h.child(h.flow, wrapper), h.child(wrapper, h.existing.root), h.hidden(h.existing.body, 'until-found')]);
  assert.equal(h.calls.animations.length, 1); h.dispose();
});
check('a real existing fold in the same batch as a new initial hide is retained', () => {
  const h = fixture(true), g = h.group();
  h.deliver([h.child(h.flow, g.root), h.hidden(g.body, 'until-found'), h.hidden(h.existing.body, 'until-found')]);
  assert.equal(h.calls.animations.length, 1); assert.equal(h.calls.animations[0].el, h.existing.body); h.dispose();
});
check('a newly mounted initially visible group does not acquire styles', () => {
  const h = fixture(), g = h.group(); h.deliver([h.child(h.flow, g.root)]); noMotion(h); h.dispose();
});
check('text and removed-subtree additions are not scanned', () => {
  const h = fixture(), g = h.group(); g.root.parentElement = null; h.flow.children = [];
  h.deliver([h.child(h.flow, { nodeType: 3 }, g.root), h.hidden(g.body, 'until-found')]);
  noMotion(h); assert.equal(h.calls.queries.size, 0); h.dispose();
});
check('non-group turn members keep the existing motion path', () => {
  const h = fixture(), el = h.append(h.flow, new h.Element({ 'data-turn-process-member': '' }));
  h.deliver([h.child(h.flow, el), h.hidden(el, 'until-found')]); assert.equal(h.calls.animations.length, 1); h.dispose();
});
for (const event of ['beforematch', 'focusin']) check(`${event} reveal remains immediate`, () => {
  const h = fixture(true), el = h.existing.body; el.attrs.set('hidden', 'until-found');
  h.flow.listeners.get(event)({ target: el }); h.deliver([h.hidden(el, null)]); noMotion(h); h.dispose();
});
check('native motion scope, reduced motion and plain hidden keep their guards', () => {
  for (const mode of ['native', 'reduced', 'plain']) {
    const h = fixture(true); if (mode === 'native') h.flow.attrs.set('data-chat-motion', ''); if (mode === 'reduced') h.media.matches = true;
    h.deliver([h.hidden(h.existing.body, mode === 'plain' ? '' : 'until-found')]); noMotion(h); h.dispose();
  }
});
check('nested closing parents still own the only animation', () => {
  const h = fixture(true); h.deliver([h.hidden(h.existing.root, 'until-found'), h.hidden(h.existing.body, 'until-found')]);
  assert.equal(h.calls.animations.length, 1); assert.equal(h.calls.animations[0].el, h.existing.root); h.dispose();
});
check('native takeover cancels and restores a running plugin animation', () => {
  const h = fixture(true), el = h.existing.body; el.styles.set('overflow-x', 'clip'); h.deliver([h.hidden(el, 'until-found')]);
  h.flow.attrs.set('data-chat-motion', ''); h.observers[1].callback();
  assert.ok(h.calls.animations[0].cancelled); assert.equal(el.styles.get('overflow-x'), 'clip'); assert.equal(el.styles.has('content-visibility'), false); h.dispose();
});
check('disposal cancels styles and releases all observers and listeners', () => {
  const h = fixture(true); h.deliver([h.hidden(h.existing.body, 'until-found')]); h.dispose();
  assert.ok(h.calls.animations[0].cancelled); assert.equal(h.existing.body.styles.size, 0);
  assert.ok(h.observers.every(o => o.disconnected)); assert.equal(h.flow.listeners.size, 0); assert.equal(h.media.listeners.size, 0);
});
console.log(JSON.stringify({ passed: results.length, checks: results,
  scope: 'actual source effect with synthetic mutation batches and graph/controller doubles only; no real DOM, first-paint, VIS/FLOW, persistence or latency proof' }, null, 2));
