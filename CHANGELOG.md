# Changelog

## 1.10.0

- Consolidate the local beta.24–beta.33 compatibility and sidebar work on top of the published beta.23 baseline.
- Preserve native slot children, control semantics and current model-option ownership on DSH 0.2.2.
- Keep the 52px independent rail and its local wheel handling. Put unpin in the icon context menu when the native menu capability is available, retaining the native fallback otherwise.
- Retain immediate native question-card content layout for idle same-state edits, while keeping real toggles and in-progress animation paths.
- Add the initial group-visibility guard and the expanded nested new-session row's native right-gutter minimum. Do not claim coverage of delayed asynchronous folding or actual equal gutters without real UI verification.
- Prepare the stable npm version for the latest channel. Runtime code matches local beta.33 apart from its version marker; distribution metadata and public documentation change.

Engineering checks are not a latency benchmark, persistence test or full visual acceptance. Original-window loading, latest affected interactions, desktop geometry, real saving, input performance and crash causality remain separately unverified. This release does not establish that all previously reported UI or performance defects are solved.
