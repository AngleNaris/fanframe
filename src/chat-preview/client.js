import en from './en.json';
import zh from './zh.json';
import styles from './preview.css';
import { formatFor } from './limits.js';
import { decodeText, parseTable } from './text.js';
import { markdownNodes } from './markdown.js';
import { attachmentDefinition, attachmentNodeKind } from './chat-node.js';
import { deliveredFiles, readDelivery, splitDeliveries } from './deliveries.js';
import { findDelivery, parseMediaReference } from './media-reference.js';

const namespace = 'dsh-chat-preview';
const errorStatus = { 400: 'missing', 401: 'missing', 403: 'missing', 404: 'missing', 413: 'tooLarge', 415: 'unsupported', 422: 'unreadable' };

async function readAttachment(target, file, format, signal) {
  const query = new URLSearchParams({ session: target.sessionId, seq: target.seq, index: file.index });
  const response = await fetch(`./api/dsh-chat-preview.attachment?${query}`, {
    credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
  });
  if (!response.ok) throw new Error(errorStatus[response.status] ?? 'unavailable');
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/octet-stream' || !response.body) {
    await response.body?.cancel();
    throw new Error('unavailable');
  }
  if (file.bytes > format.maxBytes) throw new Error('tooLarge');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(file.bytes);
  let offset = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value.byteLength > bytes.byteLength - offset) throw new Error('unreadable');
      bytes.set(next.value, offset);
      offset += next.value.byteLength;
    }
    if (offset !== bytes.length) throw new Error('unreadable');
    return bytes;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createChatPreviewClient(require) {
    const React = require('react');
    const { createElement: h, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } = React;
    const icons = {
      preview: 'M3 12s3.3-5 9-5 9 5 9 5-3.3 5-9 5-9-5-9-5ZM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
      play: 'M8 5l11 7-11 7V5Z', full: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5', restore: 'M4 9h5V4m6 0v5h5M4 15h5v5m11-5h-5v5',
      close: 'M6 6l12 12M18 6 6 18', back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', retry: 'M20 10a8 8 0 1 0-2.3 7.7M20 4v6h-6',
    };
    function icon(name) {
      return h('svg', { className: 'dcp-icon', width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
      h('path', { d: icons[name] }));
    }
    function control(name, label, action, disabled = false, showLabel = false) {
      return h('button', { type: 'button', className: 'dcp-control', onClick: action, disabled,
        'aria-label': label, title: label }, icon(name), showLabel && label);
    }
    function state(t, status, retry) {
      return h('div', { className: 'dcp-state', role: 'status' }, t(status), retry && control('retry', t('retry'), retry, false, true));
    }

    function Pdf({ bytes, t, retry }) {
      const [document, setDocument] = useState(null);
      const [failure, setFailure] = useState(null);
      const [page, setPage] = useState(1);
      const [renderedPage, setRenderedPage] = useState(0);
      const [width, setWidth] = useState(0);
      const holder = useRef(null);
      const canvas = useRef(null);
      useEffect(() => {
        let active = true, loading;
        const timeout = globalThis.setTimeout(() => {
          if (active) { setFailure('pdfTimeout'); active = false; void loading?.destroy().catch(() => {}); }
        }, 20_000);
        void import('./pdf.js').then(module => {
          if (!active) return;
          loading = module.loadPdf(bytes);
          return loading.promise.then(pdf => { if (active) setDocument({ pdf, draw: module.drawPdfPage }); });
        }).catch(error => { if (active) setFailure(error?.name === 'PasswordException' ? 'pdfLocked' : 'unreadable'); })
          .finally(() => clearTimeout(timeout));
        return () => { active = false; clearTimeout(timeout); void loading?.destroy().catch(() => {}); };
      }, [bytes]);
      useEffect(() => {
        if (!document || !holder.current) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        observer.observe(holder.current);
        return () => observer.disconnect();
      }, [document]);
      useEffect(() => {
        if (!document || !width || !canvas.current) return;
        let active = true, render;
        const element = canvas.current;
        const timeout = globalThis.setTimeout(() => {
          if (active) { active = false; render?.cancel(); setFailure('pdfTimeout'); }
        }, 20_000);
        document.pdf.getPage(page).then(pdfPage => {
          if (!active) return;
          render = document.draw(pdfPage, element, width);
          return render.promise.then(() => { if (active) setRenderedPage(page); });
        }).catch(() => { if (active) setFailure('unreadable'); }).finally(() => clearTimeout(timeout));
        return () => { active = false; clearTimeout(timeout); render?.cancel(); };
      }, [document, page, width]);
      if (failure) return state(t, failure, failure === 'pdfTimeout' ? retry : null);
      if (!document) return state(t, 'rendering');
      const label = t('page', { page, total: document.pdf.numPages });
      return h(React.Fragment, null,
        h('div', { className: 'dcp-pdf-controls' }, control('back', t('previousPage'), () => setPage(n => Math.max(n - 1, 1)), page <= 1),
          h('span', { 'aria-live': 'polite' }, label),
          control('next', t('nextPage'), () => setPage(n => Math.min(n + 1, document.pdf.numPages)), page >= document.pdf.numPages)),
        h('div', { className: 'dcp-page', ref: holder }, renderedPage !== page && state(t, 'rendering'),
          h('canvas', { key: page, ref: canvas, style: { visibility: renderedPage === page ? 'visible' : 'hidden' }, role: 'img', 'aria-label': label })));
    }

    function Media({ view, name, t, inline, onPlayback, onMediaRelease }) {
      const ref = useRef(null);
      const [failed, setFailed] = useState(false);
      useEffect(() => {
        const element = ref.current;
        const url = view.url ?? URL.createObjectURL(new Blob([view.bytes], { type: view.mime }));
        element.src = url;
        // Video loads near the viewport but never starts without a gesture.
        // The audio branch mounts only after its play row is clicked.
        if (inline && view.kind === 'audio') void element.play().catch(() => {});
        return () => {
          if (view.kind !== 'image') { onMediaRelease?.(element); element.pause(); element.removeAttribute('src'); element.load(); }
          else element.removeAttribute('src');
          if (!view.url) URL.revokeObjectURL(url);
        };
      }, [view, inline, onMediaRelease]);
      const image = view.kind === 'image';
      return h('div', { className: `dcp-media dcp-media-${view.kind}` },
        failed && state(t, image ? 'unreadable' : inline ? 'inlineMediaError' : 'mediaError'),
        h(image ? 'img' : view.kind, {
          ref, hidden: failed, onError: () => setFailed(true),
          ...(image ? { alt: name } : { controls: true, controlsList: 'nodownload noremoteplayback',
            disableRemotePlayback: true, disablePictureInPicture: true, playsInline: true,
            preload: 'metadata', 'aria-label': name, onPlay: event => onPlayback?.(event.currentTarget) }),
        }));
    }

    function DocumentBody({ target, file, t, readBytes, readImage, inline = false, name = file.name, onPlayback, onMediaRelease }) {
      const [attempt, setAttempt] = useState(0);
      const [view, setView] = useState({ kind: 'loading' });
      useEffect(() => {
        const controller = new AbortController();
        const timeout = AbortSignal.timeout(20_000);
        const signal = AbortSignal.any([timeout, controller.signal]);
        const format = file.source === 'image' ? { kind: 'image', maxBytes: 16 * 1024 * 1024 } : formatFor(file.name);
        if (!format || file.bytes > format.maxBytes) {
          setView({ kind: 'error', error: format ? 'tooLarge' : 'unsupported' });
          return () => controller.abort();
        }
        setView({ kind: 'loading' });
        void (async () => {
          if (file.source === 'image') {
            const url = await readImage(target.sessionId, file.attachment, signal);
            signal.throwIfAborted();
            return setView({ kind: 'image', url });
          }
          const bytes = await (file.source === 'delivery' ? readBytes(target.sessionId, file, format, signal) :
            readAttachment(target, file, format, signal));
          signal.throwIfAborted();
          if (!bytes.length) return setView({ kind: 'empty' });
          if (format.mime) return setView({ kind: format.kind, mime: format.mime, bytes });
          if (format.kind === 'pdf') {
            if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) return setView({ kind: 'error', error: 'unreadable' });
            return setView({ kind: 'pdf', bytes });
          }
          let text;
          try { text = decodeText(bytes); }
          catch { return setView({ kind: 'error', error: 'encoding' }); }
          if (text === '') return setView({ kind: 'empty' });
          try {
            if (format.kind === 'markdown') setView({ kind: 'markdown', nodes: markdownNodes(h, text) });
            else if (format.kind === 'table') setView({ kind: 'table', ...parseTable(text, format.delimiter) });
            else setView({ kind: 'text', text });
          } catch { setView({ kind: 'error', error: 'unreadable' }); }
        })().catch(error => {
          if (controller.signal.aborted) return;
          const code = error?.code;
          const safeError = ['changed', ...Object.values(errorStatus)].includes(error?.message) ? error.message :
            code === 'workspace-file/too-large' ? 'tooLarge' :
            ['workspace-file/not-found', 'workspace-file/not-regular-file', 'workspace-file/permission-denied', 'gateway/lookup-not-found', 'gateway/forbidden'].includes(code) ? 'missing' : 'unavailable';
          setView({ kind: 'error', error: safeError });
        });
        return () => controller.abort();
      }, [target, file, attempt, readBytes, readImage]);
      switch (view.kind) {
        case 'empty': return state(t, 'empty');
        case 'error': return state(t, view.error, ['unavailable', 'changed'].includes(view.error) ? () => setAttempt(n => n + 1) : null);
        case 'audio':
        case 'video':
        case 'image': return h(Media, { view, name, t, inline, onPlayback, onMediaRelease });
        case 'pdf': return h(Pdf, { bytes: view.bytes, t, retry: () => setAttempt(n => n + 1) });
        case 'markdown': return h('article', { className: 'dcp-markdown' }, view.nodes);
        case 'text': return h('pre', { className: 'dcp-text' }, view.text);
        case 'table': return h(React.Fragment, null,
          view.truncated && h('p', { className: 'dcp-table-note' }, t('tableLimit')),
          h('table', { className: 'dcp-table', 'aria-label': file.name }, h('tbody', null,
            view.rows.map((row, i) => h('tr', { key: i }, row.map((value, j) => h('td', { key: j }, value)))))));
        default: return state(t, 'loading');
      }
    }

    function PreviewDialog({ target, t, dismiss, readBytes, readImage, onPlayback, onMediaRelease }) {
      const list = target.files;
      const [file, setFile] = useState(list.length === 1 ? list[0] : null);
      const [maximized, setMaximized] = useState(false);
      const kind = file?.source === 'image' ? 'image' : formatFor(file?.name)?.kind;
      const canMaximize = kind !== undefined && kind !== 'audio';
      const titleId = useId();
      const dialog = useRef(null);
      const close = useRef(null);
      const body = useRef(null);
      const returnIndex = useRef(null);
      const choices = useRef(new Map());
      useEffect(() => {
        const element = dialog.current;
        element.showModal();
        return () => { if (element.open) element.close(); };
      }, []);
      useEffect(() => {
        if (body.current) body.current.scrollTop = body.current.scrollLeft = 0;
        const previous = file === null && choices.current.get(returnIndex.current);
        if (previous) previous.focus();
        else close.current?.focus({ preventScroll: true });
      }, [file]);
      const title = file?.name ?? t('choose');
      return h('dialog', { ref: dialog, className: `dcp-dialog${maximized ? ' dcp-dialog-maximized' : ''}`, 'aria-labelledby': titleId,
        onCancel: event => { event.preventDefault(); if (maximized) setMaximized(false); else dismiss(); },
        onClick: event => {
          const el = event.currentTarget;
          if (event.target !== el || event.detail === 0) return;
          const rect = el.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) dismiss();
        } },
      h('header', { className: 'dcp-dialog-head' }, list.length > 1 && file && control('back', t('back'), () => { returnIndex.current = file.index; setMaximized(false); setFile(null); }),
        h('h2', { className: 'dcp-dialog-title', id: titleId, title }, title),
        canMaximize && control(maximized ? 'restore' : 'full', t(maximized ? 'restore' : 'fullscreen'), () => setMaximized(value => !value)),
        h('button', { ref: close, className: 'dcp-control', type: 'button', onClick: dismiss, title: t('close'), 'aria-label': t('close') }, icon('close'))),
      h('div', { className: 'dcp-content', ref: body }, file ? h(DocumentBody, { key: file.index, target, file, t, readBytes, readImage, onPlayback, onMediaRelease }) :
        h('ul', { className: 'dcp-choices' }, list.map(item => h('li', { key: item.index },
          h('button', { className: 'dcp-choice', type: 'button', onClick: () => setFile(item),
            ref: element => { if (element) choices.current.set(item.index, element); else choices.current.delete(item.index); } }, item.name))))));
    }

    return {
      inject: ['slots', 'locale', 'uiConversation', 'remote', 'remote.workspaceFiles'],
      apply(ctx) {
        if (typeof ctx.slots.inject !== 'function' || typeof ctx.slots.register !== 'function' ||
            typeof ctx.locale.register !== 'function' || typeof ctx.uiConversation.events?.register !== 'function' ||
            typeof ctx.uiConversation.imageUrl !== 'function' || typeof ctx.remote.workspaceFiles?.stat !== 'function' ||
            typeof ctx.remote.workspaceFiles.readBytes !== 'function') return;
        let current = null, activeMedia = null, playing = null, key = 0;
        const onPlayback = element => {
          if (playing && playing !== element) playing.pause();
          playing = element;
        };
        const onMediaRelease = element => { if (playing === element) playing = null; };
        const mediaHooks = { onPlayback, onMediaRelease };
        const pausePlaying = () => { playing?.pause(); playing = null; };
        const subscribers = new Set();
        const subscribe = listener => { subscribers.add(listener); return () => subscribers.delete(listener); };
        const notify = () => { for (const listener of subscribers) listener(); };
        const get = () => current;
        const publish = next => { current = next; if (next) { activeMedia = null; pausePlaying(); } notify(); };
        const setActiveMedia = next => { activeMedia = next; notify(); };
        const dismiss = (restore = true) => {
          const previous = current;
          if (!previous) return;
          publish(null);
          if (restore) requestAnimationFrame(() => {
            if (!current && previous.trigger.isConnected) previous.trigger.focus({ preventScroll: true });
          });
        };
        const readBytes = (sessionId, file, format, signal) => readDelivery(ctx.remote.workspaceFiles, sessionId, file, format, signal);
        const readImage = (sessionId, attachment) => ctx.uiConversation.imageUrl(sessionId, attachment);
        function PreviewButton({ sessionId, seq, files, t, delivery = false }) {
          const opener = useRef(null);
          useEffect(() => {
            const trigger = opener.current;
            return () => { if (current?.trigger === trigger) dismiss(false); };
          }, [sessionId, seq]);
          if (!sessionId || !files.length) return null;
          return h('div', { className: `dcp-action-row${delivery ? ' dcp-delivery-action' : ''}` },
            h('button', { type: 'button', ref: opener, className: 'dcp-action',
              onClick: event => publish({ key: ++key, sessionId, seq, files, trigger: event.currentTarget }) }, icon('preview'), t('open')));
        }
        function Row({ node, sessionId, t }) {
          return h(PreviewButton, { sessionId, seq: node.data.seq, files: node.data.files, t });
        }
        const fileFor = declared => ({ source: 'delivery', index: declared.index, path: declared.path, name: declared.path.split(/[\\/]/).at(-1) });
        function InlineAsset({ reference, sessionId, useChat, t, kind }) {
          const declared = useChat(snapshot => findDelivery(snapshot.timeline.turns, reference.path));
          const file = useMemo(() => declared && fileFor(declared), [declared]);
          const target = useMemo(() => ({ sessionId }), [sessionId]);
          const holder = useRef(null);
          const [nearby, setNearby] = useState(false);
          useEffect(() => {
            if (!file || !holder.current || nearby) return;
            if (typeof IntersectionObserver !== 'function') { setNearby(true); return; }
            const observer = new IntersectionObserver(entries => {
              if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); setNearby(true); }
            }, { rootMargin: '160px 0px' });
            observer.observe(holder.current);
            return () => observer.disconnect();
          }, [file, nearby]);
          const image = kind === 'image';
          return h('div', { ref: holder, className: image ? 'dcp-inline-image' : 'dcp-inline-video', 'aria-label': reference.title },
            !file ? h('p', { className: 'dcp-inline-notice', role: 'status' }, t('inlineNotDelivered')) : nearby ?
              h(DocumentBody, { target, file, t, readBytes, readImage, inline: true, name: image ? reference.title : file.name, ...mediaHooks }) :
              h('div', { className: 'dcp-video-pending' }, !image && icon('play'), h('span', null, reference.title)));
        }
        function InlineFileRow({ reference, sessionId, useChat, t }) {
          const turns = useChat(snapshot => snapshot.timeline.turns);
          const audio = formatFor(reference.path)?.kind === 'audio';
          const trigger = useRef(null);
          const [owner] = useState(() => Symbol('inline file'));
          const [unavailable, setUnavailable] = useState(false);
          const selected = useSyncExternalStore(subscribe, () => activeMedia?.owner === owner ? activeMedia : null);
          useEffect(() => () => {
            if (activeMedia?.owner === owner) setActiveMedia(null);
            if (current?.owner === owner) dismiss(false);
          }, [owner]);
          function open() {
            if (selected) return setActiveMedia(null);
            // Only the matching Session record supplies the actual path sent to Remote.
            const declared = findDelivery(turns, reference.path);
            setUnavailable(!declared);
            if (!declared) return;
            const file = fileFor(declared);
            if (audio) setActiveMedia({ owner, sessionId, file });
            else publish({ key: ++key, owner, sessionId, files: [file], trigger: trigger.current });
          }
          const label = selected ? t('collapseMedia', { name: reference.title }) :
            t(audio ? 'playMedia' : 'previewNamed', { name: reference.title });
          return h('div', { className: 'dcp-inline-reference' },
            h('div', { className: `dcp-inline-rail${selected ? ' dcp-inline-rail-active' : ''}` },
              h('button', { ref: trigger, className: 'dcp-inline-trigger', type: 'button', title: label, 'aria-label': label, onClick: open },
                icon(selected ? 'close' : audio ? 'play' : 'preview'), !selected && h('span', null, reference.title),
                !selected && h('small', null, t(audio ? 'play' : 'openShort'))),
              selected && h(DocumentBody, { target: selected, file: selected.file, t, readBytes, readImage, inline: true, ...mediaHooks })),
            unavailable && h('p', { className: 'dcp-inline-notice', role: 'status' }, t('inlineNotDelivered')));
        }
        function MediaFence({ code, streaming, sessionId, useChat, t, children }) {
          const reference = streaming ? null : parseMediaReference(code);
          if (!reference || !sessionId || !useChat) return children;
          const kind = formatFor(reference.path)?.kind;
          const component = kind === 'image' || kind === 'video' ? InlineAsset : InlineFileRow;
          return h(component, { key: `${sessionId}:${reference.path}`, reference, sessionId, useChat, t, kind });
        }
        function DeliveryRow({ turn, seq, sessionId, t }) {
          const { others } = splitDeliveries(deliveredFiles(turn));
          return h(PreviewButton, { sessionId, seq, files: others, t, delivery: true });
        }
        function Overlay({ t }) {
          const target = useSyncExternalStore(subscribe, get);
          return h(React.Fragment, null, h('style', null, styles), target &&
            h(PreviewDialog, { key: target.key, target, t, readBytes, readImage, dismiss: () => dismiss(), ...mediaHooks }));
        }
        ctx.effect(() => ctx.locale.register(namespace, { en, zh }), 'dsh-chat-preview: translations');
        ctx.effect(() => ctx.uiConversation.events.register(attachmentDefinition), 'dsh-chat-preview: message attachment definition');
        ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: attachmentNodeKind,
          locale: namespace }, Row));
        ctx.slots.inject('conversation.chat.markdown.fence', () => ctx.slots.register({ name: 'conversation.chat.markdown.fence',
          id: `${namespace}:media-reference`, key: 'dsh-media', locale: namespace }, MediaFence));
        ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({ name: 'conversation.chat.turnTail',
          id: `${namespace}:deliveries`, order: 100, locale: namespace }, DeliveryRow));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: namespace, locale: namespace }, Overlay));
        ctx.on('connection/reset', () => { dismiss(false); setActiveMedia(null); pausePlaying(); });
        ctx.effect(() => () => { dismiss(false); setActiveMedia(null); pausePlaying(); subscribers.clear(); }, 'dsh-chat-preview: preview lifetime');
      },
    };
}
