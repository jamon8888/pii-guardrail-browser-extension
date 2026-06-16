---
name: svelte-ui-conventions
description: "Use when adding or modifying popup/options UI, content-script site adapters for a chat app, or shared banner/overlay/dialog components. Examples: \"add a settings toggle\", \"add support for a new chat site\", \"change the review banner\""
---

# Svelte & UI Conventions

## Popup / Options (Svelte 5)

- `src/popup/components/` — popup UI shown from the toolbar icon.
- `src/options/components/` — the extension's settings page.
- Both use Svelte 5; check `svelte.config.js` and `tsconfig.svelte.json` for the active compiler settings before introducing a pattern not already used nearby.
- Run `npm run check:svelte` after touching any `.svelte` file — it runs `svelte-check` against `tsconfig.svelte.json` and is part of `npm run validate:ci`.

## Content Scripts & Site Adapters

- `src/content/` — paste interception logic shared across all supported chat apps.
- `src/content/site-adapters/` — one adapter per supported chat app (ChatGPT, Claude, Gemini). Each adapter encapsulates the DOM selectors and quirks for its site so the shared interception logic stays site-agnostic.
- Adding support for a new chat app means adding a new adapter here, not branching the shared interception logic by hostname.

## Shared UI Primitives (`src/ui/`)

| Directory | Purpose |
|-----------|---------|
| `src/ui/banner/` | The de-anonymization/review banner (`de-anon-banner.ts`) |
| `src/ui/overlay/` | Full review overlay shown before replacing detected spans |
| `src/ui/cancel-decision-dialog/` | Confirmation dialog when cancelling a pending decision |
| `src/ui/clipboard-toast/` | Toast feedback after clipboard operations |
| `src/ui/critical-local-ai-modal/` | Modal shown when Local AI hits a critical state (e.g. insufficient memory) |
| `src/ui/page-status-chip/` | Per-page status indicator |
| `src/ui/scanning-indicator/` | In-progress detection indicator |
| `src/ui/shared/` | Primitives reused across the above (styling, common widgets) |

When adding a new UI surface, check `src/ui/shared/` first for an existing primitive before building a new one.

## i18n

UI strings go through `src/shared/i18n.ts`, which loads locale bundles from `_locales/`. Add new strings to the locale message bundles rather than hardcoding text in components.

## Testing

UI component tests live under `tests/ui/`. The Jest config stubs Svelte (`tests/mocks/svelte-stub.ts`, `svelte-component-stub.ts`) so tests exercise wrapper/lifecycle logic (e.g. `overlay.ts`) without a real Svelte renderer — write tests at that wrapper level, not by rendering full `.svelte` trees.
