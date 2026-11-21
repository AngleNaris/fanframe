import { mediaKind } from './media-reference.js';
import { PreviewError } from './read-attachment.js';

export function deliveredFiles(turn) {
  const records = turn?.data?.get('deliverables')?.presented;
  if (!Array.isArray(records)) return [];
  // Match the host's order and deduplication without replacing its delivery cards.
  const files = new Map();
  for (const { path } of records.filter(value => value && typeof value.path === 'string')) {
    const name = path.split(/[\\/]/).at(-1);
    if (name && path.trim() && !path.includes('\0') && !/^[a-z][a-z\d+.-]*:\/\//i.test(path)) files.set(path, name);
  }
  return [...files].map(([path, name], index) => ({ source: 'delivery', path, name, index }));
}

export function splitDeliveries(files) {
  const media = [];
  const others = [];
  for (const file of files) {
    (mediaKind(file.name) ? media : others).push(file);
  }
  return { media, others };
}

function unwrap(result, signal) {
  signal.throwIfAborted();
  if (result?.ok === true && result.value) return result.value;
  if (result?.ok === false && result.error) throw Object.assign(new Error('Remote read refused'), { code: result.error.code });
  throw new PreviewError('unavailable');
}

export async function readDelivery(remote, sessionId, file, format, signal) {
  // Use the same session-scoped read authority and RemoteResult contract as the document sidebar.
  signal.throwIfAborted();
  const info = unwrap(await remote.stat(sessionId, file.path, signal), signal);
  if (info.bytes !== undefined && info.bytes > format.maxBytes) throw new PreviewError('tooLarge');
  const result = unwrap(await remote.readBytes(sessionId, file.path, {}, signal), signal);
  if (!(result.data instanceof Uint8Array) || result.offset !== 0 || !result.eof ||
      (result.bytes !== undefined && result.bytes !== result.data.byteLength)) throw new PreviewError('unreadable');
  if (result.data.byteLength > format.maxBytes) throw new PreviewError('tooLarge');
  if (result.version !== info.version || result.absolutePath !== info.absolutePath ||
      (info.bytes !== undefined && info.bytes !== result.data.byteLength)) throw new PreviewError('changed');
  return result.data;
}
