# Changelog

## 1.11.1 — 2026-11-21

- Render raster images accidentally written as `dsh-media` in place when their exact paths match deliveries in the same session. Undelivered files are not read. Native Markdown images remain unchanged.

## 1.11.0 — 2026-11-20

- Built-in chat file preview. Existing `dsh-media` references, native file cards, downloads, and file access rules stay intact. Disable the standalone `dsh-chat-preview` bundle before updating.
- Match inline video size and left alignment to native images. Keep playback paused initially and preserve native fullscreen. Audio and documents use compact rows.
- Increase contrast between the three neutral prose tones, especially in light themes. Keep semantic colors, selection and layout intact, and use the system text color in forced-colors mode.
- Keep inline visualization cards, native interactive controls, built-in SVG symbols and replay of previously generated cards.

## 1.10.0

- Added square-corner styling, improved chat reading colors and short UI transitions, and refined sidebar and plugin-list behavior.
- Retained the host's native buttons and interactions. Respect reduced-motion preferences for added animations.
