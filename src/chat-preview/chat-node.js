import { rasterTypes } from './limits.js';
import { fileAt } from './read-attachment.js';

export const attachmentNodeKind = 'dsh-chat-preview-attachment';

function isHumanInput(event) {
  return event?.type === 'user/message' && event.surfaceOp === 'append' && event.data?.source?.kind === 'user';
}

const imageSuffix = new Map(Object.entries(rasterTypes).map(([ext, mime]) => [mime, ext]));

function itemAt(event, index) {
  const file = fileAt(event, event.seq, index);
  if (file) return { index, name: file.name, bytes: file.bytes };
  const block = event.data.content[index];
  const ref = block?.type === 'image' ? block.attachment : undefined;
  const suffix = imageSuffix.get(ref?.mediaType);
  if (!suffix || typeof ref.attachmentId !== 'string' || !Number.isSafeInteger(ref.bytes) || ref.bytes <= 0 ||
      !Number.isSafeInteger(ref.width) || ref.width <= 0 || !Number.isSafeInteger(ref.height) || ref.height <= 0) return undefined;
  return { source: 'image', index, name: ref.name || `image.${suffix}`, bytes: ref.bytes, attachment: ref };
}

export const attachmentDefinition = {
  kind: attachmentNodeKind,
  target: 'chat',
  match: {
    'user/message'(event) {
      if (!isHumanInput(event) || !Array.isArray(event.data.content) ||
          !event.data.content.some((_, index) => itemAt(event, index))) return null;
      return { id: String(event.seq), role: 'start' };
    },
  },
  start(_context, { event, location }) {
    const files = event.data.content.map((_, index) => itemAt(event, index)).filter(Boolean);
    return { seq: event.seq, files, location };
  },
  update(context) { return context.state; },
  buildViewNode({ key, id, state }) {
    return state?.files.length ? {
      key, id, kind: attachmentNodeKind, target: 'chat', anchorSeq: state.seq,
      location: state.location, visibility: 'visible', groupTree: 'turn',
      data: { seq: state.seq, files: state.files },
    } : null;
  },
};
