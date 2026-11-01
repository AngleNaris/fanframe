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

check('package identity and beta publication channel', () => {
  assert.equal(pkg.name, 'fanframe');
  assert.equal(pkg.version, '1.10.0-beta.16');
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  assert.equal(pkg.publishConfig.tag, 'beta');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.license, 'MIT');
});
check('explicit inclusive DSH rc.1–rc.6 range and no install lifecycle', () => {
  assert.equal(pkg.engines.dsh, '>=0.2.1-rc.1 <=0.2.1-rc.6');
  assert.equal(pkg.dsh.client.platform, 'web');
  assert.deepEqual(pkg.dsh.client.inject, []);
  assert.equal(pkg.scripts, undefined);
  assert.equal(pkg.dependencies, undefined);
});
const expected = ['CHANGELOG.md', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'lib/client.js', 'lib/index.js', 'locale/en.json', 'locale/zh.json', 'package.json'];
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
const sandbox = { window: { __ModuleLoader__: { load(spec) { captured = spec; } } } };
vm.runInNewContext(read('lib/client.js'), sandbox, { filename: 'fanframe/client.js', timeout: 3000 });
check('current feedback candidate marker matches the manifest', () => {
  assert.ok(read('lib/client.js').includes("style.dataset.fanCandidate = '" + pkg.version + "';"));
});
check('Client module resolves under fanframe without runtime imports', () => {
  assert.equal(captured.id, pkg.name);
  const plugin = captured.factory(name => { throw new Error('Unexpected runtime import: ' + name); });
  assert.equal(JSON.stringify(plugin.inject), '[]');
  assert.equal(typeof plugin.apply, 'function');
  const effects = [];
  plugin.apply({ effect(fn, name) { assert.equal(typeof fn, 'function'); effects.push(name); } });
  assert.equal(effects.length, 14);
  assert.equal(new Set(effects).size, effects.length);
});
const host = await import(pathToFileURL(path.join(root, 'lib/index.js')).href);
check('Host remains a dependency-free no-op', () => {
  assert.deepEqual(host.inject, []);
  assert.equal(host.apply(), undefined);
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
