# Changelog

## 1.10.0-beta.16 — 2026-11-01 (prerelease)

- Match the native model-name text exactly: the slider rail, active fill and right-hand current values all use the same host tertiary label token as the native Codex model row, without independent color mixing or opacity.
- Preserve the 1px stroke, ticks, diamond, hover, geometry and all model/preference behavior. Cover exact color equality in both themes and live palette changes.

## 1.10.0-beta.15 — 2026-11-01 (local, unpublished)

- Subdue the model-slider rail and active fill against the host background, darkening both in the dark theme while keeping the rail slightly more prominent than the unchanged ticks.
- Preserve the single 1px stroke, geometry, diamond, hover, motion and all selection/persistence behavior. Add a targeted dark-theme paint regression.

## 1.10.0-beta.14 — 2026-11-01 (local, unpublished)

- Correct the overly heavy model-slider rail reported in the installed screenshot: use a single 1px visible rail/fill and remove both engraved-edge layers.
- Preserve the original length, endpoint alignment, centered 6px ticks, 10px diamond, hover, transitions and native input geometry. Keep all selection and persistence code unchanged.
- Update thin-stroke and symmetric-exposure regression checks; installed visual acceptance remains separate.

## 1.10.0-beta.13 — 2026-11-01 (local, unpublished)

- Apply the approved local slider refinement: enlarge the diamond square from 8px to 10px and keep it in front of the scale; center 6px tick marks across the unchanged 2px rail with equal exposure above and below.
- Add restrained, solid half-pixel internal rail edges for a shallow engraved appearance, without outer shadows, gradients, extra borders or layout changes. Keep the neutral rail subtly stronger than ticks in both light and dark themes.
- Preserve endpoint alignment, native input geometry, purple thumb-only hover, transitions and all model/preference selection, confirmation and persistence logic. Extend geometry, layering and theme-paint regressions; real Desktop acceptance remains separate.

## 1.10.0-beta.12 — 2026-11-01 (local, unpublished)

- Align the first and last model-slider tick edges inside the unchanged rail endpoints. Keep centered intermediate ticks, track length, 2px stroke, thumb behavior and persistence untouched.
- Add precise browser-geometry regressions for both endpoint edges; the previous version protruded by half a CSS pixel on each side.

## 1.10.0-beta.11 — 2026-11-01 (local, unpublished)

- Refine the approved compact model sliders with square diamond thumbs, purple thumb-only hover, muted theme-adaptive rails and clearer ticks. Preserve the existing track length, 2px stroke and native model entry.
- Add interruptible 100ms pointer and 140ms discrete position transitions to the visual thumb and fill. Keep the native range input for interaction/accessibility and respect reduced motion.
- Preserve the released effort through synchronous stale snapshots and the gap between RPC completion and authoritative projection. Unlock only on confirmation; handle native error snapshots, bounded sync uncertainty, model changes and unload cleanup without a second persistence path.
- Expand synthetic engineering regressions for pending-value stability, early RPC success, delayed confirmation, rollback, hover, motion, light-theme readability and cleanup. These checks do not substitute for installed Desktop VIS/FLOW or real persistence acceptance.

## 1.10.0-beta.10 — 2026-10-31 (local, unpublished)

- Read model-control ordering from the real Slot entry's `options.priority`, placing the decorator above the original Codex occupant rather than silently below it.
- Preserve Codex's supplied label fallback and mount the existing slider bridge when rc.5 does not provide a child-slot renderer. Do not replace the native model picker or its controllers.
- Correct the regression fixture to match render-erased Slot entries and cover the no-child-renderer path. Keep real Desktop VIS/FLOW and persistence checks separate from synthetic engineering tests.

## 1.10.0-beta.9 — 2026-10-31 (local candidate, not installed or published)

- Animate the outer occupied height when a task dock or goal first mounts, alongside the existing content fade. Yield immediately to interaction, native animation, reduced motion and removal; restore owned styles on cleanup.
- Fade newly available activity, usage/cache and context-meter information without replaying ordinary numeric updates or historical content.
- Add the approved compact, square-thumb sliders for Codex reasoning effort, supported speed modes and output detail. Decorate the original registered component and reuse its controllers; preserve its model search/selection, native hints and persistence scope.
- Preview drag/keyboard changes and save only the final value without closing the menu. Preserve default-value semantics, pending/readonly/locked states, failure rollback, capability changes and unload cleanup. Keep unknown controllers/capabilities on the native path.

This candidate is engineering-verified with synthetic controllers and real browser DOM/WAAPI fixtures only. DSH `0.2.1-rc.5` product VIS/FLOW and Host persistence are not verified; no installed Desktop files, npm tags or published archives are changed.

## 1.10.0-beta.8 — 2026-10-30

- Expand the declared DSH engine range to `>=0.2.1-rc.1 <=0.2.1-rc.6`, including both endpoints, as requested by the maintainer.
- Update the package version and client diagnostic marker. Keep beta.7 interface behavior, RPC, message handling and persistence unchanged.

The actual verification baseline remains DSH Desktop `0.2.1-rc.3`; the other versions in the declared range have not been individually tested. This range excludes `0.2.1-rc.7` and the stable `0.2.1` release.

## 1.10.0-beta.7 — 2026-10-30

This release includes the local beta.2–beta.6 improvements since the public beta.1:

- Add 100ms paint-only transitions to default controls while preserving native animation, transition and inline ownership.
- Add 140ms opacity entry/exit for identified native surfaces and retain 180ms disclosure behavior. Do not copy editable content, media, scrolled viewports or large trees for exit effects.
- Restore theme-adaptive Settings navigation hover feedback and animate existing visible border and structural stroke colors without adding borders, shadow layers or focus rings.
- Give the composer distinct hover and focus-within stroke colors. Yield pointer-owned colors on focus so native focus paint retains ownership.
- Fade newly mounted task lists, goal bars and local submission echoes in for 140ms. Skip initial/history rows and preserve an unambiguous echo acknowledgement without replaying the fade.
- Preserve editable text marks and the native caret. Keep non-editable keyboard focus cues without creating an outer focus ring.
- Align the new-session button with the existing workspace actions and adapt scoped Markdown text to the native light/dark theme while retaining the dark palette.
- Expand lifecycle, reduced-motion, ownership, history and acknowledgement regressions. Do not change message content, sending, scrolling or persistence contracts.

Compatibility remains limited to DSH Desktop `0.2.1-rc.3`. This is a beta release, not a broader compatibility or performance guarantee. Earlier local-only candidates below remain unpublished.

## 1.10.0-beta.6 (local candidate, not published)

- Restore visible, theme-adaptive Settings navigation hover feedback while preserving the selected state and existing 100ms paint timing.
- Add pointer-path-only color feedback to existing visible borders and structural shadow strokes. Preserve geometry, shadow layers, native hover/paint owners, disabled/error states and later inline updates; do not create borders, shadows or focus rings.
- Give the native composer distinct hover and focus-within stroke colors. Retain its original half-pixel stroke geometry, native caret, authored text marks and workspace-chooser variant.
- Fade newly mounted task docks, objective bars and local transcript submission echoes in for 140ms. Preserve 180ms disclosure motion, skip initial/history rows, and continue an unambiguous same-batch echo acknowledgement from its current opacity rather than restarting.
- Add lifecycle, reduced-motion, native-ownership, history, acknowledgement and simultaneous disclosure regressions. No message content, send handlers, scrolling or persistence contracts are changed.

This is an unpublished local repair for DSH `0.2.1-rc.3`. Engineering fixtures and their screenshots do not establish actual-client loading or product VIS/FLOW acceptance.

## 1.10.0-beta.5 (local candidate, not published)

- Align the new-session button's trailing edge with the rightmost native workspace action's complete hover box. Follow native resize and header changes without altering the leading edge, list gutter, collapsed caption controls or handlers.
- Follow the host's light/dark theme for scoped Markdown text. Preserve the dark palette exactly; lower only HSL lightness in light mode while retaining hue and saturation. Existing backgrounds, borders, readable keycaps and syntax-block colors are unchanged.
- Add composed-alpha contrast, theme-switching, scope, dark-color preservation and trailing-edge geometry regressions. No settings, motion durations or user content are changed.

This is an unpublished local repair for DSH `0.2.1-rc.3`. Isolated engineering checks do not establish actual-client loading or product VIS/FLOW acceptance.

## 1.10.0-beta.4 (local candidate, not published)

- Exclude editable content, text inputs and textboxes from label-only keyboard focus underlines and internal icon markers. Keep native caret behavior, authored rich-text marks, non-editable button cues and all existing motion durations.
- Add regression cases for the chat-style contenteditable editor, inherited/plaintext editability, readonly fields and non-text input controls. No global text-decoration reset or new outer focus ring is introduced.

This is an unpublished local repair for DSH `0.2.1-rc.3`. Engineering fixtures do not establish actual-client loading or product VIS/FLOW acceptance.

## 1.10.0-beta.3 (local candidate, not published)

- Fix default controls being excluded from 100ms color transitions merely because they have an independent native opacity/transform entrance. Keep native paint animations, transition longhands, explicit opt-outs and inline owners protected.
- Ignore inactive media/supports conditions for control ownership; update when media conditions change and remove all owned query listeners on disposal. Native surface ownership and existing motion durations remain unchanged.
- Verify the ownership repair with 28/28 isolated Chromium assertions (the previous local candidate passes 14/28), all 22 engineering suites at 582/582, and 475/475 with the default CSS continuously enabled. These do not establish actual-client loading or product VIS/FLOW acceptance.

This is an unpublished local repair for DSH `0.2.1-rc.3`. No publication or broader compatibility is claimed.

## 1.10.0-beta.2 (local candidate, not published)

- Add 100ms paint-only transitions to default controls in a low-priority CSS layer; preserve native transition/animation owners and inline updates.
- Add 140ms opacity-only entry/exit for identified native surfaces, including the installed rc.3 shell's Modal. Preserve geometry/material and keep the role-less Tooltip's native 150ms CSS animation.
- Extend the existing 180ms disclosure fallback to shared controls, plugin-inventory cards and native details outside chat.
- Keep user input, active media, scrolled viewports and large trees out of new exit copies; these surfaces still close immediately. Respect reduced motion without globally disabling essential host animations.

This is an unpublished local increment. Isolated engineering regressions do not establish product VIS/FLOW acceptance. The shell asset/class adapters remain pinned to DSH `0.2.1-rc.3`.

## 1.10.0-beta.1

First public-release candidate under the npm package name `fanframe`.

- Chinese display name: 繁界. English display name: FanFrame.
- Add the approved four-point star and symmetric radial-line SVG icon.
- Export Chinese and English plugin metadata, icon and license in the npm package.
- Align the Cordis entry and Client module identifier with `fanframe`.
- Preserve the existing interface behavior, including catalog-on-open scrolling and user-navigation protection.
- Restrict the declared DSH engine to the tested `0.2.1-rc.3` baseline. Broader compatibility is not established.

This is not an in-place npm upgrade of `fan-de-hai`. Disable the old plugin before enabling `fanframe`; never run both together. No attachment-storage, image-loader or Codex image-viewer fix is claimed.
