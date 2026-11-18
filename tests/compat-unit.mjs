// Source-function tests with small graph/controller doubles. Not browser or UI evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const results = [];
function check(name, test) { test(); results.push(name); }
function capture(name, next, globals) {
  const start = `function ${name}(`, stop = `function ${next}(`;
  assert.equal(source.split(start).length, 2, `${name} is unique`);
  const at = source.indexOf(start), end = source.indexOf(stop, at + start.length);
  assert.ok(end > at, `${name} has an explicit extraction boundary`);
  const context = vm.createContext(globals);
  vm.runInContext(source.slice(at, end) + `\nglobalThis.tested = ${name};`, context, { timeout: 1000 });
  return context;
}
const node = parentElement => ({ parentElement, contains(other) {
  while (other) { if (other === this) return true; other = other.parentElement; }
  return false;
} });
const root = node(), region = node(root), area = node(region), seat = node(root);
const seats = { scrollRegion: region, scrollArea: area, newSessionRow: seat,
  newSession: node(node(seat)), panelList: node(area), regionArea: node(area), scrollFade: node(region) };
const shape = capture('structure', 'railWheel', {}).tested;
check('nested sidebar accepts the real Slot wrapper inside newSessionRow', () => assert.equal(shape(root, seats), 'nested'));
check('nested sidebar rejects a missing or reparented scroll wrapper', () => {
  assert.equal(shape(root, { ...seats, scrollArea: null }), null);
  assert.equal(shape(root, { ...seats, scrollRegion: node(node(root)) }), null);
  assert.equal(shape(root, { ...seats, panelList: node(root) }), null);
});
check('nested sidebar rejects a foreign new-session seat or fade', () => {
  assert.equal(shape(root, { ...seats, newSessionRow: node(root) }), null);
  assert.equal(shape(root, { ...seats, scrollFade: node(root) }), null);
});
check('legacy direct-child sidebar remains distinct from partial nested layouts', () => {
  assert.equal(shape(root, { panelList: node(root), regionArea: node(root) }), 'legacy');
  assert.equal(shape(root, { panelList: node(node(root)), regionArea: node(root) }), null);
});
const nav = { isConnected: true, scrollHeight: 500, clientHeight: 200 };
Object.defineProperty(nav, 'scrollTop', { get() { throw Error('Containment must not depend on the current edge'); } });
const wheel = capture('railWheel', 'valid', { nav, nestedPopup: target => target.popup }).tested;
function dispatch(patch = {}) {
  let stopped = 0;
  wheel({ target: { nodeType: 1 }, deltaX: 0, deltaY: 20, ctrlKey: false, defaultPrevented: false,
    stopPropagation() { stopped++; }, preventDefault() { assert.fail('Never cancel native scrolling'); }, ...patch });
  return stopped;
}
check('overflowing rail contains either vertical direction without reading scrollTop', () => {
  assert.equal(dispatch(), 1); assert.equal(dispatch({ deltaY: -20 }), 1);
});
check('rail wheel guard follows native handoff for modifiers and diagonal equality', () => {
  assert.equal(dispatch({ ctrlKey: true }), 0);
  assert.equal(dispatch({ shiftKey: true }), 1); assert.equal(dispatch({ metaKey: true }), 1);
  assert.equal(dispatch({ deltaX: 20, deltaY: 20 }), 1);
  assert.equal(dispatch({ deltaX: 21, deltaY: 20 }), 0); assert.equal(dispatch({ deltaY: 0 }), 0);
});
check('claimed popup events and already-cancelled events retain their owner', () => {
  assert.equal(dispatch({ defaultPrevented: true }), 0);
  assert.equal(dispatch({ target: { nodeType: 1, popup: true } }), 0);
});
check('non-overflowing and disconnected rails do not intercept', () => {
  nav.scrollHeight = nav.clientHeight; assert.equal(dispatch(), 0);
  nav.scrollHeight = 500; nav.isConnected = false; assert.equal(dispatch(), 0); nav.isConnected = true;
});
const directory = { subscribe: () => () => {}, getSnapshot: () => ({ current: { provider: 'openai-codex', model: 'test-model' } }) };
const preference = { subscribe: () => () => {}, getSnapshot: () => ({}), set() { assert.fail('Discovery must not write preferences'); } };
const codex = { available: true, directory, preference, t: key => `C:${key}` };
let entries = [], injections = 0, detached = 0;
const entry = { options: { id: 'codex-subscription' }, inject(sessionId) { assert.equal(sessionId, 'session-a'); injections++; return codex; } };
const refresh = capture('refreshOptions', 'detach', { nativePicker: true, optionsEntry: null, optionsFace: null,
  optionsKey: 'conversation.input.model.options', slots: { entriesOfSlot: () => entries }, props: { sessionId: 'session-a' },
  detach() { detached++; }, console: { warn() { throw Error('Unexpected bridge warning'); } } });
check('Codex options injection is independent and uses the current session', () => {
  entries = [entry]; assert.equal(refresh.tested(), true); assert.equal(refresh.optionsFace, codex);
  assert.equal(injections, 1); assert.equal(detached, 1);
});
check('unrelated options registration does not reinject or detach the Codex controller', () => {
  entries = [entry, { options: { id: 'agent-team' } }];
  assert.equal(refresh.tested(), false); assert.equal(injections, 1); assert.equal(detached, 1);
});
check('ambiguity and removal invalidate the old options source', () => {
  entries = [entry, { options: { id: 'codex-subscription' } }];
  assert.equal(refresh.tested(), true); assert.equal(refresh.optionsFace, null); assert.equal(detached, 2);
  entries = [entry]; refresh.tested(); entries = []; refresh.tested(); assert.equal(refresh.optionsFace, null);
});
check('unknown injected faces remain native without preference writes', () => {
  entries = [{ options: { id: 'codex-subscription' }, inject: () => ({ available: true }) }];
  refresh.tested(); assert.equal(refresh.optionsFace, null);
});
const face = { directory, available: true };
const prefSource = capture('preferenceFace', 'prefs', { face, codex, codexEntry: entry,
  state: () => directory.getSnapshot(), slots: { entriesOfSlot: () => entries } });
check('same-task deregistration is checked before using the old preference face', () => {
  entries = [entry]; assert.equal(prefSource.tested(), codex);
  entries = []; assert.equal(prefSource.tested(), null);
  entries = [{ ...entry }]; assert.equal(prefSource.tested(), null);
});
check('a foreign model directory cannot supply preferences to this menu', () => {
  entries = [entry]; prefSource.codex = { ...codex, directory: { getSnapshot: () => ({ current: { provider: 'openai-codex', model: 'other-model' } }) } };
  assert.equal(prefSource.tested(), null); prefSource.codex = codex;
});
check('legacy preference ownership remains unchanged', () => {
  prefSource.face = { preference }; assert.equal(prefSource.tested(), prefSource.face); prefSource.face = face;
});
let snapshot = { status: 'ready', current: { provider: 'openai-codex', model: 'test-model', reasoningEffort: 'high' },
  groups: [{ id: 'openai-codex', models: [{ id: 'test-model', reasoning: { defaultEffort: 'high', efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } }] }] };
let prefs = { status: 'ready', writable: true, saving: false, fastModels: ['test-model'], ultrafastModels: [], verbosityModels: ['test-model'], speedMode: 'standard', outputVerbosity: 'low' };
let optionCells = [{ field: 'speedMode' }, { field: 'outputVerbosity' }];
const nativeCell = { querySelector: () => ({ textContent: 'N:menu.effort' }) };
const choiceContext = capture('choices', 'disabled', { state: () => snapshot, prefs: () => prefs,
  codex, face: {}, t: key => `N:${key}`, picker: { cell: '.nativeCell', label: '.nativeLabel', effortLabel: 'menu.effort' },
  menu: { querySelectorAll(selector) {
    if (selector === ':scope > .nativeCell') return [nativeCell];
    assert.ok(selector.startsWith(':scope > [data-slot="conversation.input.model.options"] > button[role="menuitem"][aria-haspopup="menu"]'));
    const match = selector.match(/\[data-codex-model-option="([^"]+)"\]/); assert.ok(match);
    return optionCells.filter(cell => cell.field === match[1]);
  } } });
const kinds = () => Array.from(choiceContext.tested(), spec => spec.kind);
check('reasoning uses native locale while speed and detail use Codex locale and semantic fields', () => {
  const list = choiceContext.tested(); assert.deepEqual(Array.from(list, spec => spec.kind), ['effort', 'speed', 'verbosity']);
  assert.equal(list[0].label, 'N:menu.effort'); assert.equal(list[1].label, 'C:speedTitle'); assert.equal(list[2].label, 'C:verbosityTitle');
});
check('unknown capabilities preserve only the matching native options', () => {
  const before = prefs; prefs = { ...prefs, fastModels: undefined }; assert.deepEqual(kinds(), ['effort', 'verbosity']);
  prefs = { ...before, verbosityModels: [] }; assert.deepEqual(kinds(), ['effort', 'speed']); prefs = before;
});
check('ambiguous option rows and unknown verbosity values fail closed per field', () => {
  optionCells.push({ field: 'outputVerbosity' }); assert.deepEqual(kinds(), ['effort', 'speed']); optionCells.pop();
  const before = prefs; prefs = { ...prefs, outputVerbosity: 'future-value' }; assert.deepEqual(kinds(), ['effort', 'speed']); prefs = before;
});
let preferenceOwner = codex;
const disabled = capture('disabled', 'signature', { state: () => snapshot, prefs: () => prefs,
  preferenceFace: () => preferenceOwner, face, picker: {}, locked: false, pending: false }).tested;
check('native disabled state and preference saving/writability lock detail controls', () => {
  assert.equal(disabled({ kind: 'verbosity', cell: { disabled: true } }), true);
  const before = prefs; prefs = { ...prefs, saving: true }; assert.equal(disabled({ kind: 'verbosity' }), true);
  prefs = { ...before, writable: false }; assert.equal(disabled({ kind: 'verbosity' }), true); prefs = before;
});
check('missing preference ownership disables only details, not valid native reasoning', () => {
  preferenceOwner = null; assert.equal(disabled({ kind: 'verbosity' }), true); assert.equal(disabled({ kind: 'effort' }), false); preferenceOwner = codex;
});
check('nested columns explicitly remove legacy negative margins', () => {
  assert.ok(source.includes('[data-fan-rail-new-row] { grid-column:2; grid-row:2; margin-left:0 !important;'));
  assert.ok(source.includes('[data-fan-rail-scroll-area] > [data-fan-rail-browser] { grid-column:2; grid-row:2; margin-left:0 !important;'));
  assert.ok(source.includes('[data-fan-sidebar-rail]:has(> [data-fan-rail-scroll-region]) > [data-fan-rail-brand] { margin-left:0 !important; }'));
  const accessory = source.match(/\[data-fan-rail-unpin\] \{([^}]+)\}/); assert.ok(accessory);
  assert.doesNotMatch(accessory[1], /transition|animation|opacity/);
});
check('new owned focus feedback contains no underline or pseudo-element bar rule', () => {
  assert.doesNotMatch(source, /focus-visible\{text-decoration-line:underline/);
  assert.doesNotMatch(source, /\[data-fan-rail-button\]:focus-visible::after/);
  assert.match(source, /focus-visible\{color:var\(--dsw-alias-brand-primary\)!important/);
});
// Exercise the actual observer branch; this is not a DOM/layout or latency test.
const cardEffectEnd = source.indexOf("}, 'fan-de-hai: card-disclosure-motion');");
const changedStart = source.lastIndexOf('function changed(records) {', cardEffectEnd);
const changedEnd = source.indexOf('\n          var observer = new MutationObserver(changed);', changedStart);
assert.ok(changedStart >= 0 && changedEnd > changedStart && changedEnd < cardEffectEnd);
function cardChange(patch = {}, records = [{ type: 'childList' }]) {
  const calls = { measured: 0, fullPath: 0, settled: 0 }, stop = {};
  const flags = { closed: false, connected: true, hasHeader: true, expanded: true, next: true,
    isQuestion: true, isContent: false, job: null, hold: null, ...patch };
  const fullPath = () => { calls.fullPath++; throw stop; };
  const context = vm.createContext({ closed: flags.closed,
    root: { isConnected: flags.connected, contains: () => true, getBoundingClientRect: () => ({ height: 100, width: 480 }) },
    header: flags.hasHeader ? {} : null, findHeader: () => null, readExpanded: () => flags.next,
    expanded: flags.expanded, isQuestion: flags.isQuestion, isContent: flags.isContent,
    job: flags.job, hold: flags.hold, lastHeight: 100, lastInset: 0,
    measure: () => { calls.measured++; }, settle: () => { calls.settled++; },
    freezeShell: fullPath, insets: fullPath });
  vm.runInContext(source.slice(changedStart, changedEnd) + '\nglobalThis.tested = changed;', context, { timeout: 1000 });
  try { context.tested(records); } catch (error) { if (error !== stop) throw error; }
  return calls;
}
check('idle question edits only refresh geometry without height locks or parent-frame probes', () => {
  assert.deepEqual(cardChange(), { measured: 1, fullPath: 0, settled: 0 });
});
check('unchanged collapsed questions also retain native immediate content updates', () => {
  assert.deepEqual(cardChange({ expanded: false, next: false }), { measured: 1, fullPath: 0, settled: 0 });
});
check('real question state changes retain the synchronous animation preparation path', () => {
  assert.equal(cardChange({ next: false }).fullPath, 1);
});
check('active question animation still retargets on child-list updates', () => {
  assert.equal(cardChange({ job: {} }).fullPath, 1);
});
check('a captured question toggle retains its held-height path', () => {
  assert.equal(cardChange({ hold: { height: 100 } }).fullPath, 1);
});
check('nested content toggles retain their existing held-height path', () => {
  assert.equal(cardChange({ isQuestion: false, isContent: true, hold: { height: 100 } }).fullPath, 1);
});
check('ordinary idle cards keep their existing geometry refresh', () => {
  assert.deepEqual(cardChange({ isQuestion: false }), { measured: 1, fullPath: 0, settled: 0 });
});
check('same-state attribute-only records do not measure or start animation work', () => {
  assert.deepEqual(cardChange({}, [{ type: 'attributes' }]), { measured: 0, fullPath: 0, settled: 0 });
});
check('closed and disconnected controllers ignore queued mutation records', () => {
  for (const patch of [{ closed: true }, { connected: false }])
    assert.deepEqual(cardChange(patch), { measured: 0, fullPath: 0, settled: 0 });
});
check('missing headers retain the existing settlement path', () => {
  assert.deepEqual(cardChange({ hasHeader: false }), { measured: 0, fullPath: 0, settled: 1 });
});
check('without a ready context menu the native unpin fallback retains its centered 28px size', () => {
  const accessory = source.match(/\[data-fan-rail-unpin\] \{([^}]+)\}/)[1];
  for (const property of ['display:flex !important', 'align-items:center', 'justify-content:center', 'min-width:28px !important', 'max-width:28px !important', 'min-height:28px !important', 'padding:0 !important'])
    assert.ok(accessory.includes(property), property);
  assert.match(source, /\[data-fan-rail-button\] svg, \[data-fan-rail-unpin\] svg \{ width:18px; height:18px;/);
});
console.log(JSON.stringify({ passed: results.length, checks: results,
  scope: 'source-function/graph/controller doubles only; CSS layout, native scrolling, browser fixtures, VIS/FLOW/DATA and performance remain separate' }, null, 2));
