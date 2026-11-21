import { fileAt, PreviewError, readVerifiedFile } from './read-attachment.js';

export const name = 'fanframe-chat-preview-host';
export const inject = ['connection', 'sessionQuery', 'attachments'];
export const routePath = '/api/dsh-chat-preview.attachment';

const headers = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/octet-stream',
  'Content-Disposition': 'attachment',
  'Content-Security-Policy': "sandbox; default-src 'none'",
  'X-Content-Type-Options': 'nosniff',
};
const errorResponse = status => new Response(null, { status, headers });
const statuses = { tooLarge: 413, unsupported: 415, unreadable: 422 };

export function createReadHandler({ readEvent, readStream, signal: lifetime }) {
  let active = 0;
  return async request => {
    const params = new URL(request.url).searchParams;
    const sessionId = params.get('session');
    const rawSeq = params.get('seq');
    const rawIndex = params.get('index');
    if (params.size !== 3 || !sessionId || !/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(sessionId) ||
        !/^[1-9]\d{0,14}$/.test(rawSeq ?? '') || !/^(0|[1-9]\d{0,7})$/.test(rawIndex ?? '')) return errorResponse(400);

    if (active >= 2) return errorResponse(503);
    if (request.signal.aborted || lifetime.aborted) return errorResponse(499);
    active++;
    const signal = AbortSignal.any([request.signal, lifetime, AbortSignal.timeout(15_000)]);
    try {
      const seq = Number(rawSeq);
      const result = await readEvent({ sessionId, seq }, signal);
      const file = fileAt(result.target, seq, Number(rawIndex));
      if (!file) return errorResponse(404);
      const bytes = await readVerifiedFile(file, readStream, signal);
      return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.byteLength) } });
    } catch (error) {
      if (signal.aborted) return errorResponse(signal.reason?.name === 'TimeoutError' ? 503 : 499);
      if (error instanceof PreviewError) return errorResponse(statuses[error.code] ?? 500);
      if (['SESSION_QUERY_EVENT_NOT_FOUND', 'SESSION_QUERY_NOT_FOUND', 'ATTACHMENT_NOT_FOUND'].includes(error?.code)) {
        return errorResponse(404);
      }
      if (error?.code?.startsWith?.('ATTACHMENT_')) return errorResponse(422);
      return errorResponse(503);
    } finally {
      active--;
    }
  };
}

export function apply(ctx) {
  if (typeof ctx.connection.fetch?.register !== 'function' || typeof ctx.sessionQuery.readEvent !== 'function' ||
      typeof ctx.attachments.readFileStream !== 'function') return;
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort(), 'dsh-chat-preview: abort pending reads');
  // Exact Connection routes require an authenticated owner. Do not mount this on the raw web server.
  ctx.effect(() => ctx.connection.fetch.register({
    path: routePath, methods: ['GET'], requestBody: 'buffered',
    fetch: createReadHandler({
      readEvent: (query, signal) => ctx.sessionQuery.readEvent(query, signal),
      readStream: (file, signal) => ctx.attachments.readFileStream(file, signal),
      signal: lifetime.signal,
    }),
  }), 'dsh-chat-preview: owner attachment route');
}
