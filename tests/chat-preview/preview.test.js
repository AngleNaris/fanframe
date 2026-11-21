import assert from 'node:assert/strict';
import test from 'node:test';
import { attachmentDefinition, attachmentNodeKind } from '../../src/chat-preview/chat-node.js';
import { apply, createReadHandler, routePath } from '../../src/chat-preview/host.js';
import { formatFor } from '../../src/chat-preview/limits.js';
import { markdownNodes } from '../../src/chat-preview/markdown.js';
import { fileAt, readVerifiedFile } from '../../src/chat-preview/read-attachment.js';
import { decodeText, parseTable } from '../../src/chat-preview/text.js';

const ref = { attachmentId: `sha256:${'a'.repeat(64)}`, name: '说明.txt', bytes: 3 };
const file = { type: 'file', attachment: ref };
const event = { type: 'user/message', surfaceOp: 'append', seq: 12,
  data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Sample' }, file, { type: 'image' },
    { type: 'file', attachment: { ...ref, name: 'second.csv' } }] } };
const validPath = `${routePath}?session=session-fixture&seq=12&index=1`;
const request = (path = validPath, init) => new Request(`http://fixture.test${path}`, init);

function makeHandler(overrides = {}) {
  return createReadHandler({
    async readEvent(query) { assert.deepEqual(query, { sessionId: 'session-fixture', seq: 12 }); return { target: event }; },
    async *readStream(received) { assert.equal(received, ref); yield new Uint8Array([65]); yield new Uint8Array([66, 67]); },
    signal: new AbortController().signal,
    ...overrides,
  });
}

test('takes exact raw block position from a durable human message', () => {
  assert.equal(fileAt(event, 12, 1), ref);
  for (const i of [0, 2, -1, 999, 1.1]) assert.equal(fileAt(event, 12, i), undefined);
  assert.equal(fileAt(event, 11, 1), undefined);
  assert.equal(fileAt({ ...event, surfaceOp: 'replace' }, 12, 1), undefined);
  assert.equal(fileAt({ ...event, data: { ...event.data, source: { kind: 'context' } } }, 12, 1), undefined);
});

test('projects a single nonexclusive companion row without emitting durable IDs or copying bytes', () => {
  const matcher = attachmentDefinition.match['user/message'];
  assert.deepEqual(matcher(event), { id: '12', role: 'start' });
  assert.equal(matcher({ ...event, surfaceOp: 'replace' }), null);
  assert.equal(matcher({ ...event, data: { ...event.data, content: [{ type: 'image' }] } }), null);
  const location = { turn: 1 };
  const result = attachmentDefinition.buildViewNode({ key: 'test:12', id: '12', state: attachmentDefinition.start(null, { event, location }) });
  assert.equal(result.kind, attachmentNodeKind);
  assert.equal(result.location, location);
  assert.deepEqual(result.data, { seq: 12, files: [{ index: 1, name: '说明.txt', bytes: 3 }, { index: 3, name: 'second.csv', bytes: 3 }] });
});

test('owner API registration uses only the authenticated Connection exact route', () => {
  let route;
  const stop = [];
  apply({
    effect(factory) { stop.push(factory()); },
    connection: { fetch: { register(value) { route = value; return () => {}; } } },
    sessionQuery: { readEvent() { throw new Error('Not called until admission'); } },
    attachments: { readFileStream() { throw new Error('Not called until admission'); } },
  });
  assert.equal(route.path, routePath);
  assert.deepEqual(route.methods, ['GET']);
  assert.equal(route.requestBody, 'buffered');
  for (const disposer of stop.reverse()) disposer();
});

test('serves bytes only with non-cacheable and non-executable response headers', async () => {
  const res = await makeHandler()(request());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/octet-stream');
  assert.equal(res.headers.get('content-length'), '3');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('content-disposition'), 'attachment');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await res.text(), 'ABC');
});

test('rejects invalid coordinates, extra parameters, or non-file positions', async () => {
  const handler = makeHandler();
  assert.equal((await handler(request(`${validPath}&index=1`))).status, 400);
  assert.equal((await handler(request(`${validPath}&extra=1`))).status, 400);
  assert.equal((await handler(request(validPath.replace('12', '-1')))).status, 400);
  assert.equal((await handler(request(validPath.replace('index=1', 'index=2')))).status, 404);
  const missing = makeHandler({ async readEvent() { throw Object.assign(new Error(), { code: 'SESSION_QUERY_EVENT_NOT_FOUND' }); } });
  assert.equal((await missing(request())).status, 404);
});

test('does not deliver partially verified attachments, or start a read beyond the file limit', async () => {
  let read = 0;
  const streamFailsAtEnd = async function* () { read++; yield new Uint8Array([65, 66, 67]); throw Object.assign(new Error(), { code: 'ATTACHMENT_CORRUPT' }); };
  assert.equal((await makeHandler({ readStream: streamFailsAtEnd })(request())).status, 422);
  assert.equal(read, 1);
  assert.equal((await makeHandler({ async *readStream() { yield new Uint8Array(2); } })(request())).status, 422);
  assert.equal((await makeHandler({ async *readStream() { yield new Uint8Array(5); } })(request())).status, 422);
  await assert.rejects(readVerifiedFile({ ...ref, bytes: formatFor(ref.name).maxBytes + 1 }, streamFailsAtEnd), { code: 'tooLarge' });
  await assert.rejects(readVerifiedFile({ ...ref, name: 'page.html' }, streamFailsAtEnd), { code: 'unsupported' });
  assert.equal(read, 1);
});

test('dedicated cancellation path releases the read reservation and caps concurrency', async () => {
  const lifetime = new AbortController();
  const pending = makeHandler({ signal: lifetime.signal,
    readEvent: (_, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  });
  const first = pending(request()), second = pending(request());
  assert.equal((await pending(request())).status, 503);
  lifetime.abort();
  assert.equal((await first).status, 499);
  assert.equal((await second).status, 499);
  assert.equal((await pending(request())).status, 499);
});

test('only accepts explicitly supported extensions; text encoding is strict', () => {
  assert.equal(formatFor('report.PDF').kind, 'pdf');
  assert.equal(formatFor('notes.MARKDOWN').kind, 'markdown');
  assert.equal(formatFor('data.TSV').delimiter, '\t');
  assert.equal(formatFor('payload.pdf.html'), undefined);
  assert.equal(decodeText(new TextEncoder().encode('原文')), '原文');
  assert.equal(decodeText(new Uint8Array([0xff, 0xfe, 0x41, 0])), 'A');
  assert.throws(() => decodeText(Uint8Array.of(0xff)));
  assert.throws(() => decodeText(Uint8Array.of(0x61, 0x00)));
});

test('CSV/TSV preserve quoted values, headers, empty fields and literal formulas', () => {
  assert.deepEqual(parseTable('id,name\r\n0001,"one, two"\n=1+2,"a\n""b"""\n,\n', ','), {
    rows: [['id', 'name'], ['0001', 'one, two'], ['=1+2', 'a\n"b"'], ['', '']], truncated: false,
  });
  assert.deepEqual(parseTable('a\tb\t\nlast\t', '\t'), { rows: [['a', 'b', ''], ['last', '']], truncated: false });
  assert.deepEqual(parseTable('a,b,c\nx,y,z', ',', { maxRows: 1, maxCols: 2 }), { rows: [['a', 'b']], truncated: true });
  assert.throws(() => parseTable('"unfinished', ','));
  assert.throws(() => parseTable('"closed"extra', ','));
});

test('Markdown uses only passive elements and includes no document-authored attributes', () => {
  const create = (name, props, ...children) => ({ name, props, children });
  const tree = markdownNodes(create, '# Hello\n\n<a>raw</a>\n\n[link](https://example.org) ![alternate](https://example.org/p.png)\n\n**bold**\n\n```html\n<div>literal</div>\n```');
  const json = JSON.stringify(tree);
  for (const tag of ['h1', 'strong', 'pre', 'code']) assert.match(json, new RegExp(`"name":"${tag}"`));
  assert.match(json, /alternate/);
  assert.match(json, /<div>literal<\/div>/);
  assert.doesNotMatch(json, /"name":"(?:a|img|div)"|https?:|"href":|"src":/);
});
