// Pure contracts and controller doubles only. Not browser, VIS/FLOW or persistence evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { apply } from '../lib/index.js';

const results = [];
async function check(name, run) { await run(); results.push(name); }
let tool;
const sections = [];
const removeSection = () => {};
apply({ inject(keys, install) {
  assert.deepEqual(keys, ['tools']);
  install({ tools: { register(value) { assert.equal(tool, undefined); tool = value; } },
    inject(deps, setup) {
      assert.deepEqual(deps, ['systemPrompt']);
      assert.equal(setup({ systemPrompt: { section(value) { sections.push(value); return removeSection; } } }), removeSection);
    },
  });
} });
await check('Host guidance defaults to one unprompted call for useful, reliable data patterns', () => {
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'fanframe-visualization-guidance');
  assert.equal(sections[0].complete, undefined);
  const text = sections[0].text;
  for (const rule of ['When fanframe_visualize is available', 'call it once before the final answer', 'reliable data', 'multi-point trend', 'distribution', 'composition', 'differences across groups', 'without waiting for a request to draw', 'takeaway in text'])
    assert.ok(text.includes(rule), rule);
  assert.ok(text.length < 1100);
  assert.match(text, /If a graphic can express it, use the graphic instead of words/);
});
await check('Host guidance gives skip conditions and contrasting forecast examples', () => {
  const text = sections[0].text;
  for (const rule of ['asks for text only or a conflicting format', 'short lookup', 'missing or unreliable', 'just repeat', 'Never invent values', 'week-long forecast with one chart', 'single day\'s high in text', 'built-in FanFrame controls only when interaction adds value'])
    assert.ok(text.includes(rule), rule);
});
await check('Host still registers the tool in profiles without the prompt service', () => {
  let registered;
  apply({ inject(_keys, setup) { setup({ tools: { register(value) { registered = value; } }, inject() {} }); } });
  assert.equal(registered?.name, 'fanframe_visualize');
});
const args = { title: 'Interactive example', html: '<button onclick="this.textContent=\'done\'">Run</button>' };
const exec = () => ({ signal: new AbortController().signal });
const value = await tool.execute(args, exec());
await check('tool uses its own name and a closed two-field argument schema', () => {
  assert.equal(tool.name, 'fanframe_visualize');
  assert.deepEqual(Object.keys(tool.parameters.properties), ['title', 'html']);
  assert.deepEqual(tool.parameters.required, ['title', 'html']);
  assert.equal(tool.parameters.additionalProperties, false);
  assert.equal(tool.isConcurrencySafe(args), true);
});
await check('Host preserves source verbatim without executing it', () => assert.deepEqual(value,
  { kind: 'fanframe.visualize', version: 2, ...args }));
await check('result metadata is versioned, JSON replayable and self-contained', () => {
  const meta = tool.output.presentationMeta(args, value);
  assert.deepEqual(JSON.parse(JSON.stringify(meta)), value);
  assert.equal(tool.output.schema.properties.version.const, 2);
});
await check('model result does not echo the HTML', () => {
  const content = tool.output.render(args, value);
  assert.deepEqual(content, [{ type: 'text', text: 'Visualization ready: Interactive example' }]);
  assert.ok(!JSON.stringify(content).includes(args.html));
});
await check('missing or non-string arguments fail before producing a card', async () => {
  for (const input of [undefined, {}, { title: 'x', html: null }, { title: 0, html: '<p>x</p>' }])
    await assert.rejects(tool.execute(input, exec()), /strings/);
});
await check('blank title and blank HTML are rejected', async () => {
  await assert.rejects(tool.execute({ ...args, title: ' \n ' }, exec()), /title/);
  await assert.rejects(tool.execute({ ...args, html: ' \t\n' }, exec()), /blank/);
});
await check('title trimming and the UTF-16 boundary are deterministic', async () => {
  assert.equal((await tool.execute({ ...args, title: '  x  ' }, exec())).title, 'x');
  assert.equal((await tool.execute({ ...args, title: 'x'.repeat(160) }, exec())).title.length, 160);
  await assert.rejects(tool.execute({ ...args, title: 'x'.repeat(161) }, exec()), /160/);
});
await check('HTML byte limit permits the exact ASCII boundary', async () => {
  await tool.execute({ ...args, html: 'x'.repeat(262144) }, exec());
  await assert.rejects(tool.execute({ ...args, html: 'x'.repeat(262145) }, exec()), /256 KiB/);
});
await check('HTML byte limit counts multibyte text, not JS string length', async () => {
  await tool.execute({ ...args, html: '界'.repeat(87381) }, exec());
  await assert.rejects(tool.execute({ ...args, html: '界'.repeat(87382) }, exec()), /256 KiB/);
});
await check('an already cancelled call cannot publish a successful card', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(tool.execute(args, { signal: controller.signal }), error => error.name === 'AbortError');
});

const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const start = source.indexOf('    // Independent tool-result renderer.');
const end = source.indexOf('    function apply(ctx)', start);
assert.ok(start > 0 && end > start);
const headingColors = source.match(/^    var markdownH2Dark = [^\n]+;/m)?.[0];
assert.ok(headingColors);
const inkColors = source.match(/^    var ink(?:Amber|Blue)Dark = [^\n]+;/gm);
assert.equal(inkColors?.length, 2);
const program = [headingColors, ...inkColors, source.slice(start, end)].join('\n');
function events() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, event = {}) { for (const fn of [...listeners.get(type) || []]) fn(event); },
    count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}
function clock() {
  let id = 0; const queued = new Map();
  return { queued, requestAnimationFrame(fn) { queued.set(++id, fn); return id; }, cancelAnimationFrame(key) { queued.delete(key); },
    flush() { const jobs = [...queued.values()]; queued.clear(); jobs.forEach(fn => fn()); } };
}
function helpers(globals = {}) {
  const context = vm.createContext({ TextEncoder, ...globals });
  vm.runInContext(program + '\nglobalThis.sut = { visualizeMeta, visualizeEscape, visualizeJSON, visualizeRuntime, visualizeDocument, visualizePalette, visualizeListen, visualizeEvent, visualizeDefinition, installVisualize };', context, { timeout: 1000 });
  return context.sut;
}
const sut = helpers();
await check('palette reads the host body scope instead of empty HTML tokens', () => {
  const body = {}, html = {};
  const values = { '--dsw-alias-bg-base': '#151517', '--dsw-alias-label-primary': '#f9fafb',
    '--dsw-alias-label-secondary': '#cfd3d6', '--dsw-alias-border-l1': '#ffffff0f',
    '--dsw-alias-brand-primary': '#f9fafb', '--dsw-alias-link': '#7aaaff' };
  const helper = helpers({ document: { body, documentElement: html }, getComputedStyle(node) {
    assert.equal(node, body); return { fontFamily: 'Noto Sans SC', getPropertyValue: key => values[key] || '' };
  } });
  const palette = helper.visualizePalette({ active: { colorScheme: 'dark' } });
  assert.equal(palette.background, '#151517'); assert.equal(palette.foreground, '#f9fafb');
  assert.equal(palette.accent, '#f9fafb'); assert.equal(palette.focus, '#7aaaff');
  assert.equal(palette.font, 'Noto Sans SC'); assert.equal(palette.scheme, 'dark');
});
await check('palette can fall back to documentElement before a body exists', () => {
  const html = {};
  const helper = helpers({ document: { documentElement: html }, getComputedStyle(node) {
    assert.equal(node, html); return { fontFamily: 'system-ui', getPropertyValue: () => '#fff' };
  } });
  assert.equal(helper.visualizePalette({ active: { colorScheme: 'light' } }).foreground, '#fff');
});
await check('focus has a system color fallback independent of monochrome brand ink', () => {
  const helper = helpers({ document: { body: {} }, getComputedStyle() {
    return { fontFamily: 'system-ui', getPropertyValue: key => key === '--dsw-alias-link' ? '' : '#fff' };
  } });
  assert.equal(helper.visualizePalette({ active: { colorScheme: 'dark' } }).focus, 'LinkText');
  const document = helper.visualizeDocument(value, 'focus', {});
  assert.ok(document.includes(':focus-visible{color:var(--fanframe-viz-focus,LinkText)'));
  assert.ok(document.includes('accent-color:var(--fanframe-viz-focus,LinkText)!important'));
});
await check('modern emphasis and focus share the actual chat heading cyan in dark and light', () => {
  const helper = helpers({ document: { body: {} }, getComputedStyle() {
    return { fontFamily: 'system-ui', getPropertyValue: key => key === '--dsw-alias-brand-primary' ? '#fff' : '#7aaaff' };
  } });
  for (const [scheme, expected] of [['dark', '#a4cccc'], ['light', 'hsl(180.000000, 28.169014%, 32%)']]) {
    const p = helper.visualizePalette({ active: { colorScheme: scheme } }, true);
    assert.equal(p.highlight, expected); assert.equal(p.focus, expected); assert.equal(p.accent, '#fff');
  }
  assert.match(source, /--fan-md-h2:" \+ markdownH2Dark/);
  assert.match(source, /--fan-md-h2:" \+ markdownH2Light/);
  assert.equal(helper.visualizePalette({ active: { colorScheme: 'dark' } }, false).highlight, undefined);
});
await check('Client admits the JSON-restored successful result', () => assert.deepEqual(sut.visualizeMeta(JSON.parse(JSON.stringify(value))), value));
await check('Client rejects foreign, future and missing metadata', () => {
  for (const patch of [null, {}, { ...value, kind: 'visualize' }, { ...value, version: 3 }, { ...value, title: '' }, { ...value, html: null }])
    assert.equal(sut.visualizeMeta(patch), null);
});
await check('Client independently enforces title, blank and UTF-8 limits on historical metadata', () => {
  for (const patch of [{ title: 'x'.repeat(161) }, { html: ' ' }, { html: 'x'.repeat(262145) }, { html: '界'.repeat(87382) }])
    assert.equal(sut.visualizeMeta({ ...value, ...patch }), null);
});
const definition = sut.visualizeDefinition();
const resultEvent = { type: 'tool/result', surfaceOp: 'append', seq: 37,
  data: { turn: 1, step: 2, message: { source: { kind: 'tool-call', callId: 'saved-call' }, isError: false }, meta: value } };
const resultMatch = { event: resultEvent, location: { kind: 'unresolved' } };
const nodeContext = { key: 'owned-node-key', id: 'saved-call', matches: [resultMatch], state: definition.start({}, resultMatch) };
await check('result without an in-window call header starts an additive body node', () => {
  const match = definition.match['tool/result'](JSON.parse(JSON.stringify(resultEvent)));
  assert.equal(match.id, 'saved-call'); assert.equal(match.role, 'start');
  assert.equal(match.exclusive, undefined); assert.equal(definition.target, 'chat');
  assert.deepEqual(Object.keys(definition.match), ['tool/result', 'tool/ptc-dispatch']);
});
await check('body node keeps the engine identity and stays outside process and step folding', () => {
  const node = definition.buildViewNode(nodeContext);
  assert.equal(node.key, nodeContext.key); assert.equal(node.id, nodeContext.id);
  assert.equal(node.kind, 'fanframe-visualization'); assert.equal(node.target, 'chat');
  assert.equal(node.groupTree, 'turn'); assert.equal(node.visibility, 'visible');
  assert.equal(node.anchorSeq, resultEvent.seq); assert.equal(node.location, resultMatch.location);
  assert.deepEqual(node.data, value);
});
await check('non-origin copies, errors, unrelated events and invalid metadata do not produce body nodes', () => {
  for (const event of [null, { ...resultEvent, surfaceOp: undefined }, { ...resultEvent, surfaceOp: { op: 'replace' } },
    { ...resultEvent, type: 'tool/call' }, { ...resultEvent, data: { ...resultEvent.data, message: { ...resultEvent.data.message, isError: true } } },
    { ...resultEvent, data: { ...resultEvent.data, meta: { ...value, version: 3 } } },
    { ...resultEvent, data: { ...resultEvent.data, message: { source: { callId: '' } } } }])
    assert.equal(sut.visualizeEvent(event), null);
});
await check('PTC uses its own successful dispatch identity and excludes other tools and errors', () => {
  const event = { type: 'tool/ptc-dispatch', seq: 38, data: { name: 'fanframe_visualize', subCallId: 'ptc-call', isError: false, meta: value } };
  assert.equal(definition.match['tool/ptc-dispatch'](event).id, 'ptc-call');
  assert.equal(sut.visualizeEvent({ ...event, data: { ...event.data, name: 'visualize' } }), null);
  assert.equal(sut.visualizeEvent({ ...event, data: { ...event.data, isError: true } }), null);
});
await check('updates preserve one call identity and use the current engine-resolved location', () => {
  const event = { ...resultEvent, seq: 39, data: { ...resultEvent.data, meta: { ...value, title: 'Updated title' } } };
  const match = { event, location: { kind: 'unresolved' } };
  assert.equal(definition.match['tool/result'](event).id, definition.match['tool/result'](resultEvent).id);
  const state = definition.update(nodeContext, match);
  const node = definition.buildViewNode({ ...nodeContext, state, matches: [resultMatch, match] });
  assert.equal(node.key, nodeContext.key); assert.equal(node.id, nodeContext.id);
  assert.equal(node.data.title, 'Updated title'); assert.equal(node.anchorSeq, 39); assert.equal(node.location, match.location);
  assert.equal(resultEvent.data.meta.title, args.title);
});
await check('incomplete projection contexts have no placeholder executable card', () => {
  assert.equal(definition.buildViewNode({ ...nodeContext, state: null }), null);
  assert.equal(definition.buildViewNode({ ...nodeContext, matches: [] }), null);
});
const doc = sut.visualizeDocument(value, 'channel-a', { scheme: 'dark', foreground: '#fff' });
await check('the published argument contract documents the four native controls', () => {
  const description = tool.parameters.properties.html.description;
  for (const mark of ['<button', 'type="range"', '<select>', 'type="checkbox"', 'click/input/change', 'SVG/canvas']) assert.ok(description.includes(mark), mark);
});
await check('v1 records still project and render without the v2 component stylesheet', () => {
  const old = { ...value, version: 1 };
  assert.equal(sut.visualizeMeta(old), old);
  const event = { ...resultEvent, data: { ...resultEvent.data, meta: old } };
  assert.deepEqual(sut.visualizeEvent(event).meta, old);
  const historical = sut.visualizeDocument(old, 'channel-a', { scheme: 'dark', foreground: '#fff' });
  assert.ok(!historical.includes('id="fanframe-visualize-controls"'));
  assert.equal(doc.replace(/<style id="fanframe-visualize-controls">[\s\S]*?<\/style>/, '').replace(',true);</script></head>', ');</script></head>').replace(/<svg [^>]*id="fanframe-viz-symbols"[\s\S]*?<\/svg>/, ''), historical);
});
await check('modern cards embed the documented, unique in-document SVG symbols under existing CSP', () => {
  const html = '<svg id="authored"><use href="#fanframe-icon-sun"/></svg>';
  const optedIn = sut.visualizeDocument({ ...value, html }, 'with-icons', {});
  const names = [...optedIn.matchAll(/<symbol id="fanframe-icon-([a-z-]+)"/g)].map(match => match[1]);
  assert.deepEqual(names, ['sun','cloud','cloud-sun','rain','storm','snow','wind','thermometer','trend-up','trend-down','calendar','clock','info','check','chevron-right']);
  assert.equal(new Set(names).size, names.length);
  const hint = tool.parameters.properties.html.description;
  assert.ok(hint.includes('href="#fanframe-icon-sun"') && names.every(name => hint.includes(name)));
  assert.ok(!doc.includes('fanframe-viz-symbols'));
  assert.ok(optedIn.indexOf('Content-Security-Policy') < optedIn.indexOf('fanframe-viz-symbols'));
  assert.ok(optedIn.indexOf(html) < optedIn.indexOf('fanframe-viz-symbols'));
  assert.match(optedIn, /id="fanframe-viz-symbols" aria-hidden="true" focusable="false" width="0" height="0"/);
  const legacySvg = sut.visualizeDocument({ ...value, html: '<svg id="first"></svg><script>document.querySelector("svg")</script>' }, 'legacy', {});
  assert.match(legacySvg, /<body><div id="fanframe-visualize-content"><svg id="first">/);
  assert.ok(!legacySvg.includes('fanframe-viz-symbols'));
});
await check('modern warm and cool series switch with the host scheme without changing base or v1 tokens', () => {
  const get = helpers({ document: { body: {} }, getComputedStyle: () => ({ fontFamily: 'system-ui', getPropertyValue: () => '#fff' }) });
  const palette = scheme => get.visualizePalette({ active: { colorScheme: scheme } }, true);
  assert.equal(palette('dark')['series-1'], '#ddbc86');
  assert.equal(palette('dark')['series-2'], '#9cb8dc');
  assert.equal(palette('light')['series-1'], '#815817');
  assert.equal(palette('light')['series-2'], '#42658e');
  assert.equal(get.visualizePalette({ active: { colorScheme: 'dark' } }, false)['series-1'], undefined);
  assert.match(program, /keys\.push\('highlight', 'series-1', 'series-2'\)/);
});
await check('v2 injects its control stylesheet before runtime and preserves model markup verbatim', () => {
  const css = doc.match(/<style id="fanframe-visualize-controls">([\s\S]*?)<\/style>/)?.[1];
  assert.ok(css);
  for (const mark of ['input[type=range]', '::-webkit-slider-thumb', 'rotate(45deg)', 'button', 'input[type=checkbox]:checked', '@supports (appearance:base-select)', '::picker(select)', 'option:checked']) assert.ok(css.includes(mark), mark);
  assert.ok(!css.includes('outline:') && !css.includes('box-shadow:'));
  assert.ok(doc.indexOf('Content-Security-Policy') < doc.indexOf('fanframe-visualize-controls'));
  assert.ok(doc.indexOf('fanframe-visualize-controls') < doc.indexOf('<script>'));
  assert.ok(doc.endsWith(args.html + '</div></body></html>'));
});
await check('CSP and runtime precede model HTML', () => {
  assert.ok(doc.indexOf('Content-Security-Policy') < doc.indexOf('<script>'));
  assert.ok(doc.indexOf('<script>') < doc.indexOf(args.html));
  assert.ok(doc.includes('id="fanframe-visualize-content"'));
});
await check('CSP rejects external requests/resources, eval, workers, child frames and forms', () => {
  const policy = doc.match(/Content-Security-Policy" content="([^"]+)/)[1];
  for (const directive of ['connect-src', 'worker-src', 'frame-src', 'child-src', 'form-action', 'base-uri', 'object-src'])
    assert.ok(policy.includes(`${directive} 'none'`));
  assert.ok(policy.includes("script-src 'unsafe-inline'"));
  assert.ok(!policy.includes('unsafe-eval') && !policy.includes('https:') && !policy.includes('http:'));
});
await check('wrapper title is escaped and cannot become HTML', () => {
  const html = sut.visualizeDocument({ ...value, title: '</title><img src=x>' }, 'x', {});
  assert.ok(html.includes('<title>&lt;/title&gt;&lt;img src=x&gt;</title>'));
});
await check('channel and palette cannot break out of the bootstrap script', () => {
  const html = sut.visualizeDocument(value, '</script><script>x', { font: '</script><script>x\u2028y' });
  assert.ok(!html.includes('</script><script>x'));
  assert.ok(html.includes('\\u003c/script>'));
});
await check('base focus feedback removes rings but retains a color cue', () => {
  assert.ok(doc.includes('outline:none!important;box-shadow:none!important'));
  assert.ok(doc.includes(':focus-visible{color:'));
  assert.ok(!doc.includes('button:focus-visible')); // Also covers summary, tabindex and contenteditable targets.
  assert.ok(doc.includes('color:var(--fanframe-viz-focus,LinkText)!important'));
});

const messages = events(), timing = clock(), frame = { contentWindow: {} }, heights = [];
const controller = helpers({ window: messages, requestAnimationFrame: timing.requestAnimationFrame, cancelAnimationFrame: timing.cancelAnimationFrame });
const release = controller.visualizeListen(frame, 'card-a', height => heights.push(height));
const heightMessage = (height, patch = {}) => ({ source: frame.contentWindow,
  data: { type: 'fanframe:visualize:height', channel: 'card-a', height }, ...patch });
await check('height bridge ignores other frames and unmatched channels/types', () => {
  messages.dispatch('message', heightMessage(200, { source: {} }));
  messages.dispatch('message', heightMessage(200, { data: { type: 'fanframe:visualize:height', channel: 'other', height: 200 } }));
  messages.dispatch('message', heightMessage(200, { data: { type: 'other', channel: 'card-a', height: 200 } }));
  assert.equal(timing.queued.size, 0);
});
await check('height bridge rejects malformed and non-finite measurements', () => {
  for (const height of [NaN, Infinity, -1, '200', null]) messages.dispatch('message', heightMessage(height));
  messages.dispatch('message', { source: frame.contentWindow, data: null });
  assert.equal(timing.queued.size, 0);
});
await check('height bridge coalesces one burst and uses its final clamped value', () => {
  messages.dispatch('message', heightMessage(200)); messages.dispatch('message', heightMessage(2000));
  assert.equal(timing.queued.size, 1); timing.flush(); assert.deepEqual(heights, [960]);
});
await check('height bridge can shrink and rounds fractional heights up', () => {
  messages.dispatch('message', heightMessage(180.1)); timing.flush();
  messages.dispatch('message', heightMessage(0)); timing.flush();
  assert.deepEqual(heights, [960, 181, 120]);
});
await check('parent cleanup removes its listener and queued update', () => {
  messages.dispatch('message', heightMessage(500)); release();
  assert.equal(messages.count(), 0); assert.equal(timing.queued.size, 0);
  timing.flush(); assert.equal(heights.length, 3);
});

const childEvents = events(), childTiming = clock(), documentEvents = events();
const styles = new Map(), posts = [], errors = [], observers = [];
const root = { scrollHeight: 200, getBoundingClientRect: () => ({ height: 150 }), appendChild(node) { errors.push(node); } };
const parent = { postMessage(message, origin) { posts.push({ message, origin }); } };
const document = { ...documentEvents, documentElement: { style: { setProperty(key, value) { styles.set(key, value); } } },
  getElementById(id) { assert.equal(id, 'fanframe-visualize-content'); return root; },
  createElement(tag) { assert.equal(tag, 'pre'); return { style: {}, setAttribute(key, val) { this[key] = val; } }; } };
class Observer {
  constructor(fn) { this.fn = fn; observers.push(this); }
  observe(target) { assert.equal(target, root); this.observed = true; }
  disconnect() { this.disconnected = true; }
}
const child = helpers({ window: childEvents, document, parent, ResizeObserver: Observer, MutationObserver: Observer,
  CSS: { supports(_type, v) { return ['#fff', '#000', 'system-ui'].includes(v); } },
  requestAnimationFrame: childTiming.requestAnimationFrame, cancelAnimationFrame: childTiming.cancelAnimationFrame });
child.visualizeRuntime('child-a', { scheme: 'dark', foreground: '#fff', focus: '#fff', font: 'system-ui' });
await check('bootstrap applies initial palette before content scripts', () => {
  assert.equal(styles.get('--fanframe-viz-foreground'), '#fff');
  assert.equal(styles.get('--fanframe-viz-focus'), '#fff');
  assert.equal(document.documentElement.style.colorScheme, 'dark');
  assert.equal(observers.length, 0);
});
await check('bootstrap error before DOM readiness is rendered once as plain text', () => {
  childEvents.dispatch('error', { message: '<img src=x>' }); documentEvents.dispatch('DOMContentLoaded');
  assert.equal(errors.length, 1); assert.equal(errors[0].textContent, '<img src=x>');
  assert.equal(errors[0].role, 'alert'); assert.equal(observers.length, 2);
});
await check('bootstrap measures intrinsic root and attributes the report to its channel', () => {
  childTiming.flush(); assert.equal(posts.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(posts[0])), { message: { type: 'fanframe:visualize:height', channel: 'child-a', height: 200 }, origin: '*' });
});
await check('bootstrap coalesces resize/mutation work without polling', () => {
  observers.forEach(observer => observer.fn()); childEvents.dispatch('resize');
  assert.equal(childTiming.queued.size, 1); childTiming.flush(); assert.equal(posts.length, 2);
});
await check('theme messages need the exact parent window, type and channel', () => {
  const data = { type: 'fanframe:visualize:theme', channel: 'child-a', palette: { foreground: '#000', focus: '#000' } };
  childEvents.dispatch('message', { source: {}, data });
  childEvents.dispatch('message', { source: parent, data: { ...data, channel: 'other' } });
  childEvents.dispatch('message', { source: parent, data: { ...data, type: 'other' } });
  assert.equal(styles.get('--fanframe-viz-foreground'), '#fff');
  assert.equal(styles.get('--fanframe-viz-focus'), '#fff');
  childEvents.dispatch('message', { source: parent, data }); assert.equal(styles.get('--fanframe-viz-foreground'), '#000');
  assert.equal(styles.get('--fanframe-viz-focus'), '#000');
});
await check('theme bridge drops arbitrary CSS fields and invalid color values', () => {
  childEvents.dispatch('message', { source: parent, data: { type: 'fanframe:visualize:theme', channel: 'child-a',
    palette: { accent: 'red; background:url(https://x)', focus: 'red; background:url(https://x)', arbitrary: '#fff', scheme: 'bad' } } });
  assert.equal(styles.has('--fanframe-viz-accent'), false); assert.equal(styles.has('--fanframe-viz-arbitrary'), false);
  assert.equal(styles.get('--fanframe-viz-focus'), '#000');
  assert.equal(document.documentElement.style.colorScheme, 'dark');
});
await check('runtime errors are bounded and reused rather than appended indefinitely', () => {
  childEvents.dispatch('unhandledrejection', { reason: 'x'.repeat(2000) });
  assert.equal(errors.length, 1); assert.equal(errors[0].textContent.length, 1000);
});
await check('resource errors and CSP violations use the existing bounded error box', () => {
  childEvents.dispatch('error', { target: { tagName: 'SCRIPT' } });
  assert.equal(errors[0].textContent, 'Resource could not be loaded');
  childEvents.dispatch('securitypolicyviolation', { effectiveDirective: 'script-src-elem' });
  assert.equal(errors[0].textContent, 'Blocked by visualization policy: script-src-elem');
  assert.equal(errors.length, 1);
  assert.ok(program.includes("addEventListener('error', onError, true)"));
  assert.ok(program.includes("removeEventListener('error', onError, true)"));
});
await check('host-localized error labels travel over the existing validated theme bridge', () => {
  childEvents.dispatch('message', { source: parent, data: { type: 'fanframe:visualize:theme', channel: 'child-a',
    palette: { labels: { resource: '资源无法加载', policy: '可视化策略已阻止此操作' } } } });
  childEvents.dispatch('error', {}); assert.equal(errors[0].textContent, '资源无法加载');
  childEvents.dispatch('securitypolicyviolation', { effectiveDirective: 'img-src' });
  assert.equal(errors[0].textContent, '可视化策略已阻止此操作: img-src');
});
await check('iframe teardown disconnects observers, listeners and pending animation work', () => {
  childEvents.dispatch('pagehide'); assert.ok(observers.every(observer => observer.disconnected));
  assert.equal(childEvents.count(), 0); assert.equal(documentEvents.count(), 0); assert.equal(childTiming.queued.size, 0);
  observers.forEach(observer => observer.fn()); assert.equal(childTiming.queued.size, 0);
});

const registrations = [], definitions = [], dictionaries = [], hooks = [], effects = [], unsubs = [];
const fakeFrame = { contentWindow: { postMessage() {} } };
const react = {
  createElement(type, props, ...children) { return { type, props, children }; },
  useSyncExternalStore(subscribe, snapshot) { unsubs.push(subscribe(() => {})); return snapshot(); },
  useRef: () => ({ current: fakeFrame }), useId: () => ':stable-id:', useState: value => [value, () => {}],
  useMemo: fn => fn(), useEffect(fn) { effects.push(fn); },
};
const slotScope = {
  locale: { register(ns, lang, dict) { dictionaries.push({ ns, lang, dict }); }, bind: () => key => key,
    subscribe() { return () => hooks.push('locale-clean'); }, getSnapshot: () => ({ active: 'zh' }) },
  theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) },
  on(type) { hooks.push(type); return () => hooks.push('theme-clean'); },
  uiConversation: { events: { register(definition) { definitions.push(definition); return () => hooks.push('definition-clean'); } } },
  slots: { inject(name, install) { assert.ok(['tool.call.toolview', 'conversation.chat.node'].includes(name)); return install(); },
    register(options, view) { registrations.push({ options, view }); return () => hooks.push('slot-clean'); } },
};
const registrationContext = helpers({ require(name) { assert.equal(name, 'react'); return react; }, window: events(),
  requestAnimationFrame() {}, cancelAnimationFrame() {}, document: { documentElement: {} },
  getComputedStyle() { return { fontFamily: 'system-ui', getPropertyValue: () => '#fff' }; } });
let teardown;
registrationContext.installVisualize({ inject(keys, install) {
  assert.deepEqual([...keys], ['slots', 'locale', 'theme', 'uiConversation']); teardown = install(slotScope);
} });
const view = registrations.find(entry => entry.options.name === 'tool.call.toolview').view;
const bodyView = registrations.find(entry => entry.options.name === 'conversation.chat.node').view;
await check('Client adds only its body kind and wire key with its own bilingual dictionary', () => {
  assert.equal(definitions.length, 1); assert.equal(definitions[0].kind, 'fanframe-visualization');
  assert.equal(registrations.length, 2);
  assert.deepEqual(registrations.map(entry => entry.options.key), ['fanframe-visualization', tool.name]);
  assert.deepEqual(dictionaries.map(value => value.lang), ['en', 'zh']);
  assert.ok(dictionaries.every(value => value.ns === 'fanframe.visualize'));
});
await check('preparing and started calls never inspect or execute argument HTML', () => {
  const block = new Proxy({}, { get() { throw Error('Do not inspect unfinished block'); } });
  for (const phase of ['preparing', 'start']) assert.equal(view({ phase, block }).type, 'div');
});
await check('failed result cannot mount a valid card carried in its metadata', () => {
  const tree = view({ phase: 'result', block: { isError: true, meta: value } });
  assert.equal(tree.type, 'div'); assert.equal(tree.props.role, 'alert');
});
await check('missing or incompatible result data stays an explicit text fallback', () => {
  assert.equal(view({ phase: 'result', block: {} }).type, 'div');
  assert.equal(view({ phase: 'result', block: { meta: { ...value, version: 99 } } }).type, 'div');
});
await check('successful tool details are brief text, not a duplicate executable iframe', () => {
  const tree = view({ phase: 'result', block: { meta: value } });
  assert.equal(tree.type, 'div'); assert.equal(tree.props.role, 'status'); assert.equal(tree.children[0], 'inBody');
});
await check('historical body metadata alone mounts the card without live args or a file lookup', () => {
  const node = definition.buildViewNode(nodeContext);
  const tree = bodyView({ node: JSON.parse(JSON.stringify(node)) });
  assert.equal(typeof tree.type, 'function'); assert.equal(tree.props.key, node.key);
  assert.deepEqual(tree.props.meta, value);
});
await check('card uses an opaque script-only iframe and no host controls or prompts', () => {
  const element = bodyView({ node: definition.buildViewNode(nodeContext) });
  const tree = element.type(element.props); const iframe = tree.children[1];
  assert.equal(tree.type, 'figure'); assert.equal(tree.props.style.borderRadius, 0);
  assert.equal(iframe.type, 'iframe'); assert.equal(iframe.props.sandbox, 'allow-scripts');
  assert.equal(iframe.props.referrerPolicy, 'no-referrer'); assert.equal(iframe.props.loading, 'lazy');
  assert.ok(iframe.props.srcDoc.includes(args.html)); assert.equal(iframe.props.style.height, 120);
  assert.ok(!iframe.props.sandbox.includes('same-origin') && !iframe.props.sandbox.includes('forms'));
  assert.ok(iframe.props.allow.includes("camera 'none'"));
  const cleanups = effects.map(effect => effect()).filter(Boolean); cleanups.forEach(cleanup => cleanup());
});
await check('v2 uses one neutral card surface and an aligned caption; v1 keeps legacy chrome', () => {
  for (const version of [1, 2]) {
    const element = bodyView({ node: { key: 'style-test', data: { ...value, version } } });
    const tree = element.type(element.props), [caption, iframe] = tree.children;
    assert.equal(tree.props.style.borderRadius, 0);
    assert.equal(iframe.props.style.outline, 'none');
    if (version === 1) {
      assert.equal(tree.props.style.background, 'var(--dsw-alias-bg-base)');
      assert.equal(tree.props.style.border, '1px solid var(--dsw-alias-border-l1)');
      assert.equal(caption.props.style.borderBottom, tree.props.style.border);
      assert.ok(!iframe.props.srcDoc.includes('fanframe-visualize-controls'));
    } else {
      assert.match(tree.props.style.background, /^color-mix\(in srgb,var\(--dsw-alias-bg-base,Canvas\) 96%/);
      assert.match(tree.props.style.border, /^1px solid color-mix\(in srgb,var\(--dsw-alias-bg-base,Canvas\) 82%/);
      assert.equal(caption.props.style.padding, '10px 14px 0');
      assert.equal(caption.props.style.borderBottom, undefined);
      const baseRoot = iframe.props.srcDoc.indexOf(':root{color-scheme:');
      const cardStyles = iframe.props.srcDoc.indexOf('<style id="fanframe-visualize-controls">');
      assert.ok(baseRoot >= 0 && cardStyles > baseRoot);
      assert.match(iframe.props.srcDoc.slice(cardStyles), /:root\s*\{[^}]*background:color-mix\(in srgb,var\(--fanframe-viz-background,Canvas\) 96%/);
      assert.match(iframe.props.srcDoc, /padding:8px 14px 12px/);
      assert.ok(!iframe.props.srcDoc.includes('<figcaption'));
    }
  }
});
await check('modern sizing accounts for horizontal scrollbars without reading the viewport as content', () => {
  const win = { ...events(), innerHeight: 500 };
  const doc = { ...events(), documentElement: { style: { setProperty() {} }, clientHeight: 485 },
    getElementById: () => ({ scrollHeight: 200, getBoundingClientRect: () => ({ height: 200.25 }) }) };
  const time = clock(), sizes = [];
  const scoped = helpers({ window: win, document: doc, parent: { postMessage: event => sizes.push(event.height) },
    requestAnimationFrame: time.requestAnimationFrame, cancelAnimationFrame: time.cancelAnimationFrame,
    ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} } });
  scoped.visualizeRuntime('modern-size', null, true); doc.dispatch('DOMContentLoaded'); time.flush();
  doc.documentElement.clientHeight = 500; win.dispatch('resize'); time.flush();
  assert.deepEqual(sizes, [215.25, 200.25]);
  win.dispatch('pagehide');
});
await check('registration and store subscriptions expose their owned teardown', () => {
  teardown(); unsubs.forEach(unsubscribe => unsubscribe());
  assert.equal(hooks.filter(value => value === 'slot-clean').length, 2);
  assert.ok(hooks.includes('definition-clean') && hooks.includes('locale-clean') && hooks.includes('theme-clean'));
});
console.log(JSON.stringify({ passed: results.length, checks: results,
  evidence: 'Host contract execution and isolated source/controller doubles; not real browser, React rendering, profile integration or persistence' }, null, 2));
