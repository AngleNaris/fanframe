/** 繁界（FanFrame）：登记可视化工具和简短使用指引，不在 Host 执行 HTML。 */
export const inject = []

const MAX_HTML_BYTES = 256 * 1024
const PRESENTATION_VERSION = 2

const VISUALIZE_WHEN = 'When fanframe_visualize is available, call it once before the final answer if reliable data shows a multi-point trend, distribution, composition, or meaningful differences across groups. Do this without waiting for a request to draw. Use the simplest useful chart and keep the takeaway in text.'
const VISUALIZE_SKIP = 'Skip the card if the user asks for text only or a conflicting format, if the answer is a short lookup, if the data is missing or unreliable, or if the chart would just repeat the answer without helping. Never invent values, units, or sources.'
const GRAPHICS_FIRST = 'If a graphic can express it, use the graphic instead of words. Encode trends and relationships with position, shape and color; keep only necessary labels, units, legends and accessible equivalents.'

export function apply(ctx) {
  // Keep the existing UI usable in a profile without the tool registry.
  ctx.inject(['tools'], (scope) => {
    scope.tools.register({
      name: 'fanframe_visualize',
      description: 'Display a lightweight, self-contained interactive HTML card in the reply. Default to one card for a reliable multi-point trend, distribution, composition, or comparison across groups; no explicit drawing request is needed. Skip short lookups, conflicting formats, unreliable data and redundant charts. Inline CSS/JavaScript, SVG and canvas are supported; external resources, requests and host APIs are not provided. The card renders only after this call succeeds. Its result is retained with the conversation; interactive state is not saved.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'html'],
        properties: {
          title: { type: 'string', description: 'Short card title, at most 160 UTF-16 code units after trimming.' },
          html: { type: 'string', description: 'Self-contained HTML fragment with inline CSS/JS, up to 256 KiB UTF-8. No Markdown fences or document wrapper. ' + GRAPHICS_FIRST + ' Use --fanframe-viz-series-1 (soft amber) and --fanframe-viz-series-2 (mist blue) for comparable series, --fanframe-viz-highlight (teal) for the active mark, and --fanframe-viz-muted / --fanframe-viz-border for axes and guides. Keep distinct shape or stroke cues. Where it helps reading, gently emphasize the actual data point on hover and fade it back on leave; no perpetual motion, and respect reduced motion. Built-in stroke icons: <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><use href="#fanframe-icon-sun"/></svg>. Names: sun, cloud, cloud-sun, rain, storm, snow, wind, thermometer, trend-up, trend-down, calendar, clock, info, check, chevron-right. Use icons for recognizable concepts, not ornament; provide a label when the meaning is not evident or for an icon-only control. Use labeled native <button type="button">, <input type="range">, single-choice <select> with <option>, and <input type="checkbox">; FanFrame styles them. Use standard click/input/change events. SVG/canvas remain available. The card supplies the surface, border and title: no duplicate title, wrapper, gradient, fixed viewport height, focus outline or ring.' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'version', 'title', 'html'],
          properties: {
            kind: { type: 'string', const: 'fanframe.visualize' },
            version: { type: 'integer', const: PRESENTATION_VERSION },
            title: { type: 'string' },
            html: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: `Visualization ready: ${value.title}` }],
        presentationMeta: (_args, value) => value,
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        exec.signal.throwIfAborted()
        if (!args || typeof args.title !== 'string' || typeof args.html !== 'string') {
          throw new Error('title and html must be strings')
        }
        const title = args.title.trim()
        if (!title || title.length > 160) throw new Error('title must contain 1–160 UTF-16 code units')
        if (!args.html.trim()) throw new Error('html must not be blank')
        if (Buffer.byteLength(args.html, 'utf8') > MAX_HTML_BYTES) throw new Error('html exceeds 256 KiB UTF-8')
        return { kind: 'fanframe.visualize', version: PRESENTATION_VERSION, title, html: args.html }
      },
    })
    scope.inject(['systemPrompt'], (promptScope) => promptScope.systemPrompt.section({
      name: 'fanframe-visualization-guidance',
      order: 800,
      text: `${VISUALIZE_WHEN}\n${VISUALIZE_SKIP}\n${GRAPHICS_FIRST}\nFor example, compare daily highs and lows in a week-long forecast with one chart; answer a single day's high in text. Use the built-in FanFrame controls only when interaction adds value.`,
    }))
  })
}
