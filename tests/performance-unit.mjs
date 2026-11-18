// Pure cache/event/graph tests with small doubles only. No browser/rendering/timing results.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const client = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const marker = '    exports.apply = apply;';
assert.equal(client.split(marker).length, 2, 'one private-helper capture point');
let captured;
vm.runInNewContext(client.replace(marker, `    exports.performanceUnit = {motionIndexCache, snapshotMotionSources, hasExternalMotionMutation, outerCandidates, mayDetachRoots, isEchoTransfer, menuDiscoveryChanged};\n${marker}`), {
  window: { __ModuleLoader__: { load(spec) { captured = spec; } } },
}, { timeout: 3000 });
const { motionIndexCache, snapshotMotionSources, hasExternalMotionMutation, outerCandidates, mayDetachRoots, isEchoTransfer, menuDiscoveryChanged } = captured.factory(() => { throw Error('Unexpected import'); }).performanceUnit;
const results = [];
function check(name, test) { test(); results.push(name); }
const sheet = {}, owner = {};
const source = (patch = {}) => ({ sheet, owner, disabled: false, media: '', plugin: 'native', href: '', ...patch });

check('equal snapshots and sync/queued consumers share one parse', () => {
  let builds = 0;
  const cache = motionIndexCache(() => ({ build: ++builds }));
  const first = cache.read([source()]);
  assert.equal(cache.read([source()]), first);
  cache.invalidate(); cache.invalidate();
  assert.equal(builds, 1, 'invalidations do not eagerly parse');
  const sync = cache.read([source()]);
  assert.notEqual(sync, first);
  assert.equal(cache.read([source()]), sync, 'the queued CSS job reuses the sync result');
  assert.equal(builds, 2);
});
check('an intervening invalidation cannot reuse a synchronous parse', () => {
  let builds = 0;
  const cache = motionIndexCache(() => ++builds);
  cache.read([source()]); cache.invalidate(); cache.read([source()]);
  cache.invalidate(); cache.invalidate();
  assert.equal(cache.read([source()]), 3);
});
check('same sheet count does not hide replacement, order or metadata changes', () => {
  let builds = 0;
  const cache = motionIndexCache(() => ++builds);
  for (const key of ['sheet', 'owner', 'disabled', 'media', 'plugin', 'href']) {
    cache.clear(); cache.read([source()]);
    const before = builds;
    const value = key === 'disabled' ? true : ['sheet', 'owner'].includes(key) ? {} : 'changed';
    cache.read([source({ [key]: value })]);
    assert.equal(builds, before + 1, key);
  }
  const other = source({ sheet: {} });
  cache.read([source(), other]); const before = builds;
  cache.read([other, source()]);
  assert.equal(builds, before + 1, 'cascade order is part of the signature');
});
check('the pointer fast path returns only the current clean generation', () => {
  let builds = 0;
  const cache = motionIndexCache(() => ({ build: ++builds }));
  assert.equal(cache.current(), null);
  const current = cache.read([source()]);
  for (let i = 0; i < 100; i++) assert.equal(cache.current(), current);
  assert.equal(builds, 1);
  cache.invalidate(); assert.equal(cache.current(), null);
  cache.read([source()]); cache.clear(); assert.equal(cache.current(), null);
});
check('clear drops cached sources and value', () => {
  let builds = 0;
  const cache = motionIndexCache(() => ++builds);
  assert.equal(cache.read([]), 1); cache.clear();
  assert.equal(cache.read([]), 2);
});
check('a failed parse is retried, not published as a valid generation', () => {
  let fails = true, builds = 0;
  const cache = motionIndexCache(() => { builds++; if (fails) throw Error('parse failed'); return 'current'; });
  assert.throws(() => cache.read([source()]), /parse failed/);
  fails = false;
  assert.equal(cache.read([source()]), 'current');
  assert.equal(builds, 2);
});
check('invalidation during a build does not mark the newer generation parsed', () => {
  let builds = 0, cache;
  cache = motionIndexCache(() => { if (++builds === 1) cache.invalidate(); return builds; });
  assert.equal(cache.read([source()]), 1);
  assert.equal(cache.read([source()]), 2);
  assert.equal(cache.read([source()]), 2);
});
const own = new Set(['default', 'default-text', 'hover', 'hover-text']);
const owned = node => own.has(node);
const mutation = (added = [], removed = [], target = 'head') => ({ type: 'childList', target, addedNodes: added, removedNodes: removed });
check('both exact owned outputs, their text and removal are ignored', () => {
  assert.equal(hasExternalMotionMutation([mutation(['default', 'hover']), mutation([], ['hover'])], owned), false);
  assert.equal(hasExternalMotionMutation([{ type: 'characterData', target: 'default-text' }, { type: 'attributes', target: 'hover' }], owned), false);
  assert.equal(hasExternalMotionMutation([], owned), false);
});
check('mixed output/input records retain external invalidation', () => {
  assert.equal(hasExternalMotionMutation([mutation(['default', 'external'])], owned), true);
  assert.equal(hasExternalMotionMutation([mutation(['hover']), mutation([], ['external'])], owned), true);
  assert.equal(hasExternalMotionMutation([{ type: 'attributes', target: 'external' }], owned), true);
  assert.equal(hasExternalMotionMutation([{ type: 'characterData', target: 'external-text' }], owned), true);
});
check('an unregistered lookalike is not treated as owned', () => {
  assert.equal(hasExternalMotionMutation([mutation(['data-fan-default-motion'])], owned), true);
});
check('candidate coalescing removes duplicates/descendants without reordering peers', () => {
  const parent = new Map([['leaf', 'branch'], ['branch', 'root'], ['root', 'body'], ['peer', 'body']]);
  const select = nodes => Array.from(outerCandidates(nodes, node => parent.get(node)));
  assert.deepEqual(select(['root', 'branch', 'leaf', 'peer', 'root']), ['root', 'peer']);
  assert.deepEqual(select(['leaf', 'peer', 'root']), ['peer', 'root']);
  assert.deepEqual(select(['branch', 'leaf']), ['branch']);
  assert.deepEqual(select([]), []);
});
check('candidate coalescing handles a large nested mutation batch', () => {
  const parents = new Map(), nodes = [];
  for (let i = 0; i < 500; i++) { nodes.push(i + 1); parents.set(i + 1, i || undefined); }
  assert.deepEqual(Array.from(outerCandidates([...nodes, ...nodes], node => parents.get(node))), [1]);
});
check('text/comment replacement cannot request an Element-root sweep', () => {
  assert.equal(mayDetachRoots([]), false);
  assert.equal(mayDetachRoots([{ nodeType: 3 }, { nodeType: 8 }, { nodeType: 4 }]), false);
});
check('Element/fragment removal still requests disconnected-root cleanup', () => {
  assert.equal(mayDetachRoots([{ nodeType: 1 }]), true);
  assert.equal(mayDetachRoots([{ nodeType: 11 }]), true);
  assert.equal(mayDetachRoots([{ nodeType: 3 }, { nodeType: 1 }]), true);
});
check('ordinary streaming and ambiguous echo batches do not read the user history', () => {
  const user = {}, read = () => { throw Error('unexpected history scan'); };
  for (const [history, added, removed, durable] of [
    [false, 0, 0, []], [true, 0, 1, [user]], [false, 1, 1, [user]],
    [false, 0, 0, [user]], [false, 0, 2, [user]],
    [false, 0, 1, []], [false, 0, 1, [user, {}]],
  ]) assert.equal(isEchoTransfer(history, added, removed, durable, read), false);
});
check('an unambiguous echo replacement reads once and still requires the newest user', () => {
  const user = {}, other = {};
  let reads = 0;
  assert.equal(isEchoTransfer(false, 0, 1, [user], () => { reads++; return [other, user]; }), true);
  assert.equal(reads, 1);
  assert.equal(isEchoTransfer(false, 0, 1, [user], () => { reads++; return [user, other]; }), false);
  assert.equal(reads, 2);
  assert.equal(isEchoTransfer(false, 0, 1, [user], () => []), false);
  assert.throws(() => isEchoTransfer(false, 0, 1, [user], () => { throw Error('query failed'); }), /query failed/);
});
// Single-class selector/tree doubles for this private discovery predicate only.
function graphNode(classes = '', parent = null) {
  const node = {
    nodeType: 1, classes: classes.split(/\s+/), parentNode: parent, children: [], queries: 0, closestCalls: 0, isConnected: true,
    classList: { contains(name) { return node.classes.includes(name); } },
    matches(selector) { assert.equal(selector[0], '.'); return this.classes.includes(selector.slice(1)); },
    closest(selector) { this.closestCalls++; for (let p = this; p; p = p.parentNode) if (p.matches(selector)) return p; return null; },
    contains(other) { for (let p = other; p; p = p.parentNode) if (p === this) return true; return false; },
    querySelector(selector) {
      this.queries++;
      const visit = root => { for (const child of root.children) { if (child.matches(selector)) return child; const found = visit(child); if (found) return found; } return null; };
      return visit(this);
    },
  };
  parent?.children.push(node);
  return node;
}
const picker = { menu: '.menu', cell: '.cell', trigger: '.trigger' };
const change = (target, addedNodes = []) => ({ type: 'childList', target, addedNodes });
const identity = (target, attributeName, oldValue = null) => ({ type: 'attributes', target, attributeName, oldValue });
check('unrelated chat text/elements do not request a full menu scan', () => {
  const body = graphNode(), unrelated = graphNode('paragraph', body);
  assert.equal(menuDiscoveryChanged([change(unrelated, [{ nodeType: 3 }])], picker, null, null), false);
  assert.equal(body.queries, 0); assert.equal(unrelated.queries, 0);
  assert.equal(menuDiscoveryChanged([change(body, [unrelated])], picker, null, null), false);
  assert.equal(body.queries, 0, 'only the added subtree may be searched');
});
check('new/nested menus and later native cells still request discovery', () => {
  const body = graphNode(), wrapper = graphNode('wrapper', body), menu = graphNode('menu', wrapper), cell = graphNode('cell', menu);
  assert.equal(menuDiscoveryChanged([change(body, [menu])], picker, null, null), true);
  assert.equal(menuDiscoveryChanged([change(body, [wrapper])], picker, null, null), true);
  assert.equal(menuDiscoveryChanged([change(menu, [cell])], picker, null, null), true);
  assert.equal(menuDiscoveryChanged([change(cell, [{ nodeType: 3 }])], picker, null, null), true);
});
check('owned panel text stays local while owned detachment still requests cleanup', () => {
  const menu = graphNode('menu'), container = graphNode('panel', menu), value = graphNode('value', container);
  const owned = { menu, container };
  assert.equal(menuDiscoveryChanged([change(value, [{ nodeType: 3 }])], picker, owned, null), false);
  assert.equal(menuDiscoveryChanged([identity(value, 'class', 'value')], picker, owned, null), false);
  container.parentNode = null;
  assert.equal(menuDiscoveryChanged([], picker, owned, null), true);
  container.parentNode = menu; menu.isConnected = false;
  assert.equal(menuDiscoveryChanged([], picker, owned, null), true);
});
check('menu/cell class and menu id changes explicitly replace accidental retries', () => {
  const menu = graphNode('menu'), cell = graphNode('cell', menu);
  assert.equal(menuDiscoveryChanged([identity(menu, 'id')], picker, null, null), true);
  assert.equal(menuDiscoveryChanged([identity(menu, 'class', '')], picker, null, null), true);
  assert.equal(menuDiscoveryChanged([identity(cell, 'class', '')], picker, null, null), true);
  menu.classes = [];
  assert.equal(menuDiscoveryChanged([identity(menu, 'class', 'menu')], picker, null, null), true);
  assert.equal(menuDiscoveryChanged([identity(graphNode('dark'), 'class', 'light')], picker, null, null), false);
});
check('anchor ownership identities and moved trigger trees still request discovery', () => {
  const body = graphNode(), wrapper = graphNode('wrapper', body), trigger = graphNode('trigger', wrapper), anchor = graphNode('anchor', trigger);
  assert.equal(menuDiscoveryChanged([identity(trigger, 'aria-controls')], picker, null, anchor), true);
  assert.equal(menuDiscoveryChanged([change(body, [wrapper])], picker, null, anchor), true);
  assert.equal(menuDiscoveryChanged([identity(body, 'class', 'light')], picker, null, anchor), false);
  assert.equal(body.closestCalls, 0, 'unrelated class writes skip ancestor discovery');
  trigger.classes = [];
  assert.equal(menuDiscoveryChanged([identity(trigger, 'class', 'trigger')], picker, null, anchor), true);
});
function styleInput(attributes = {}) {
  return { ownerNode: { getAttribute(name) { return attributes[name] ?? null; } }, disabled: false, media: { mediaText: '' } };
}
check('stable source validation reuses snapshots without skipping dirty-generation parses', () => {
  const inputs = [styleInput()], owned = new WeakSet();
  let builds = 0;
  const cache = motionIndexCache(() => ++builds), first = snapshotMotionSources(inputs, owned, null);
  cache.read(first);
  const stable = snapshotMotionSources(inputs, owned, cache.snapshot());
  assert.equal(stable, first); assert.equal(cache.read(stable), 1);
  cache.invalidate(); assert.equal(cache.read(snapshotMotionSources(inputs, owned, cache.snapshot())), 2);
  cache.clear(); assert.equal(cache.snapshot(), null);
});
check('every changed source field replaces its snapshot but not unchanged peers', () => {
  for (const change of [
    (inputs) => { inputs[0].disabled = true; },
    (inputs) => { inputs[0].media.mediaText = 'print'; },
    (inputs, attrs) => { attrs['data-plugin-css'] = 'changed'; },
    (inputs, attrs) => { attrs.href = '/changed.css'; },
    (inputs) => { inputs[0].ownerNode = styleInput().ownerNode; },
    (inputs) => { inputs[0] = { ...inputs[0] }; },
  ]) {
    const attrs = {}, inputs = [styleInput(attrs), styleInput()], owned = new WeakSet();
    const before = snapshotMotionSources(inputs, owned, null);
    change(inputs, attrs);
    const after = snapshotMotionSources(inputs, owned, before);
    assert.notEqual(after, before); assert.notEqual(after[0], before[0]); assert.equal(after[1], before[1]);
    assert.equal(before[0].disabled, false, 'previous primitive metadata stays intact');
  }
});
check('snapshot membership retains order/removal and only exact owned-output exclusion', () => {
  const a = styleInput(), output = styleInput(), lookalike = styleInput({ 'data-plugin-css': 'fanframe' });
  const owned = new WeakSet([output.ownerNode]);
  const first = snapshotMotionSources([a, output, { ownerNode: null }, lookalike], owned, null);
  assert.equal(first.length, 2); assert.equal(first[1].sheet, lookalike);
  assert.equal(snapshotMotionSources([a, lookalike], owned, first), first);
  const reordered = snapshotMotionSources([lookalike, a], owned, first);
  assert.equal(reordered[0].sheet, lookalike); assert.equal(reordered[1].sheet, a);
  const shorter = snapshotMotionSources([a], owned, first);
  assert.equal(shorter.length, 1); assert.equal(shorter[0], first[0]);
  assert.equal(snapshotMotionSources([], owned, first).length, 0);
});
check('stable snapshots still read CSSOM metadata on every collection', () => {
  let disabledReads = 0, mediaReads = 0, attributeReads = 0;
  const input = {
    ownerNode: { getAttribute() { attributeReads++; return ''; } },
    get disabled() { disabledReads++; return false; },
    media: { get mediaText() { mediaReads++; return ''; } },
  };
  const owned = new WeakSet();
  let previous = null;
  for (let i = 0; i < 3; i++) previous = snapshotMotionSources([input], owned, previous);
  assert.equal(disabledReads, 3); assert.equal(mediaReads, 3); assert.equal(attributeReads, 6);
});
check('native owner disconnection/moves invalidate discovery but connected final reinsertion does not', () => {
  const menu = graphNode('menu'), container = graphNode('panel', menu), trigger = graphNode('trigger'), anchor = graphNode('anchor', trigger);
  const owned = { menu, container, trigger };
  assert.equal(menuDiscoveryChanged([], picker, owned, anchor), false);
  trigger.isConnected = false;
  assert.equal(menuDiscoveryChanged([], picker, owned, anchor), true);
  trigger.isConnected = true; anchor.isConnected = false;
  assert.equal(menuDiscoveryChanged([], picker, owned, anchor), true);
  anchor.isConnected = true;
  assert.equal(menuDiscoveryChanged([], picker, owned, null), true);
  anchor.parentNode = graphNode('trigger');
  assert.equal(menuDiscoveryChanged([], picker, owned, anchor), true);
  anchor.parentNode = trigger;
  assert.equal(menuDiscoveryChanged([change(graphNode())], picker, owned, anchor), false);
});
console.log(JSON.stringify({ passed: results.length, checks: results, scope: 'pure algorithm checks; browser fixtures and product VIS/FLOW/performance are separate' }, null, 2));
