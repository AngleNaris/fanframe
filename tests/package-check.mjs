import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pkg = JSON.parse(read('package.json'));
const checks = [];
function check(name, fn) { fn(); checks.push(name); }

check('stable package identity and latest publication channel', () => {
  assert.equal(pkg.name, 'fanframe');
  assert.equal(pkg.version, '1.11.1');
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  assert.equal(pkg.publishConfig.tag, 'latest');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.license, 'MIT');
});
check('explicit DSH lower bound with an open next-major ceiling and no install lifecycle', () => {
  assert.equal(pkg.engines.dsh, '>=0.2.1-rc.1 <0.4.0-0');
  assert.equal(pkg.dsh.client.platform, 'web');
  assert.deepEqual(pkg.dsh.client.inject, []);
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ['build', 'test']);
  assert.equal(pkg.dependencies, undefined);
});
const expected = ['CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'lib/MARKDOWN-IT-LICENSE',
  'lib/PDFJS-LICENSE', 'lib/client.js', 'lib/index.js', 'locale/en.json', 'locale/zh.json', 'package.json',
  'src/chat-preview/host.js', 'src/chat-preview/limits.js', 'src/chat-preview/read-attachment.js'];
check('exact publication allowlist and present runtime resources', () => {
  assert.deepEqual([...pkg.files, 'package.json'].sort(), expected);
  for (const name of expected) assert.ok(fs.statSync(path.join(root, name)).isFile(), name);
  assert.equal(pkg.exports['./icon'], './icon.svg');
  assert.equal(pkg.exports['./locale/*.json'], './locale/*.json');
  assert.equal(pkg.exports['./client'], './lib/client.js');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
});
check('localized Chinese and English display names', () => {
  for (const [locale, title] of [['zh', '繁界'], ['en', 'FanFrame']]) {
    const meta = JSON.parse(read('locale/' + locale + '.json')).meta;
    assert.equal(meta.title, title);
    assert.ok(meta.description.length > 20);
  }
});
check('Cordis entry uses the new package identity', () => {
  const patch = read('cordis.patch.yml');
  assert.match(patch, /- id: fanframe\r?\n\s+name: 'fanframe'/);
  assert.doesNotMatch(patch, /name:\s*['"]?fan-de-hai/);
});
let captured;
const registrations = [];
const sandbox = { window: { __ModuleLoader__: { load(spec) { registrations.push(spec.id); captured = spec; } } } };
vm.runInNewContext(read('lib/client.js'), sandbox, { filename: 'fanframe/client.js', timeout: 3000 });
check('current feedback candidate marker matches the manifest', () => {
  assert.ok(read('lib/client.js').includes("style.dataset.fanCandidate = '" + pkg.version + "';"));
});
check('Only FanFrame is a browser module; base UI does not require preview services', () => {
  assert.deepEqual(registrations, ['fanframe']);
  assert.equal(captured.id, pkg.name);
  const plugin = captured.factory(name => { throw new Error('Unexpected runtime import: ' + name); });
  assert.equal(JSON.stringify(plugin.inject), '[]');
  assert.equal(typeof plugin.apply, 'function');
  const effects = [];
  plugin.apply({ effect(fn, name) { assert.equal(typeof fn, 'function'); effects.push(name); } });
  assert.equal(effects.length, 15);
  assert.equal(new Set(effects).size, effects.length);
  const imports = [];
  const withReact = captured.factory(name => { imports.push(name); assert.equal(name, 'react'); return {}; });
  const children = [];
  withReact.apply({ plugin(child) { children.push(child); }, effect() {} });
  assert.deepEqual(imports, ['react']);
  assert.equal(children.length, 1);
  assert.deepEqual([...children[0].inject], ['slots', 'locale', 'uiConversation', 'remote', 'remote.workspaceFiles']);
  // Feature-detect older Host surfaces before touching registration APIs.
  children[0].apply({ slots: {}, locale: {}, uiConversation: {}, remote: {} });
});
check('raster fences mount the inline reader only for a matching delivery', () => {
  const React = {
    createElement(type, props, ...children) { return { type, props, children }; },
    useMemo: make => make(), useRef: () => ({ current: null }), useState: () => [true], useEffect() {},
  };
  let child, fence;
  const plugin = captured.factory(() => React);
  plugin.apply({ plugin(value) { child = value; }, effect() {} });
  child.apply({
    slots: { inject(_slot, run) { run(); }, register({ key }, render) { if (key === 'dsh-media') fence = render; } },
    locale: { register() {} }, uiConversation: { events: { register() {} }, imageUrl() {} },
    remote: { workspaceFiles: { stat() { throw new Error('Unexpected eager read'); }, readBytes() { throw new Error('Unexpected eager read'); } } },
    effect() {}, on() {},
  });
  const path = 'C:\\图像 项目\\样片.png';
  const turns = new Map();
  const code = JSON.stringify({ path, title: '作品小样' });
  const base = { code, sessionId: 'session-a', useChat: select => select({ timeline: { turns } }), t: key => key, children: 'native code block' };
  assert.equal(fence({ ...base, streaming: true }), base.children);
  const raster = fence(base);
  assert.equal(raster.props.kind, 'image');
  const missing = raster.type(raster.props);
  assert.deepEqual(missing.children[0].children, ['inlineNotDelivered']);
  turns.set(1, { data: new Map([['deliverables', { presented: [{ path }] }]]) });
  const matched = raster.type(raster.props);
  assert.equal(matched.props.className, 'dcp-inline-image');
  assert.equal(matched.children[0].props.target.sessionId, base.sessionId);
  assert.equal(matched.children[0].props.file.path, path);
  assert.equal(matched.children[0].props.name, '作品小样');
});
const previewHost = await import('fanframe/chat-preview-host');
check('separate preview Host entry owns the existing attachment route', () => {
  assert.equal(previewHost.routePath, '/api/dsh-chat-preview.attachment');
  assert.deepEqual(previewHost.inject, ['connection', 'sessionQuery', 'attachments']);
  assert.match(read('cordis.patch.yml'), /name: 'fanframe\/chat-preview-host'/);
});
const host = await import(pathToFileURL(path.join(root, 'lib/index.js')).href);
check('Host registers only the independent visualization tool through an injected registry', () => {
  assert.deepEqual(host.inject, []);
  const definitions = [];
  host.apply({ inject(keys, setup) {
    assert.deepEqual(keys, ['tools']);
    setup({ tools: { register(definition) { definitions.push(definition); } }, inject() {} });
  } });
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].name, 'fanframe_visualize');
  assert.deepEqual(definitions[0].parameters.required, ['title', 'html']);
});
const baseline = process.argv[2];
if (baseline) check('Client body differs only by module id and diagnostic version', () => {
  const old = fs.readFileSync(baseline, 'utf8');
  const start = 'window.__ModuleLoader__.load({';
  const normalize = text => text.slice(text.indexOf(start))
    .replace('id: "fanframe",', 'id: "fan-de-hai",')
    .replace('style.dataset.version = ' + JSON.stringify(pkg.version) + ';', 'style.dataset.version = "1.9.0";');
  assert.ok(old.includes(start));
  assert.equal(normalize(read('lib/client.js')), normalize(old));
});
console.log(JSON.stringify({ name: pkg.name, version: pkg.version, passed: checks.length, checks, expectedPackedFiles: expected }, null, 2));
