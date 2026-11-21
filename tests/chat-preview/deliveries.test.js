import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveredFiles, readDelivery, splitDeliveries } from '../../src/chat-preview/deliveries.js';
import { attachmentDefinition } from '../../src/chat-preview/chat-node.js';
import { formatFor } from '../../src/chat-preview/limits.js';

const movie = 'C:\\Work\\sample.mp4';
const audio = '/workspace/sample.wav';
const target = { path: movie };
const signal = new AbortController().signal;
const format = { maxBytes: 3 };
const bytes = new Uint8Array([1, 2, 3]);
const info = { absolutePath: movie, version: 'v1', bytes: 3 };
const result = { ...info, data: bytes, offset: 0, eof: true };

test('projects only recorded delivery paths, preserving order and deduplicating', () => {
  const turn = { data: new Map([['deliverables', { presented: [null, { path: movie }, { path: audio }, { path: movie },
    { path: 'https://example.org/sample.mp4' }, { path: 'test\0.mp4' }] }]]) };
  assert.deepEqual(deliveredFiles(turn), [
    { source: 'delivery', path: movie, name: 'sample.mp4', index: 0 },
    { source: 'delivery', path: audio, name: 'sample.wav', index: 1 },
  ]);
  assert.deepEqual(deliveredFiles({ data: new Map() }), []);
});

test('inlines only audio and video deliveries, preserving the existing document picker', () => {
  const files = [{ name: 'test.pdf' }, { name: 'a.WAV' }, { name: 'test.zip' }, { name: 'b.mp4' }, { name: 'not.mp4.html' }];
  assert.deepEqual(splitDeliveries(files), { media: [files[1], files[3]], others: [files[0], files[2], files[4]] });
  assert.deepEqual(splitDeliveries([]), { media: [], others: [] });
});

test('requests native Workspace Files in the viewed Session with the exact recorded path', async () => {
  const remote = {
    async stat(...args) { assert.deepEqual(args, ['viewed', movie, signal]); return { ok: true, value: info }; },
    async readBytes(...args) { assert.deepEqual(args, ['viewed', movie, {}, signal]); return { ok: true, value: result }; },
  };
  assert.equal(await readDelivery(remote, 'viewed', target, format, signal), bytes);
});

test('rejects over-limit metadata, changed versions, truncated results and cancellation', async () => {
  const remote = (stat, read) => ({ async stat() { return { ok: true, value: stat }; }, async readBytes() { return { ok: true, value: read }; } });
  await assert.rejects(readDelivery(remote({ ...info, bytes: 4 }, undefined), 'viewed', target, format, signal), { code: 'tooLarge' });
  await assert.rejects(readDelivery(remote(info, { ...result, version: 'v2' }), 'viewed', target, format, signal), { code: 'changed' });
  await assert.rejects(readDelivery(remote(info, { ...result, eof: false }), 'viewed', target, format, signal), { code: 'unreadable' });
  await assert.rejects(readDelivery(remote(info, result), 'viewed', target, format, AbortSignal.abort()), { name: 'AbortError' });
});

test('known passive formats are explicit, including native image and media MIME', () => {
  assert.equal(formatFor('RED.MP4').mime, 'video/mp4');
  assert.equal(formatFor('reference.wav').kind, 'audio');
  assert.equal(formatFor('photo.jpeg').mime, 'image/jpeg');
  assert.equal(formatFor('vector.svg'), undefined);
  assert.equal(formatFor('active.html'), undefined);
});

test('includes historical raster images without re-indexing or losing their native loader reference', () => {
  const ref = { attachmentId: 'sha256:reference', mediaType: 'image/png', bytes: 20, width: 10, height: 10 };
  const event = { type: 'user/message', surfaceOp: 'append', seq: 15, data: { role: 'user', source: { kind: 'user' },
    content: [{ type: 'text' }, { type: 'image', attachment: ref }] } };
  assert.deepEqual(attachmentDefinition.match['user/message'](event), { id: '15', role: 'start' });
  assert.deepEqual(attachmentDefinition.start(null, { event }).files, [
    { source: 'image', name: 'image.png', index: 1, bytes: 20, attachment: ref },
  ]);
});
