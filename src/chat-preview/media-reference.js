import { formatFor } from './limits.js';

export function mediaKind(name) {
  const kind = formatFor(name)?.kind;
  return kind === 'audio' || kind === 'video';
}

export function parseMediaReference(code) {
  if (typeof code !== 'string' || code.length > 8192) return null;
  let data;
  try { data = JSON.parse(code); } catch { return null; }
  if (!data || Array.isArray(data) || typeof data !== 'object' ||
      Object.keys(data).some(key => key !== 'path' && key !== 'title') ||
      typeof data.path !== 'string' || data.path.length > 4096 ||
      !/^(?:[a-z]:[\\/]|\/(?!\/))/i.test(data.path) || /[\x00-\x1f\x7f]/.test(data.path)) return null;
  if (!formatFor(data.path)) return null;
  const title = data.title;
  if (title !== undefined && (typeof title !== 'string' || title.length > 160 || !title.trim() || /[\x00-\x1f\x7f]/.test(title))) return null;
  return { path: data.path, title: title?.trim() || data.path.split(/[\\/]/).at(-1) };
}

export function findDelivery(turns, path) {
  if (!turns || !path) return undefined;
  for (const turn of turns.values()) {
    const presented = turn.data?.get('deliverables')?.presented;
    if (!Array.isArray(presented)) continue;
    const match = presented.find(item => item?.path === path);
    if (match) return match;
  }
  return undefined;
}
