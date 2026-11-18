// Actual source functions with graph/service/event doubles; not browser evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
function extract(start, end) { assert.equal(source.split(start).length, 2); const at = source.indexOf(start), to = source.indexOf(end, at + start.length); assert.ok(to > at); return source.slice(at, to); }
const attrs = extract('function ownAttrs(el)', '// A selected, installed CSS Module');
const helper = extract('function railUnpinMenu(menus)', 'function apply(ctx)');
const sync = extract('function syncUnpinMenus(unpins)', 'function syncControls()');
const results = [];
function check(name, run) { run(); results.push(name); }
function fixture() {
  const calls = { open: [], close: 0, unregister: 0, focus: [], clicks: [], reads: 0 };
  class Element {
    constructor(label) { this.attrs = new Map(label ? [['aria-label', label]] : []); this.listeners = new Map(); this.children = []; this.parentElement = null; this.isConnected = true; this.disabled = false; }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    setAttribute(key, value) { this.attrs.set(key, value); }
    removeAttribute(key) { this.attrs.delete(key); }
    contains(other) { for (let el = other; el; el = el.parentElement) if (el === this) return true; return false; }
    closest(selector) { assert.equal(selector, '[data-fan-rail-entry]'); return this.parentElement; }
    querySelector(selector) { if (selector === 'button[aria-haspopup="menu"]') return this.more ?? null; assert.equal(selector, 'button[data-fan-rail-button]'); return this.primary; }
    addEventListener(key, fn) { assert.equal(this.listeners.has(key), false, 'no duplicate listener'); this.listeners.set(key, fn); }
    removeEventListener(key, fn) { assert.equal(this.listeners.get(key), fn); this.listeners.delete(key); }
    getBoundingClientRect() { calls.reads++; return { left: 12, bottom: 48 }; }
    focus(options) { calls.focus.push({ el: this, options }); }
    click() { calls.clicks.push(this); }
  }
  const nav = new Element(); nav.more = new Element(); nav.more.attrs.set('aria-haspopup', 'menu');
  function row(label = '取消固定') { const entry = new Element(), primary = new Element('Panel'), unpin = new Element(label); entry.parentElement = nav; entry.children = [primary, unpin]; entry.primary = primary; primary.parentElement = unpin.parentElement = entry; nav.children.push(entry); return { entry, primary, unpin }; }
  const first = row(), second = row(); let active = null, provider;
  const menus = { active: { getSnapshot: () => active }, register(value) { provider = value; return () => calls.unregister++; }, open(target, point) { active = target; calls.open.push({ target, point }); }, close() { active = null; calls.close++; } };
  const context = vm.createContext({}); vm.runInContext(attrs + '\n' + helper + '\nglobalThis.make = railUnpinMenu;', context);
  const owner = context.make(menus);
  function bind(record = first) { return owner.bind(record.primary, record.unpin, record.entry, nav); }
  function event(record = first, type = 'contextmenu', patch = {}) { const e = { clientX: 20, clientY: 33, defaultPrevented: false, prevented: 0, stopped: 0, preventDefault() { this.defaultPrevented = true; this.prevented++; }, stopPropagation() { this.stopped++; }, ...patch }; record.primary.listeners.get(type)?.(e); return e; }
  return { calls, nav, first, second, owner, provider, bind, event, active: () => active, setActive: value => { active = value; }, resolve: target => provider.resolve(target.value), context };
}
function opened(h) { return h.calls.open.at(-1).target; }
check('right-click captures a JSON-only target and opens the native menu', () => {
  const h = fixture(), binding = h.bind(), e = h.event();
  assert.equal(h.calls.open.length, 1); assert.equal(e.prevented, 1); assert.equal(e.stopped, 1);
  assert.equal(JSON.stringify(opened(h)), '{"kind":"fanframe-sidebar-unpin","value":{"id":"1"}}');
  assert.deepEqual({ ...h.calls.open[0].point }, { x: 20, y: 33 }); assert.equal(h.calls.reads, 0);
  assert.equal(h.calls.focus[0].options.preventScroll, true); assert.equal(h.calls.clicks.length, 0); binding.dispose(); h.owner.dispose();
});
// The host registry owns selection/disposal; an already-selected callback retains its target.
check('a selected callback keeps its captured row when native active state changes', () => {
  const h = fixture(); h.bind(); h.bind(h.second); h.event(); const action = h.resolve(opened(h))[0];
  h.event(h.second); action.run(); assert.deepEqual(h.calls.clicks, [h.first.unpin]); h.owner.dispose();
});
check('normal selection still runs after the host clears its active target', () => {
  const h = fixture(); h.bind(); h.event(); const action = h.resolve(opened(h))[0];
  h.setActive(null); action.run(); assert.deepEqual(h.calls.clicks, [h.first.unpin]); h.owner.dispose();
});
check('menu label comes from the current native localized unpin button', () => {
  const h = fixture(), binding = h.bind(); h.event(); assert.equal(h.resolve(opened(h))[0].label, '取消固定');
  const live = h.provider.observe({})[0]; let updates = 0; const off = live.subscribe(() => updates++);
  binding.refresh(); assert.equal(updates, 0);
  h.first.unpin.setAttribute('aria-label', 'Unpin'); binding.refresh(); assert.equal(updates, 1);
  assert.equal(h.resolve(opened(h))[0].label, 'Unpin'); off(); h.owner.dispose();
});
for (const patch of [{ key: 'ContextMenu' }, { key: 'F10', shiftKey: true }]) check(`keyboard ${patch.key} anchors below the original icon`, () => {
  const h = fixture(); h.bind(); const e = h.event(h.first, 'keydown', patch);
  assert.equal(e.prevented, 1); assert.equal(h.calls.open.length, 1); assert.deepEqual({ ...h.calls.open[0].point }, { x: 12, y: 48 }); h.owner.dispose();
});
check('unrelated, modified, repeated and composing keys retain their owner', () => {
  const h = fixture(); h.bind();
  for (const patch of [{ key: 'Enter' }, { key: 'F10' }, ...['ctrlKey', 'altKey', 'metaKey', 'repeat', 'isComposing'].map(key => ({ key: 'ContextMenu', [key]: true }))]) {
    const e = h.event(h.first, 'keydown', patch); assert.equal(e.prevented, 0);
  }
  assert.equal(h.calls.open.length, 0); h.owner.dispose();
});
check('already claimed context and keyboard events are not stolen', () => {
  const h = fixture(); h.bind();
  for (const type of ['contextmenu', 'keydown']) { const e = h.event(h.first, type, { defaultPrevented: true, key: 'ContextMenu' }); assert.equal(e.prevented, 0); assert.equal(e.stopped, 0); }
  assert.equal(h.calls.open.length, 0); h.owner.dispose();
});
check('zero-position context gestures use the native trigger edge', () => {
  const h = fixture(); h.bind(); h.event(h.first, 'contextmenu', { clientX: 0, clientY: 0 });
  assert.deepEqual({ ...h.calls.open[0].point }, { x: 12, y: 48 }); h.owner.dispose();
});
check('only a successful binding hides the accessory via its entry marker', () => {
  const h = fixture(), original = [...h.first.entry.children]; h.bind();
  assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), '');
  assert.deepEqual(h.first.entry.children, original); assert.equal(h.first.primary.getAttribute('aria-haspopup'), null, 'native More lookup must not be hijacked');
  assert.equal(h.first.primary.listeners.has('click'), false); assert.equal(h.first.unpin.listeners.size, 0); h.owner.dispose();
});
check('unavailable native actions keep the original accessory without listeners', () => {
  for (const mode of ['label', 'more', 'disabled']) {
    const h = fixture(); if (mode === 'label') h.first.unpin.removeAttribute('aria-label'); if (mode === 'more') h.nav.more = null; if (mode === 'disabled') h.first.unpin.disabled = true;
    assert.equal(h.bind(), null); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), null); assert.equal(h.first.primary.listeners.size, 0); h.owner.dispose();
  }
});
for (const mode of ['disconnect', 'reparent', 'disabled', 'aria-disabled', 'missing-more']) check(`selected actions recheck ${mode} instead of unpinning a stale row`, () => {
  const h = fixture(), binding = h.bind(); h.event(); const action = h.resolve(opened(h))[0];
  if (mode === 'disconnect') h.first.unpin.isConnected = false;
  if (mode === 'reparent') h.first.entry.parentElement = {};
  if (mode === 'disabled') h.first.unpin.disabled = true;
  if (mode === 'aria-disabled') h.first.primary.setAttribute('aria-disabled', 'true');
  if (mode === 'missing-more') h.nav.more = null;
  action.run(); assert.equal(h.calls.clicks.length, 0); binding.refresh(); assert.equal(h.calls.close, 1); h.owner.dispose();
});
check('removed bindings cannot run a previously resolved action', () => {
  const h = fixture(), binding = h.bind(); h.event(); const action = h.resolve(opened(h))[0]; binding.dispose(); action.run();
  assert.equal(h.calls.clicks.length, 0); assert.equal(h.first.primary.listeners.size, 0); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), null); h.owner.dispose();
});
check('cleanup never closes another target and preserves external marker changes', () => {
  const h = fixture(), binding = h.bind(); h.setActive({ kind: 'session', value: { sessionId: 'unrelated' } });
  h.first.entry.setAttribute('data-fan-rail-context-menu', 'changed-elsewhere'); binding.dispose();
  assert.equal(h.calls.close, 0); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), 'changed-elsewhere'); h.owner.dispose();
});
check('owner disposal unregisters once and releases each button listener', () => {
  const h = fixture(); h.bind(); h.bind(h.second); h.event(); h.owner.dispose(); h.owner.dispose();
  assert.equal(h.calls.unregister, 1); assert.equal(h.calls.close, 1); assert.equal(h.first.primary.listeners.size, 0); assert.equal(h.second.primary.listeners.size, 0);
  assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), null);
});
function controller(h) {
  const railMenuState = { current: null }, unpinMenus = new Map(), buttons = new Map([[h.first.primary, {}]]);
  Object.assign(h.context, { railMenuState, unpinMenus, buttons, nav: h.nav });
  vm.runInContext(sync + '\nglobalThis.syncMenus = syncUnpinMenus;', h.context);
  return { railMenuState, unpinMenus, sync: () => h.context.syncMenus(new Set([h.first.unpin])) };
}
check('sidebar integration retains the native button until a service is ready', () => {
  const h = fixture(), c = controller(h); c.sync(); assert.equal(c.unpinMenus.size, 0); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), null);
  c.railMenuState.current = h.owner; c.sync(); assert.equal(c.unpinMenus.size, 1); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), '');
  c.sync(); assert.equal(h.first.primary.listeners.size, 2, 'sync is idempotent'); h.owner.dispose();
});
check('service withdrawal restores the accessory and removes stale integration records', () => {
  const h = fixture(), c = controller(h); c.railMenuState.current = h.owner; c.sync(); h.event(); c.railMenuState.current = null; c.sync();
  assert.equal(c.unpinMenus.size, 0); assert.equal(h.first.primary.listeners.size, 0); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), null); assert.equal(h.calls.close, 1); h.owner.dispose();
});
check('missing native labels restore the accessory until a valid binding returns', () => {
  const h = fixture(), c = controller(h); c.railMenuState.current = h.owner; c.sync();
  h.first.unpin.removeAttribute('aria-label'); c.sync();
  assert.equal(c.unpinMenus.size, 0); assert.equal(h.first.entry.getAttribute('data-fan-rail-context-menu'), null);
  h.first.unpin.setAttribute('aria-label', 'Unpin'); c.sync(); assert.equal(c.unpinMenus.size, 1); h.owner.dispose();
});
check('disposed event callbacks cannot reopen a stale target', () => {
  const h = fixture(), binding = h.bind(), callback = h.first.primary.listeners.get('contextmenu'); binding.dispose();
  callback({ defaultPrevented: false }); assert.equal(h.calls.open.length, 0); h.owner.dispose();
});
check('reactive notification snapshots subscribers before they replace themselves', () => {
  const h = fixture(), binding = h.bind(), live = h.provider.observe({})[0]; let late = 0;
  const off = live.subscribe(() => { off(); live.subscribe(() => late++); });
  h.first.unpin.setAttribute('aria-label', 'Unpin'); binding.refresh(); assert.equal(late, 0);
  h.first.unpin.setAttribute('aria-label', '取消固定'); binding.refresh(); assert.equal(late, 1); h.owner.dispose();
});
check('CSS removes only the ready entries accessory and its independent row', () => {
  assert.match(source, /\[data-fan-rail-entry\]\[data-fan-rail-context-menu\] \{ min-height:36px; gap:0 !important; \}/);
  assert.match(source, /\[data-fan-rail-entry\]\[data-fan-rail-context-menu\] \[data-fan-rail-unpin\] \{ display:none !important; \}/);
  assert.match(source, /ctx\.inject\(\['contextMenus'\]/);
});
console.log(JSON.stringify({ passed: results.length, checks: results,
  scope: 'source functions with graph/service/event doubles only; no native React event, popup keyboard/focus, screenshots, persistence or actual pin-state verification' }, null, 2));
