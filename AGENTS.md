# Privacy Guardrail — Project Guide

Manifest V3 Chrome extension that detects PII before paste into supported LLM
chat apps (ChatGPT, Claude, Gemini). Detection is local-only: deterministic
Rust→WASM recognizers plus optional transformer NER via ONNX Runtime Web. No
pasted text leaves the browser. No telemetry. Public beta (`0.3.0`),
developed at DFKI.

## Repository Map

| Path | Purpose |
|------|---------|
| `src/background/` | Service worker — extension lifecycle, message routing |
| `src/offscreen/` | Offscreen document — NER provider (transformers.js/ONNX), detection orchestration |
| `src/content/` | Content scripts — paste interception, `site-adapters/` per chat app |
| `src/ui/` | Banner, overlay, cancel-decision dialog, clipboard toast, scanning indicator |
| `src/popup/`, `src/options/` | Svelte 5 extension UI surfaces |
| `src/shared/` | Types, constants, detection config, i18n shared across contexts |
| `crate/` | Rust/WASM detection engine (built via `npm run build:wasm`) |
| `scripts/` | Model prep/conversion, packaging, release validation, benchmark helpers |
| `tests/` | Jest tests mirroring `src/` structure |
| `docs/developer/` | Building, model assets, releasing |
| `docs/release/` | Privacy boundary, permissions, packaging, public-source boundary |
| `docs/superpowers/` | Specs and plans from the brainstorming/writing-plans workflow |

## Build & Test Commands

| Command | When |
|---------|------|
| `npm run build:wasm` | After any change under `crate/src/` |
| `npm run dev` | Webpack watch mode for `src/` (frontend-only iteration) |
| `npm run build` | Full model-free build (`build:wasm` + `build:ext`) |
| `NER_MODEL_ASSETS_REQUIRED=1 npm run build` | Strict build — fails if BardsAI assets are missing |
| `npm test` | Jest suite |
| `npm run test:rust` | `cargo test` in `crate/` |
| `npm run check:svelte` | Svelte type-checking |
| `npm run validate:ci` | Full model-free PR validation (jest, svelte-check, version, permissions, privacy-boundary, rust tests, model-free build) — **run before opening a PR** |
| `npm run check:privacy-boundary` | Static scan for the privacy invariant (see below) — fast, no model assets needed |

## Critical Invariant: Privacy Boundary

This is the one rule that must never regress. The project has no telemetry,
no analytics, no remote inference, and no automatic upload of clipboard
content, prompts, responses, detected entities, vault data, or feedback logs.

**MUST**
- Keep `src/` free of runtime network primitives (`fetch`, `XMLHttpRequest`,
  `sendBeacon`, `WebSocket`, `EventSource`, remote `importScripts`/`<script
  src="http...">`) except the one approved exception below.
- Keep Transformers.js configured local-only in
  `src/offscreen/ner-provider.ts`: `allowRemoteModels = false`,
  `allowLocalModels = true`, `localModelPath` via `chrome.runtime.getURL`,
  browser/filesystem caches disabled.
- Run `npm run check:privacy-boundary` before committing changes under
  `src/` or `package.json` dependencies. A project hook does this
  automatically and blocks `git commit` on failure (see
  `scripts/claude-hooks/pre-commit-privacy-check.cjs`); a second hook warns
  (non-blocking) immediately after editing files under `src/`.

**NEVER**
- Add a dependency matching analytics/telemetry/crash-reporting name
  patterns (sentry, posthog, segment, mixpanel, amplitude, datadog, bugsnag,
  rollbar, newrelic, google-analytics, or generic `analytics`/`telemetry`).
- Add a new runtime network primitive without documenting the user-visible
  reason, proving it cannot upload user content, and extending the
  allowlist in `scripts/check-privacy-boundary.js`.

The only currently approved exception is the `fetch(url, { method: 'HEAD'
})` local-asset existence probe in `src/offscreen/ner-provider.ts`.

See [`docs/release/privacy-boundary.md`](docs/release/privacy-boundary.md)
and the `release-validation` skill for full detail.

## Development Workflow

Feature work in this repo follows brainstorming → spec → plan → TDD via the
superpowers skills. Specs live in `docs/superpowers/specs/`, plans in
`docs/superpowers/plans/` — check there for prior art before starting
related work.

## Skills Quick Reference

| Task | Skill |
|------|-------|
| Build/troubleshoot the Rust→WASM detection engine | `.claude/skills/privacy-guardrail/wasm-build/SKILL.md` |
| Prepare/convert/quantize NER model assets | `.claude/skills/privacy-guardrail/model-pipeline/SKILL.md` |
| Privacy boundary check, permission check, release packaging | `.claude/skills/privacy-guardrail/release-validation/SKILL.md` |
| Run/interpret the OpenPII benchmark | `.claude/skills/privacy-guardrail/benchmark-openpii/SKILL.md` |
| Svelte popup/options components, site-adapters, banner/overlay UI | `.claude/skills/privacy-guardrail/svelte-ui-conventions/SKILL.md` |

## Pre-Commit Self-Check

Before committing changes that touch `src/`, `crate/src/`, or
`package.json`:
1. `npm run check:privacy-boundary` passes (enforced by a hook on `git commit`).
2. If `crate/src/` changed, `npm run build:wasm` was rerun.
3. If UI/Svelte files changed, `npm run check:svelte` passes.
4. `npm run validate:ci` passes before opening a PR.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **hacienda-chrome** (2080 symbols, 5852 relationships, 166 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/hacienda-chrome/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/hacienda-chrome/context` | Codebase overview, check index freshness |
| `gitnexus://repo/hacienda-chrome/clusters` | All functional areas |
| `gitnexus://repo/hacienda-chrome/processes` | All execution flows |
| `gitnexus://repo/hacienda-chrome/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
