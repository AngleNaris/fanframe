import assert from 'node:assert/strict';
import test from 'node:test';
import { findDelivery, parseMediaReference } from '../../src/chat-preview/media-reference.js';

const path = 'C:/Work/one two.mp4';
const declaration = { path, seq: 31, index: 0 };
const turnOf = record => ({ data: new Map([['deliverables', { presented: [record] }]]) });

test('accepts explicit absolute local media paths and text-only titles', () => {
  assert.deepEqual(parseMediaReference(JSON.stringify({ path, title: '  本地预览  ' })), { path, title: '本地预览' });
  assert.deepEqual(parseMediaReference('{"path":"/workspace/test.WAV"}'), { path: '/workspace/test.WAV', title: 'test.WAV' });
  assert.deepEqual(parseMediaReference(JSON.stringify({ path: 'C:\\work\\clip.wav' })), { path: 'C:\\work\\clip.wav', title: 'clip.wav' });
});

test('accepts supported documents and raster images but rejects active or unsupported formats', () => {
  for (const ext of ['pdf', 'md', 'txt', 'tsv', 'jpg', 'jpeg', 'gif', 'PNG', 'webp']) {
    assert.deepEqual(parseMediaReference(`{"path":"/workspace/file.${ext}"}`), { path: `/workspace/file.${ext}`, title: `file.${ext}` });
  }
  for (const ext of ['svg', 'html', 'docx', 'zip']) assert.equal(parseMediaReference(`{"path":"/workspace/file.${ext}"}`), null);
  const windowsPath = 'C:\\图像 项目\\交付\\样片.png';
  assert.deepEqual(parseMediaReference(JSON.stringify({ path: windowsPath, title: ' 样片 ' })), { path: windowsPath, title: '样片' });
});

test('rejects unsafe protocols, unknown keys, control characters and unsupported formats', () => {
  for (const input of [{ path: 'http://example.test/clip.mp4' }, { path: '//host/share/clip.mp4' },
    { path: 'relative/a.mp4' }, { path: '/x/clip.mp4.html' }, { path: '/x/clip\n.mp4' },
    { path, title: '' }, { path, title: 'x'.repeat(161) }, { path, sessionId: 'foreign' }, { path, seq: 31 }]) {
    assert.equal(parseMediaReference(JSON.stringify(input)), null);
  }
  assert.equal(parseMediaReference('<video src="anything"></video>'), null);
});

test('resolves only the exact stored path in the supplied session timeline', () => {
  const original = new Map([[1, turnOf(declaration)]]);
  const other = new Map([[1, turnOf({ ...declaration, path: '/other/one two.mp4' })]]);
  assert.equal(findDelivery(original, path), declaration);
  assert.equal(findDelivery(other, path), undefined);
  assert.equal(findDelivery(original, 'C:/Other/one two.mp4'), undefined);
  assert.equal(findDelivery(original, 'C:/Work/./one two.mp4'), undefined);
  assert.equal(findDelivery(original, 'C:/Work/one%20two.mp4'), undefined);
});
