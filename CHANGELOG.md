# Changelog

## 1.10.0-beta.1

First public-release candidate under the npm package name `fanframe`.

- Chinese display name: 繁界. English display name: FanFrame.
- Add the approved four-point star and symmetric radial-line SVG icon.
- Export Chinese and English plugin metadata, icon and license in the npm package.
- Align the Cordis entry and Client module identifier with `fanframe`.
- Preserve the existing interface behavior, including catalog-on-open scrolling and user-navigation protection.
- Restrict the declared DSH engine to the tested `0.2.1-rc.3` baseline. Broader compatibility is not established.

This is not an in-place npm upgrade of `fan-de-hai`. Disable the old plugin before enabling `fanframe`; never run both together. No attachment-storage, image-loader or Codex image-viewer fix is claimed.
