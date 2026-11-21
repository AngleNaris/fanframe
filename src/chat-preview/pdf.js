import { AnnotationMode, getDocument, PDFWorker } from 'pdfjs-dist';
import workerSource from 'pdf-worker-source';

export function loadPdf(bytes) {
  // Supply a dedicated Worker, never a document URL. No links, document actions or annotations are mounted.
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  let worker, bridge, task;
  try {
    worker = new Worker(url, { type: 'module' });
    bridge = PDFWorker.create({ port: worker });
    task = getDocument({ data: bytes.slice(), worker: bridge, isEvalSupported: false, enableXfa: false,
      useWasm: false, useWorkerFetch: false, maxImageSize: 16_000_000, canvasMaxAreaInBytes: 36_000_000 });
  } catch (error) {
    bridge?.destroy();
    worker?.terminate();
    URL.revokeObjectURL(url);
    throw error;
  }
  let rejectWorker;
  const workerFailure = new Promise((_, reject) => { rejectWorker = reject; });
  const fail = () => rejectWorker(new Error('PDF worker failed'));
  worker.addEventListener('error', fail);
  let disposing;
  return {
    promise: Promise.race([task.promise, workerFailure]),
    destroy() {
      if (disposing) return disposing;
      disposing = (async () => {
        let deadline;
        try { await Promise.race([task.destroy(), new Promise(resolve => { deadline = setTimeout(resolve, 500); })]); }
        finally {
          clearTimeout(deadline);
          worker.removeEventListener('error', fail);
          bridge.destroy();
          worker.terminate();
          URL.revokeObjectURL(url);
        }
      })();
      return disposing;
    },
  };
}

export function drawPdfPage(page, canvas, width) {
  const basis = page.getViewport({ scale: 1 });
  if (!(basis.width > 0 && basis.height > 0 && Number.isFinite(basis.width + basis.height))) throw new Error('Invalid page size');
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const scale = Math.min(width / basis.width, 2, 4096 / (dpr * Math.max(basis.width, basis.height)),
    Math.sqrt(9_000_000 / basis.width / basis.height) / dpr);
  const view = page.getViewport({ scale });
  canvas.width = Math.max(Math.floor(view.width * dpr), 1);
  canvas.height = Math.max(Math.floor(view.height * dpr), 1);
  canvas.style.width = `${Math.floor(view.width)}px`;
  return page.render({ canvas, viewport: view, transform: [dpr, 0, 0, dpr, 0, 0], annotationMode: AnnotationMode.DISABLE });
}
