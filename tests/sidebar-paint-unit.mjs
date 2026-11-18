// Real effect output with small CSS/DOM doubles, not browser, timing or UI evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const sidebar = '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css';
const results = [];
function check(name, test) { test(); results.push(name); }
const nativeCss = '.Host_root{color:white}.Host_panelEntry{border-inline:3px solid transparent}.Host_panelRow{border-inline:3px solid transparent}.Host_collapsed .Host_panelEntry,.Host_collapsed .Host_panelRow{border-inline:0}';
function output(css = nativeCss, { reduced = false, foreign = false, neighbours = false } = {}) {
  let spec;
  const nodes = [], observers = [], added = [], removed = [];
  const sheets = new Map();
  sheets.set(foreign ? 'foreign/SidebarRoot.module.css' : sidebar, { textContent: css });
  if (neighbours) {
    sheets.set('@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css', { textContent: '.Settings_navCell{}' });
    sheets.set('@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css', { textContent: '.Input_card{}.Input_cardWorkspaceTrigger{}' });
  }
  const document = {
    createElement(tag) {
      assert.equal(tag, 'style');
      return { dataset: {}, textContent: '', setAttribute() {}, remove() { this.removed = true; } };
    },
    querySelector(selector) {
      const id = /^style\[data-plugin-css="([^"]+)"\]$/.exec(selector);
      assert.ok(id, 'only exact native module lookups');
      return sheets.get(id[1]) || null;
    },
    head: { append(node) { nodes.push(node); } }, documentElement: {},
    addEventListener(name) { added.push(name); }, removeEventListener(name) { removed.push(name); },
  };
  class Observer {
    constructor() { this.disconnected = false; observers.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  }
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { spec = value; } }, CSS: { escape: value => value } },
    document, MutationObserver: Observer,
    matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
    cancelAnimationFrame() {},
    getComputedStyle() { assert.fail('no geometry or computed-style read on stylesheet build'); },
  }, { timeout: 3000 });
  const effects = new Map();
  spec.factory(() => { throw Error('Unexpected runtime import'); }).apply({ effect(fn, name) { effects.set(name, fn); } });
  const dispose = effects.get('fanframe: hover-feedback')();
  assert.equal(nodes.length, 1, 'reuse the existing stylesheet');
  const emitted = nodes[0].textContent;
  dispose();
  assert.equal(nodes[0].removed, true);
  assert.ok(observers.every(observer => observer.disconnected));
  assert.deepEqual(removed.sort(), added.sort());
  assert.ok(effects.delete('fanframe: prose-paint'), 'prose owns an independent lifecycle');
  assert.equal(effects.size, 14, 'sidebar paint does not open a new effect');
  return emitted;
}
const expected = '[data-fan-sidebar-rail].Host_root .Host_panelEntry,[data-fan-sidebar-rail].Host_root .Host_panelRow{border-inline-color:transparent!important;}';
check('native spacer colors stay transparent in both states', () => assert.equal(output(), expected));
check('the rule does not depend on unpin/entry or collapsed-state markers', () => {
  assert.doesNotMatch(output(), /data-fan-rail-entry|collapsed|data-fan-rail-button|:hover|:focus/);
});
check('the declaration changes only the logical inline color, not geometry or other motion', () => {
  assert.equal(output().match(/\{([^}]+)\}/)[1], 'border-inline-color:transparent!important;');
});
check('an entry-only layout does not manufacture a row selector', () => {
  assert.equal(output('.Host_root{}.Host_panelEntry{}'), '[data-fan-sidebar-rail].Host_root .Host_panelEntry{border-inline-color:transparent!important;}');
});
check('a legacy row-only layout does not require pinned entry wrappers', () => {
  assert.equal(output('.Old_root{}.Old_panelRow{}'), '[data-fan-sidebar-rail].Old_root .Old_panelRow{border-inline-color:transparent!important;}');
});
check('unknown root leaves the native stylesheet untouched', () => assert.equal(output('.Host_panelEntry{}.Host_panelRow{}'), ''));
check('unknown panel classes emit no fallback or global override', () => assert.equal(output('.Host_root{}.Other_button{}'), ''));
check('longer local names are not mistaken for the native border owners', () => assert.equal(output('.Host_root{}.Host_panelEntryWide{}.Host_panelRowExtra{}'), ''));
check('a foreign module with identical local suffixes is not enrolled', () => assert.equal(output(nativeCss, { foreign: true }), ''));
check('reduced motion retains the same transparent endpoints', () => assert.equal(output(nativeCss, { reduced: true }), expected));
check('native class replacement is resolved without hardcoded host hashes', () => {
  assert.equal(output(nativeCss.replaceAll('Host_', 'Next_')), expected.replaceAll('Host_', 'Next_'));
});
check('light/dark ink does not enter the generated spacer color', () => {
  assert.equal(output(nativeCss.replace('color:white', 'color:black')), expected);
});
check('the existing composer stroke and focus feedback remains in the shared output', () => {
  const css = output(nativeCss, { neighbours: true });
  assert.ok(css.startsWith(expected));
  assert.ok(css.includes('--dsw-elevation-stroke-color:color-mix('));
  assert.ok(css.includes(':focus-within{--dsw-elevation-stroke-color:'));
  assert.ok(css.includes('box-shadow:var(--dsw-elevation-soft)!important'));
});
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
