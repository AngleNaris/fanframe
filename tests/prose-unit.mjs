import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const start = code.indexOf('    // Paint only.');
const end = code.indexOf('    function apply(ctx)', start);
assert.ok(start >= 0 && end > start);
const style = { dataset: {}, setAttribute() {}, remove() {} };
const registry = new Map();
const { proseTones, proseRanges, installProsePaint } = vm.runInNewContext(code.slice(start, end) + '\n({proseTones,proseRanges,installProsePaint})', {
  StaticRange: class { constructor(range) { Object.assign(this, range); } },
  window: { CSS: { highlights: registry } }, Highlight: class extends Set {}, IntersectionObserver: class {},
  document: { createElement: () => style, head: { appendChild() {} } }, watchRoots: () => () => {},
  inkBlueDark: '#9cb8dc', inkAmberDark: '#ddbc86', inkBlueLight: '#42658e', inkAmberLight: '#815817',
});
let passed = 0;
function check(fn) { fn(); passed++; }
function selected(text, tone) { return text.split('').filter((_, i) => proseTones(text)[i] === tone).join(''); }
check(() => assert.equal(selected('周六（最低 10℃［体感偏凉］）晴。', 1), '（最低 ℃［体感偏凉］）'));
check(() => assert.equal(selected('请查阅《周报》、【外出】、「北线」与{方案}。', 1), '《周报》【外出】「北线」{方案}'));
check(() => assert.equal(selected('『听说〔有雨〕』，还有＜补注＞。', 1), '『听说〔有雨〕』＜补注＞'));
check(() => assert.equal(selected('临时（未闭合；下一段照常。', 1), ''));
check(() => assert.equal(selected('不匹配（未关闭]；下句（匹配）。', 1), '（匹配）'));
check(() => assert.equal(selected('不跨块（第一行\n第二行）', 1), ''));
check(() => assert.equal(selected('数字：−12.5℃，２０％，2,365元，09:30，11/18。', 2), '−12.5２０％2,36509:3011/18'));
check(() => {
  const text = '第一段，第二段。第三段！第四段';
  const tones = [...proseTones(text)];
  const reading = [0, 4, 8, 12].map(i => tones[i]);
  assert.ok(reading.every((tone, i) => !i || tone !== reading[i - 1]));
  assert.deepEqual([...proseTones(text + '，继续追加。')].slice(0, text.length), tones);
});
function element(name, children, parents = []) {
  return { nodeType:1, matches: sel => sel.split(',').includes(name),
    closest: sel => [name,...parents].some(tag => sel.split(',').includes(tag)), firstChild: children[0] || null };
}
function leaf(data) { return {nodeType:3, data}; }
function children(...nodes) { for (let i=1;i<nodes.length;i++) nodes[i-1].nextSibling=nodes[i]; return nodes; }
function coverage(ranges) { return ranges?.map(range => range.startContainer.data.slice(range.startOffset, range.endOffset)).join('') || ''; }
check(() => {
  const root = element('p', children(leaf('天气（最低'), element('strong', children(leaf('10℃'))), leaf('，请'), element('a', children(leaf('看 700'))), leaf('）晴。')));
  const ranges = proseRanges(root);
  assert.equal(coverage(ranges[1]), '（最低℃，请）');
  assert.equal(coverage(ranges[2]), '10');
});
check(() => {
  const root = element('p', children(leaf('最初，'), element('code', children(leaf('900（未染色）'))), element('math', children(leaf('88'))), element('em', children(leaf('已经是强调'))), leaf('仍有其他文字。')));
  const ranges = proseRanges(root);
  assert.equal(coverage(ranges[2]), '');
  assert.doesNotMatch(coverage(ranges[4]) + coverage(ranges[5]), /强调|未染色/);
  assert.match(coverage(ranges[4]) + coverage(ranges[5]), /仍有其他文字/);
});
check(() => assert.equal(proseRanges(element('p', children(leaf('0123456789'.repeat(2000))))).length, 0));
check(() => {
  const stop = installProsePaint();
  const css = style.textContent;
  const shades = name => [...css.matchAll(new RegExp(`(:where\\(body:not\\(\\[data-ds-dark-theme\\]\\)\\) )?::highlight\\(fanframe-prose-${name}\\)\\{color:color-mix\\(in srgb,var\\(--dsw-alias-label-primary,CanvasText\\) (\\d+)%`, 'g'))];
  assert.deepEqual(shades('soft').map(m => Number(m[2])), [72, 67]);
  assert.deepEqual(shades('mid').map(m => Number(m[2])), [86, 84]);
  for (const name of ['soft', 'mid']) {
    assert.equal(shades(name)[0][1], undefined);
    assert.equal(shades(name)[1][1], ':where(body:not([data-ds-dark-theme])) ');
  }
  assert.match(css, /@media\(forced-colors:active\).*color:CanvasText/);
  stop();
  assert.equal(registry.size, 0);
});
console.log(JSON.stringify({passed, scope:'tokenizer, theme rules and read-only highlight range contract'}));
