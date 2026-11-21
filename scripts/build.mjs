import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const asset = name => new URL(name, root);
const resolve = createRequire(import.meta.url).resolve;
const template = await readFile(asset('src/client.js'), 'utf8');
const marker = '/* @fanframe-chat-preview */';
if (template.split(marker).length !== 2) throw new Error('Expected one preview insertion point inside FanFrame factory');
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['src/chat-preview/client.js'],
  write: false,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'fanframeChatPreview',
  target: 'chrome124',
  minify: true,
  legalComments: 'inline',
  loader: { '.css': 'text' },
  plugins: [{
    name: 'bundled-pdf-worker-source',
    setup(builder) {
      builder.onResolve({ filter: /^pdf-worker-source$/ }, () => ({
        path: resolve('pdfjs-dist/build/pdf.worker.min.mjs'), namespace: 'embedded-pdf-worker',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'embedded-pdf-worker' }, async ({ path }) => ({
        contents: await readFile(path, 'utf8'), loader: 'text',
      }));
    },
  }],
});
const licenses = [];
for (const name of ['markdown-it', 'entities', 'linkify-it', 'mdurl', 'punycode.js', 'uc.micro']) {
  const dir = asset(`node_modules/${name}/`);
  const license = (await readdir(dir)).find(entry => /^licen[cs]e(?:[-.].*)?$/i.test(entry));
  if (!license) throw new Error(`Missing third-party license: ${name}`);
  licenses.push(`${name}\n${await readFile(new URL(license, dir), 'utf8')}`);
}
await mkdir(asset('lib'), { recursive: true });
await copyFile(resolve('pdfjs-dist/LICENSE'), asset('lib/PDFJS-LICENSE'));
await writeFile(asset('lib/MARKDOWN-IT-LICENSE'), licenses.join('\n\n'));
await writeFile(asset('lib/client.js'), template.replace(marker, () => outputFiles[0].text.trim()));
