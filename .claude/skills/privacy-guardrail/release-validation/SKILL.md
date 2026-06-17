---
name: release-validation
description: "Use before opening a pull request, before a release build, or when checking the privacy boundary, extension permissions, or packaging a release. Examples: \"run the privacy boundary check\", \"validate before PR\", \"package a release\", \"check extension permissions\""
---

# Release & Privacy Validation

## Privacy Boundary Check

```bash
npm run check:privacy-boundary
```

CI-safe, no model assets required. Scans `src/` for forbidden runtime network primitives (`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, remote `importScripts`/`<script src="http...">`), scans `package.json` for analytics/telemetry/crash-reporting dependency name patterns, and verifies Transformers.js stays local-only in `src/offscreen/ner-provider.ts`.

The only approved exception is the `fetch(url, { method: 'HEAD' })` local-asset probe in `src/offscreen/ner-provider.ts` (and the locale-bundle `fetch` in `src/shared/i18n.ts`). A project hook (`scripts/claude-hooks/pre-commit-privacy-check.cjs`) runs this automatically on `git commit` and blocks the commit on failure — but run it manually too when iterating on `src/offscreen/`, `src/background/`, or `package.json` dependencies.

If a future change genuinely needs a new runtime network primitive: document the user-visible reason, prove it cannot upload user content (clipboard, prompts, responses, detected entities, vault data, feedback logs, model input), and add a narrow entry to `ALLOWED_RUNTIME_FINDINGS` in `scripts/check-privacy-boundary.js`.

## Permission Check

```bash
npm run check:permissions
```

Verifies `manifest.json` only declares permissions the code actually uses.

## Pull Request Validation

```bash
npm run validate:ci
```

Model-free — runs Jest, Svelte checks, version alignment, the permission check, the privacy-boundary scan, Rust tests, and a model-free extension build. **Run this before opening a PR.**

## Release-Strict Validation

```bash
npm run validate:release-strict
```

Like `validate:ci` but requires prepared BardsAI model assets (see the `model-pipeline` skill) and fails if they're missing. Use this before cutting an actual release, not for routine PRs.

## Packaging a Release

```bash
npm run package:dry-run    # preview package contents without writing an archive
npm run package:release    # produce the release ZIP + checksum
```

Before packaging: confirm `npm run version:check` passes (version alignment across `package.json`/`manifest.json`), and that `THIRD_PARTY_NOTICES.md` is current if bundled model/runtime/font assets changed.

## Troubleshooting

- **`validate:release-strict` fails on missing BardsAI assets** — expected by design; either prepare the assets (`model-pipeline` skill) or use `validate:ci` for a routine PR.
- **Privacy boundary check fails on a legitimate new network call** — see "Privacy Boundary Check" above for the allowlist process; don't silently delete the finding.
