const KiB = 1024;
const MiB = 1024 * KiB;
const textExtensions = new Set([
  'txt', 'log', 'text', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'conf',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'go', 'rs', 'java', 'kt', 'py', 'rb', 'sh',
  'ps1', 'bat', 'cmd', 'sql', 'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'css', 'scss',
  'xml', 'vue', 'patch', 'diff', 'lua', 'swift', 'r', 'properties',
]);

export const rasterTypes = Object.freeze({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' });
const mediaTypes = Object.freeze({ mp4: 'video/mp4', webm: 'video/webm', wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac' });

export function formatFor(name) {
  if (typeof name !== 'string') return undefined;
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (extension === 'pdf') return { kind: 'pdf', maxBytes: 16 * MiB };
  if (extension === 'md' || extension === 'markdown') return { kind: 'markdown', maxBytes: 256 * KiB };
  if (extension === 'csv' || extension === 'tsv') return { kind: 'table', maxBytes: 512 * KiB, delimiter: extension === 'csv' ? ',' : '\t' };
  if (textExtensions.has(extension)) return { kind: 'text', maxBytes: 512 * KiB };
  if (Object.hasOwn(rasterTypes, extension)) return { kind: 'image', mime: rasterTypes[extension], maxBytes: 16 * MiB };
  if (Object.hasOwn(mediaTypes, extension)) {
    const mime = mediaTypes[extension];
    return { kind: mime.startsWith('video/') ? 'video' : 'audio', mime, maxBytes: 32 * MiB };
  }
  return undefined;
}
