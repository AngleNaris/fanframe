// Source-function/controller doubles only: no DOM rendering or visual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(process.argv[2] || new URL('../lib/client.js', import.meta.url), 'utf8');
const start = source.indexOf('function newSessionEndInset(');
const sync = source.indexOf('function syncRail(');
const end = source.indexOf('function nestedPopup(', sync);
assert.ok(sync >= 0 && end > sync);
const program = source.slice(start >= 0 ? start : sync, end);
const results = [];
function check(name, test) { test(); results.push(name); }
function run({ nested = true, collapsed = false, drawer = false, headerInset = 0,
  inline = '8px', paint = '3px', header = true } = {}) {
  const values = new Map(); let computed = 0, rowReads = 0;
  const style = { paddingTop: '6px', paddingBottom: '6px', rowGap: '0px',
    getPropertyValue(key) { return ({ '--fan-rail-gap': '4px',
      '--dsh-sidebar-inline-padding': inline, '--dsh-sidebar-paint-inset': paint })[key] || ''; } };
  const row = { getBoundingClientRect() { rowReads++; return { bottom: 100, height: 38 }; } };
  const action = { tagName: 'BUTTON', closest() { return workspace; },
    getBoundingClientRect() { return { right: 400 - headerInset, width: 28, height: 28 }; } };
  const heading = { getElementsByClassName() { return [action]; } };
  const workspace = { getElementsByClassName() { return [heading]; } };
  const context = vm.createContext({
    drawerMode: drawer, nestedMode: nested,
    document: { querySelector() { return null; } },
    frame: { hasAttribute() { return collapsed; } },
    root: { clientHeight: 600, getBoundingClientRect() { return { left: 0, right: 400 }; } },
    getComputedStyle(node) { computed++; return node === row ? { marginBottom: '0px' } : style; },
    rootStyles: { set(key, value) { values.set(key, value); } },
    nativeClass(sheet, name) { return name === 'brandMark' ? null : name; },
    workspaceSheet: 'workspace', sidebarSheet: 'sidebar',
    nav: { scrollHeight: 100, querySelector() { return null; } },
    parts: { newSessionRow: row, scrollArea: { clientHeight: 500,
      getBoundingClientRect() { return { top: 20, height: 500 }; } },
      regionArea: { querySelector() { return header ? workspace : null; } },
      settingsArea: { getBoundingClientRect() { return { height: 36 }; } },
      footerActions: { scrollHeight: 32 } },
    syncPopups() {},
  });
  vm.runInContext(program + '\nsyncRail();', context, { timeout: 1000 });
  return { values, computed, rowReads, inset: Number.parseFloat(values.get('--fan-rail-new-end-inset')) };
}
check('expanded nested row keeps native gutter when the header hover box touches the edge', () => {
  assert.equal(run().inset, 12);
});
check('a small valid header inset cannot erase the native new-session gutter', () => assert.equal(run({ headerInset: 4 }).inset, 12));
check('the native matching inset stays stable', () => assert.equal(run({ headerInset: 12 }).inset, 12));
check('a wider native action inset remains intact', () => assert.equal(run({ headerInset: 20 }).inset, 20));
check('the gutter follows native spacing tokens, not screenshot pixels', () => assert.equal(run({ inline: '10px', paint: '2px' }).inset, 13));
check('fractional native spacing is preserved', () => assert.equal(run({ inline: '7.5px', paint: '2.25px' }).inset, 10.75));
check('zero-valued tokens retain the native one-pixel paint adjustment', () => assert.equal(run({ inline: '0px', paint: '0px' }).inset, 1));
check('an absent workspace header still retains the native gutter', () => assert.equal(run({ header: false }).inset, 12));
check('out-of-range header geometry cannot zero a valid native gutter', () => assert.equal(run({ headerInset: -10 }).inset, 12));
check('unknown native spacing keeps the existing header result', () => {
  for (const patch of [{ inline: '' }, { paint: '' }, { inline: 'calc(8px + 2px)' }, { inline: '8rem' }, { paint: '3%' }, { paint: 'Infinity' }])
    assert.equal(run({ ...patch, headerInset: 6 }).inset, 6);
});
check('negative or excessive native spacing fails closed', () => {
  for (const patch of [{ inline: '-1px' }, { paint: '-1px' }, { inline: '100px' }])
    assert.equal(run({ ...patch, headerInset: 6 }).inset, 6);
});
check('missing spacing and header retain the zero fallback', () => assert.equal(run({ inline: '', paint: '', header: false }).inset, 0));
check('collapsed native caption controls retain their existing zero inset', () => assert.equal(run({ collapsed: true }).inset, 0));
check('legacy direct-child sidebars retain their old measured inset', () => assert.equal(run({ nested: false, headerInset: 4 }).inset, 4));
check('Pocket drawer geometry is not changed', () => assert.equal(run({ drawer: true, headerInset: 4 }).inset, 4));
check('the fix adds no geometry or computed-style passes', () => {
  const result = run(); assert.equal(result.computed, 2); assert.equal(result.rowReads, 1);
});
check('the remaining rail, footer and list geometry is unchanged', () => {
  const values = run().values; values.delete('--fan-rail-new-end-inset');
  assert.deepEqual(Object.fromEntries(values), { '--fan-rail-list-y': '80.000px',
    '--fan-rail-nav-limit': '100px', '--fan-rail-actions-top': '104px', '--fan-rail-actions-limit': '440px' });
});
console.log(JSON.stringify({ passed: results.length, checks: results, evidence: 'source-function/controller doubles; not VIS/FLOW' }, null, 2));
