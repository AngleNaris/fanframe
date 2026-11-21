import { formatFor } from './limits.js';

export class PreviewError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// The adapter passes a durable event from the authorized viewed Session, not a ref supplied by the Client.
export function fileAt(event, seq, contentIndex) {
  if (!Number.isSafeInteger(seq) || seq < 1 || !Number.isSafeInteger(contentIndex) || contentIndex < 0 ||
      event?.seq !== seq || event.type !== 'user/message' || event.surfaceOp !== 'append' ||
      event.data?.role !== 'user' || event.data.source?.kind !== 'user' ||
      !Array.isArray(event.data.content)) return undefined;
  const block = event.data.content[contentIndex];
  const ref = block?.type === 'file' ? block.attachment : undefined;
  if (!ref || typeof ref.name !== 'string' || !ref.name || typeof ref.attachmentId !== 'string' ||
      !Number.isSafeInteger(ref.bytes) || ref.bytes < 0) return undefined;
  return ref;
}

export async function readVerifiedFile(ref, readStream, signal) {
  signal?.throwIfAborted();
  const format = formatFor(ref.name);
  if (!format) throw new PreviewError('unsupported');
  if (ref.bytes > format.maxBytes) throw new PreviewError('tooLarge');

  const bytes = new Uint8Array(ref.bytes);
  let offset = 0;
  for await (const chunk of readStream(ref, signal)) {
    signal?.throwIfAborted();
    if (!(chunk instanceof Uint8Array) || chunk.length > bytes.length - offset) throw new PreviewError('unreadable');
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  // The durable store verifies the digest while finishing the stream. Never return a partial response.
  signal?.throwIfAborted();
  if (offset !== bytes.length) throw new PreviewError('unreadable');
  return bytes;
}
