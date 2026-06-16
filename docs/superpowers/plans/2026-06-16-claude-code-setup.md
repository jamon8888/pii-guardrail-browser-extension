# Claude Code Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give this repository a complete Claude Code setup: project-specific `CLAUDE.md`/`AGENTS.md` guidance, five workflow skills under `.claude/skills/privacy-guardrail/`, and three hook scripts (wired via a new committed `.claude/settings.json`) that mechanically enforce the privacy-boundary invariant.

**Architecture:** Three independent hook scripts under `scripts/claude-hooks/` each export a pure, synchronously-testable `evaluate(payload, ...)` function plus a thin stdin-reading CLI wrapper (mirroring the existing `scripts/check-privacy-boundary.js` pattern of separating logic from `main()`). The blocking commit-time hook and the advisory edit-time hook both reuse the existing `checkPrivacyBoundary()` export — no new exports needed from that file. `.claude/settings.json` wires the three scripts into `PreToolUse`/`PostToolUse`. `CLAUDE.md`/`AGENTS.md` get an identical new section inserted above the existing auto-generated GitNexus block. Five new skill files document project-specific workflows the GitNexus skills don't cover.

**Tech Stack:** Node.js (CommonJS `.cjs`), Jest (existing `tests/scripts/` convention), Markdown skill files with YAML frontmatter.

**Spec:** `docs/superpowers/specs/2026-06-16-claude-code-setup-design.md`

---

### Task 1: `pre-commit-privacy-check.cjs` hook (blocking)

**Files:**
- Create: `scripts/claude-hooks/pre-commit-privacy-check.cjs`
- Test: `tests/scripts/pre-commit-privacy-check.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/scripts/pre-commit-privacy-check.test.js`:

```js
const { evaluate, shouldCheck } = require('../../scripts/claude-hooks/pre-commit-privacy-check');

describe('pre-commit-privacy-check hook', () => {
  test('shouldCheck matches a Bash git commit command', () => {
    expect(shouldCheck('Bash', 'git commit -m "test"')).toBe(true);
    expect(shouldCheck('Bash', 'git status')).toBe(false);
    expect(shouldCheck('Edit', 'git commit -m "test"')).toBe(false);
    expect(shouldCheck('Bash', undefined)).toBe(false);
  });

  test('does not check when the command is not a git commit', () => {
    const runCheck = jest.fn();
    const decision = evaluate({ tool_name: 'Bash', tool_input: { command: 'git status' } }, runCheck);
    expect(decision).toEqual({ block: false, message: null });
    expect(runCheck).not.toHaveBeenCalled();
  });

  test('does not block a git commit when the privacy check passes', () => {
    const runCheck = jest.fn(() => ({ errors: [], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } }, runCheck);
    expect(decision).toEqual({ block: false, message: null });
    expect(runCheck).toHaveBeenCalledTimes(1);
  });

  test('blocks a git commit when the privacy check fails', () => {
    const runCheck = jest.fn(() => ({ errors: ['src/x.ts:1 uses fetch'], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } }, runCheck);
    expect(decision.block).toBe(true);
    expect(decision.message).toContain('src/x.ts:1 uses fetch');
  });

  test('ignores malformed payloads without throwing', () => {
    expect(() => evaluate(null)).not.toThrow();
    expect(evaluate(null)).toEqual({ block: false, message: null });
    expect(evaluate({})).toEqual({ block: false, message: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --config jest.config.js tests/scripts/pre-commit-privacy-check.test.js`
Expected: FAIL — `Cannot find module '../../scripts/claude-hooks/pre-commit-privacy-check'`

- [ ] **Step 3: Write the implementation**

Create `scripts/claude-hooks/pre-commit-privacy-check.cjs`:

```js
'use strict';

const path = require('path');
const fs = require('fs');

const GIT_COMMIT_PATTERN = /\bgit\s+commit\b/;

function shouldCheck(toolName, command) {
  return toolName === 'Bash' && typeof command === 'string' && GIT_COMMIT_PATTERN.test(command);
}

function defaultRunCheck() {
  const { checkPrivacyBoundary } = require('../check-privacy-boundary.js');
  return checkPrivacyBoundary(path.resolve(__dirname, '..', '..'));
}

function evaluate(payload, runCheck) {
  const check = runCheck || defaultRunCheck;
  const toolName = payload && payload.tool_name;
  const command = payload && payload.tool_input && payload.tool_input.command;

  if (!shouldCheck(toolName, command)) {
    return { block: false, message: null };
  }

  const result = check();
  if (result.errors.length > 0) {
    return {
      block: true,
      message: [
        'Privacy boundary check failed - commit blocked:',
        ...result.errors.map((error) => `- ${error}`),
        'Run "npm run check:privacy-boundary" for full output, fix the findings, then retry the commit.',
      ].join('\n'),
    };
  }

  return { block: false, message: null };
}

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    return JSON.parse(data);
  } catch (_err) {
    return null;
  }
}

function main() {
  const payload = readStdin();
  const decision = evaluate(payload || {});
  if (decision.block) {
    process.stderr.write(decision.message + '\n');
    process.exitCode = 2;
    return;
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = { evaluate, shouldCheck, GIT_COMMIT_PATTERN };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --config jest.config.js tests/scripts/pre-commit-privacy-check.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Manual smoke test of the CLI wrapper**

Run (from repo root):

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | node scripts/claude-hooks/pre-commit-privacy-check.cjs; echo "exit:$?"
```

Expected: `exit:0`, no stderr output (command isn't a commit, so the check never runs).

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m test"}}' | node scripts/claude-hooks/pre-commit-privacy-check.cjs; echo "exit:$?"
```

Expected: `exit:0` (the current repo passes `check-privacy-boundary`), no stderr output.

- [ ] **Step 6: Commit**

```bash
git add scripts/claude-hooks/pre-commit-privacy-check.cjs tests/scripts/pre-commit-privacy-check.test.js
git commit -m "feat(hooks): add blocking pre-commit privacy boundary check"
```

---

### Task 2: `src-edit-privacy-scan.cjs` hook (advisory)

**Files:**
- Create: `scripts/claude-hooks/src-edit-privacy-scan.cjs`
- Test: `tests/scripts/src-edit-privacy-scan.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/scripts/src-edit-privacy-scan.test.js`:

```js
const { evaluate, isUnderSrc } = require('../../scripts/claude-hooks/src-edit-privacy-scan');

describe('src-edit-privacy-scan hook', () => {
  test('isUnderSrc recognizes paths under src/ on both separator styles', () => {
    expect(isUnderSrc('src/offscreen/ner-provider.ts')).toBe(true);
    expect(isUnderSrc('C:\\repo\\src\\offscreen\\ner-provider.ts')).toBe(true);
    expect(isUnderSrc('/repo/src/offscreen/ner-provider.ts')).toBe(true);
    expect(isUnderSrc('scripts/check-privacy-boundary.js')).toBe(false);
    expect(isUnderSrc(undefined)).toBe(false);
  });

  test('does not warn for non-src edits', () => {
    const runCheck = jest.fn();
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: 'scripts/foo.js' } }, runCheck);
    expect(decision).toEqual({ warn: false, message: null });
    expect(runCheck).not.toHaveBeenCalled();
  });

  test('does not warn for non Edit/Write tools', () => {
    const runCheck = jest.fn();
    const decision = evaluate({ tool_name: 'Bash', tool_input: { file_path: 'src/x.ts' } }, runCheck);
    expect(decision).toEqual({ warn: false, message: null });
    expect(runCheck).not.toHaveBeenCalled();
  });

  test('does not warn when the privacy check passes', () => {
    const runCheck = jest.fn(() => ({ errors: [], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Edit', tool_input: { file_path: 'src/x.ts' } }, runCheck);
    expect(decision).toEqual({ warn: false, message: null });
    expect(runCheck).toHaveBeenCalledTimes(1);
  });

  test('warns (non-blocking) when the privacy check fails', () => {
    const runCheck = jest.fn(() => ({ errors: ['src/x.ts:1 uses fetch'], allowedRuntimeFindings: [] }));
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: 'src/x.ts' } }, runCheck);
    expect(decision.warn).toBe(true);
    expect(decision.message).toContain('src/x.ts:1 uses fetch');
  });

  test('ignores malformed payloads without throwing', () => {
    expect(() => evaluate(null)).not.toThrow();
    expect(evaluate(null)).toEqual({ warn: false, message: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --config jest.config.js tests/scripts/src-edit-privacy-scan.test.js`
Expected: FAIL — `Cannot find module '../../scripts/claude-hooks/src-edit-privacy-scan'`

- [ ] **Step 3: Write the implementation**

Create `scripts/claude-hooks/src-edit-privacy-scan.cjs`:

```js
'use strict';

const path = require('path');
const fs = require('fs');

function isUnderSrc(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  const normalized = filePath.split(path.sep).join('/');
  return normalized === 'src' || normalized.startsWith('src/') || normalized.includes('/src/');
}

function defaultRunCheck() {
  const { checkPrivacyBoundary } = require('../check-privacy-boundary.js');
  return checkPrivacyBoundary(path.resolve(__dirname, '..', '..'));
}

function evaluate(payload, runCheck) {
  const check = runCheck || defaultRunCheck;
  const toolName = payload && payload.tool_name;
  const filePath = payload && payload.tool_input && payload.tool_input.file_path;

  if ((toolName !== 'Edit' && toolName !== 'Write') || !isUnderSrc(filePath)) {
    return { warn: false, message: null };
  }

  const result = check();
  if (result.errors.length > 0) {
    return {
      warn: true,
      message: [
        'Privacy boundary warning (non-blocking, will block at commit time):',
        ...result.errors.map((error) => `- ${error}`),
      ].join('\n'),
    };
  }

  return { warn: false, message: null };
}

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    return JSON.parse(data);
  } catch (_err) {
    return null;
  }
}

function main() {
  const payload = readStdin();
  const decision = evaluate(payload || {});
  if (decision.warn) {
    process.stderr.write(decision.message + '\n');
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = { evaluate, isUnderSrc };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --config jest.config.js tests/scripts/src-edit-privacy-scan.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Manual smoke test**

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"src/offscreen/ner-provider.ts"}}' | node scripts/claude-hooks/src-edit-privacy-scan.cjs; echo "exit:$?"
```

Expected: `exit:0`, no stderr (current repo passes the check).

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"scripts/foo.js"}}' | node scripts/claude-hooks/src-edit-privacy-scan.cjs; echo "exit:$?"
```

Expected: `exit:0`, no stderr (not under `src/`, check never runs).

- [ ] **Step 6: Commit**

```bash
git add scripts/claude-hooks/src-edit-privacy-scan.cjs tests/scripts/src-edit-privacy-scan.test.js
git commit -m "feat(hooks): add advisory privacy scan on src/ edits"
```

---

### Task 3: `rust-edit-reminder.cjs` hook (advisory)

**Files:**
- Create: `scripts/claude-hooks/rust-edit-reminder.cjs`
- Test: `tests/scripts/rust-edit-reminder.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/scripts/rust-edit-reminder.test.js`:

```js
const { evaluate, isRustSourceFile } = require('../../scripts/claude-hooks/rust-edit-reminder');

describe('rust-edit-reminder hook', () => {
  test('isRustSourceFile matches crate/src/*.rs on both separator styles', () => {
    expect(isRustSourceFile('crate/src/pipeline.rs')).toBe(true);
    expect(isRustSourceFile('crate\\src\\pipeline.rs')).toBe(true);
    expect(isRustSourceFile('C:\\repo\\crate\\src\\pipeline.rs')).toBe(true);
    expect(isRustSourceFile('crate/pkg/privacy_guardrail_wasm.js')).toBe(false);
    expect(isRustSourceFile('crate/Cargo.toml')).toBe(false);
    expect(isRustSourceFile(undefined)).toBe(false);
  });

  test('does not remind for non Edit/Write tools', () => {
    const decision = evaluate({ tool_name: 'Bash', tool_input: { file_path: 'crate/src/pipeline.rs' } });
    expect(decision).toEqual({ remind: false, message: null });
  });

  test('does not remind for non-Rust edits', () => {
    const decision = evaluate({ tool_name: 'Edit', tool_input: { file_path: 'src/background/service-worker.ts' } });
    expect(decision).toEqual({ remind: false, message: null });
  });

  test('reminds when crate/src/*.rs changes', () => {
    const decision = evaluate({ tool_name: 'Write', tool_input: { file_path: 'crate/src/pipeline.rs' } });
    expect(decision.remind).toBe(true);
    expect(decision.message).toContain('npm run build:wasm');
    expect(decision.message).toContain('pipeline.rs');
  });

  test('ignores malformed payloads without throwing', () => {
    expect(() => evaluate(null)).not.toThrow();
    expect(evaluate(null)).toEqual({ remind: false, message: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --config jest.config.js tests/scripts/rust-edit-reminder.test.js`
Expected: FAIL — `Cannot find module '../../scripts/claude-hooks/rust-edit-reminder'`

- [ ] **Step 3: Write the implementation**

Create `scripts/claude-hooks/rust-edit-reminder.cjs`:

```js
'use strict';

const path = require('path');
const fs = require('fs');

const RUST_SRC_PATTERN = /crate[\\/]src[\\/].*\.rs$/;

function isRustSourceFile(filePath) {
  return typeof filePath === 'string' && RUST_SRC_PATTERN.test(filePath);
}

function evaluate(payload) {
  const toolName = payload && payload.tool_name;
  const filePath = payload && payload.tool_input && payload.tool_input.file_path;

  if ((toolName !== 'Edit' && toolName !== 'Write') || !isRustSourceFile(filePath)) {
    return { remind: false, message: null };
  }

  const fileName = filePath.split(/[\\/]/).pop();
  return {
    remind: true,
    message: `Reminder: ${fileName} changed under crate/src/ — rerun "npm run build:wasm" before testing in the browser.`,
  };
}

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    return JSON.parse(data);
  } catch (_err) {
    return null;
  }
}

function main() {
  const payload = readStdin();
  const decision = evaluate(payload || {});
  if (decision.remind) {
    process.stderr.write(decision.message + '\n');
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main();
}

module.exports = { evaluate, isRustSourceFile, RUST_SRC_PATTERN };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --config jest.config.js tests/scripts/rust-edit-reminder.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Manual smoke test**

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"crate/src/pipeline.rs"}}' | node scripts/claude-hooks/rust-edit-reminder.cjs; echo "exit:$?"
```

Expected: `exit:0`, stderr contains `Reminder: pipeline.rs changed under crate/src/ — rerun "npm run build:wasm"...`.

- [ ] **Step 6: Commit**

```bash
git add scripts/claude-hooks/rust-edit-reminder.cjs tests/scripts/rust-edit-reminder.test.js
git commit -m "feat(hooks): add advisory wasm-rebuild reminder on crate/src edits"
```

---

### Task 4: Wire hooks into `.claude/settings.json`

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: Create the settings file**

Create `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"scripts/claude-hooks/pre-commit-privacy-check.cjs\"",
            "timeout": 30,
            "statusMessage": "Checking privacy boundary before commit..."
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"scripts/claude-hooks/src-edit-privacy-scan.cjs\"",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "node \"scripts/claude-hooks/rust-edit-reminder.cjs\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat(hooks): wire privacy-guardrail hooks into project settings"
```

---

### Task 5: Add project section to `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md:1` (insert before the existing `<!-- gitnexus:start -->` line)

- [ ] **Step 1: Insert the new section above the GitNexus block**

In `CLAUDE.md`, replace the first line:

```
<!-- gitnexus:start -->
```

with:

```markdown
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
```

(The rest of the file — the existing GitNexus block — is unchanged.)

- [ ] **Step 2: Verify the GitNexus block is intact**

Run: `grep -c "gitnexus:start\|gitnexus:end" CLAUDE.md`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add project guide section to CLAUDE.md"
```

---

### Task 6: Mirror the same section into `AGENTS.md`

**Files:**
- Modify: `AGENTS.md:1`

- [ ] **Step 1: Apply the identical edit**

`AGENTS.md` is currently byte-identical to the pre-Task-5 `CLAUDE.md`. Apply the exact same replacement as Task 5 Step 1 (same first line `<!-- gitnexus:start -->` replaced with the same new section text shown in Task 5).

- [ ] **Step 2: Verify the two files are identical**

Run: `diff CLAUDE.md AGENTS.md`
Expected: no output (files identical)

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: mirror project guide section into AGENTS.md"
```

---

### Task 7: `wasm-build` skill

**Files:**
- Create: `.claude/skills/privacy-guardrail/wasm-build/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
name: wasm-build
description: "Use when building, rebuilding, or troubleshooting the Rust/WASM detection engine in crate/ — after editing crate/src/*.rs, when wasm-bindgen or cargo errors appear, or before testing detection changes in the browser. Examples: \"rebuild the wasm module\", \"I changed the Rust detector\", \"wasm-bindgen version mismatch\""
---

# WASM Build Pipeline

The deterministic PII detection engine lives in `crate/` (Rust) and is compiled to WebAssembly for use in `src/offscreen/`. The compiled output is not regenerated automatically — always rebuild after a Rust change.

## Prerequisites

```bash
rustup update
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.118
```

The `wasm-bindgen-cli` version **must** match the `wasm-bindgen` library version pinned in `crate/Cargo.toml`. If you see a version-mismatch panic at runtime, reinstall the CLI to match.

## Build

```bash
npm run build:wasm
```

This runs, in order:
1. `cargo build --release --target wasm32-unknown-unknown` in `crate/`
2. `wasm-bindgen --target web --out-dir pkg --out-name privacy_guardrail_wasm target/wasm32-unknown-unknown/release/privacy_guardrail_wasm.wasm`

Output lands in `crate/pkg/` (`.wasm`, `.js` glue, `.d.ts`) and is consumed by the webpack build (`npm run build:ext`).

**MUST rerun `npm run build:wasm` after any change under `crate/src/`** — the offscreen document loads the compiled `.wasm` binary, not the Rust source, so edits are invisible until rebuilt. After rebuilding, reload the unpacked extension and refresh the supported chat tab to pick up the change.

## Rust Tests

```bash
npm run test:rust
```

Runs `cargo test` in `crate/`. Run this before `npm run build:wasm` when iterating on detector logic — it's faster feedback than a full WASM rebuild + browser reload.

## Crate Structure

| File | Responsibility |
|------|-----------------|
| `crate/src/lib.rs` | WASM-bindgen entry points exposed to JS |
| `crate/src/pipeline.rs` | Detection pipeline orchestration |
| `crate/src/regex_recognizers.rs` | Pattern-based recognizers (email, phone, etc.) |
| `crate/src/checksum.rs` | Checksum-validated recognizers (IBAN, credit card) |
| `crate/src/gdpr_regex.rs` | GDPR Art.9-category regex recognizers |
| `crate/src/ner.rs` / `ner_fallback_regex.rs` | NER integration and regex fallback when NER is unavailable |
| `crate/src/merger.rs` | Merges overlapping detections from multiple recognizers |
| `crate/src/tokenizer.rs` | Tokenization support |
| `crate/src/context.rs` | Detection context/config plumbing |
| `crate/src/types.rs` | Shared Rust types |
| `crate/src/cloakrs_integration.rs` | Integration with the `cloakrs-core`/`cloakrs-patterns`/`cloakrs-locales` crates |

## Troubleshooting

- **"Cargo rejects the lockfile version"** — run `rustup update`.
- **wasm-bindgen version mismatch panic at runtime** — reinstall `wasm-bindgen-cli` to match the version in `crate/Cargo.toml`.
- **Changes not appearing in the browser** — confirm `npm run build:wasm` was rerun, then hard-reload the unpacked extension in `chrome://extensions` and refresh the chat tab.
- **`getrandom` / wasm32-unknown-unknown errors** — `crate/Cargo.toml` pins `getrandom` with the `js` feature; a new dependency pulling in `getrandom` transitively without that feature enabled for the wasm target fails at link time.
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.claude/skills/privacy-guardrail/wasm-build/SKILL.md','utf8');if(!t.startsWith('---'))throw new Error('missing frontmatter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/privacy-guardrail/wasm-build/SKILL.md
git commit -m "docs(skills): add wasm-build skill"
```

---

### Task 8: `model-pipeline` skill

**Files:**
- Create: `.claude/skills/privacy-guardrail/model-pipeline/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
name: model-pipeline
description: "Use when preparing, converting, or quantizing NER model assets (BardsAI, ai4privacy, hikmaai) for Local AI detection, or troubleshooting missing model assets during a strict build. Examples: \"prepare the bardsai model\", \"convert the model to q4f16\", \"NER_MODEL_ASSETS_REQUIRED build fails\""
---

# NER Model Asset Pipeline

Local AI transformer NER assets are generated artifacts, not committed source. The public beta runtime model is BardsAI EU multilingual NER. Full detail: `docs/developer/model-assets.md`.

## Pipeline Order

1. **Set up a Python environment** for conversion tools:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install -U pip
   python -m pip install -U "huggingface_hub[cli]" onnx onnxruntime onnx-ir sympy
   ```

2. **Download upstream source files**:
   ```bash
   mkdir -p .model-sources
   hf download bardsai/eu-pii-anonimization-multilang \
     --include "config.json" \
     --include "tokenizer.json" \
     --include "tokenizer_config.json" \
     --include "vocab.txt" \
     --include "special_tokens_map.json" \
     --include "onnx/model.onnx" \
     --include "onnx/model_quantized.onnx" \
     --include "onnx/model_fp16.onnx" \
     --local-dir .model-sources/bardsai-eu-pii-anonimization-multilang
   ```

3. **Prepare the runtime copy** (verifies tokenizer metadata, copies files, writes asset manifest):
   ```bash
   npm run prepare:model:bardsai -- \
     --source-dir .model-sources/bardsai-eu-pii-anonimization-multilang \
     --force
   ```

4. **Repackage fp16 as ONNX external data** (small graph protobuf + `.onnx.data` weights sidecar — required so ONNX Runtime doesn't copy all weights through the wasm heap during session init):
   ```bash
   npm run convert:model:external-data -- --model bardsai-fp16
   ```
   Pass `--force` to overwrite an existing `model_fp16.onnx.data`.

5. **Generate the q4f16 WebGPU artifact pair** (4-bit weight-only quantization, already in external-data format — no separate repackaging step needed):
   ```bash
   npm run convert:model:q4f16:bardsai
   ```
   Pass `--force` to replace an existing output.

## Expected Output Layout

```text
generated/models/ner/bardsai-eu-pii-anonimization-multilang/
  config.json
  tokenizer.json
  tokenizer_config.json
  onnx/model_quantized.onnx
  onnx/model_q4f16.onnx
  onnx/model_q4f16.onnx.data
  onnx/model_fp16.onnx
  onnx/model_fp16.onnx.data
```

`generated/` is gitignored — these are release artifacts, not source files. Webpack copies them into `dist/models/ner/.../` during the build.

## Build With Assets Required

```bash
NER_MODEL_ASSETS_REQUIRED=1 npm run build
```

Fails fast if required BardsAI files are missing — use this to validate a release build. A normal `npm run build` allows model-free development.

## Deprecated / Comparison Models

`npm run prepare:model:hikmaai`, `npm run prepare:model:ai4privacy`, and `npm run convert:model:fp16` exist for research/comparison purposes only. They are **not** the standard public beta runtime model — don't wire them into the default build path.

## Troubleshooting

- **Python import errors during conversion** — activate `.venv` and confirm `onnx`, `onnxruntime`, `onnx-ir`, and `sympy` are installed.
- **External-data location mismatch** — the conversion script verifies the `location` recorded inside the protobuf matches the filename the runtime passes via `session_options.externalData` in `src/shared/constants.ts`; a mismatch means the conversion script and runtime constant have drifted.
- **Source directory only has PyTorch/safetensors weights** — export ONNX first with Optimum, then pass the exported directory to `prepare:model:bardsai`.
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.claude/skills/privacy-guardrail/model-pipeline/SKILL.md','utf8');if(!t.startsWith('---'))throw new Error('missing frontmatter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/privacy-guardrail/model-pipeline/SKILL.md
git commit -m "docs(skills): add model-pipeline skill"
```

---

### Task 9: `release-validation` skill

**Files:**
- Create: `.claude/skills/privacy-guardrail/release-validation/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
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
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.claude/skills/privacy-guardrail/release-validation/SKILL.md','utf8');if(!t.startsWith('---'))throw new Error('missing frontmatter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/privacy-guardrail/release-validation/SKILL.md
git commit -m "docs(skills): add release-validation skill"
```

---

### Task 10: `benchmark-openpii` skill

**Files:**
- Create: `.claude/skills/privacy-guardrail/benchmark-openpii/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
name: benchmark-openpii
description: "Use when running or interpreting the OpenPII detection-quality benchmark, downloading/building its corpus, or evaluating a detection change's precision/recall impact. Examples: \"run the openpii benchmark\", \"build the benchmark corpus\", \"how did detection accuracy change\""
---

# OpenPII Benchmark

Evaluates detection precision/recall against the OpenPII dataset. Generated corpora and reports are not committed (`benchmarks/cache/` is gitignored).

## Pipeline

1. **Download the dataset** (one-time, cached locally):
   ```bash
   npm run benchmark:openpii:download
   ```

2. **Build the benchmark corpus** from the downloaded dataset:
   ```bash
   npm run benchmark:openpii:build
   ```

3. **Run the benchmark**:
   ```bash
   npm run benchmark:openpii
   ```

   Pattern-only mode (skips transformer NER, fast, no model assets needed):
   ```bash
   npm run benchmark:openpii -- --regex-only
   ```

## Interpreting Results

The benchmark reports precision/recall/F1 per entity category. When evaluating a detection change:
- Compare against a benchmark run from `main` (or the commit before your change) on the same corpus build — corpus sampling can vary between builds.
- A regression in one category alongside an improvement in another is a real trade-off to call out explicitly in the PR description, not something to silently average away.
- `--regex-only` results only reflect the Rust/WASM deterministic recognizers; full results additionally reflect whatever NER model is configured locally.

## Troubleshooting

- **Download fails or is slow** — the dataset is fetched from its upstream source; check `scripts/download-openpii-dataset.js` for the configured source and any required auth.
- **Corpus build produces unexpected category distribution** — rebuild with `npm run benchmark:openpii:build` after confirming the downloaded dataset is complete.
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.claude/skills/privacy-guardrail/benchmark-openpii/SKILL.md','utf8');if(!t.startsWith('---'))throw new Error('missing frontmatter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/privacy-guardrail/benchmark-openpii/SKILL.md
git commit -m "docs(skills): add benchmark-openpii skill"
```

---

### Task 11: `svelte-ui-conventions` skill

**Files:**
- Create: `.claude/skills/privacy-guardrail/svelte-ui-conventions/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
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
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('.claude/skills/privacy-guardrail/svelte-ui-conventions/SKILL.md','utf8');if(!t.startsWith('---'))throw new Error('missing frontmatter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/privacy-guardrail/svelte-ui-conventions/SKILL.md
git commit -m "docs(skills): add svelte-ui-conventions skill"
```

---

### Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Jest suite**

Run: `npx jest --config jest.config.js`
Expected: all suites PASS, including the three new `tests/scripts/*.test.js` files from Tasks 1–3 and the pre-existing `tests/scripts/privacy-boundary.test.js`.

- [ ] **Step 2: Run the privacy boundary check directly**

Run: `npm run check:privacy-boundary`
Expected: `Privacy boundary check passed.` (the new hook scripts under `scripts/claude-hooks/` are `.cjs` files outside `src/`, so they are not scanned and cannot trip this check.)

- [ ] **Step 3: Confirm CLAUDE.md and AGENTS.md stay identical**

Run: `diff CLAUDE.md AGENTS.md`
Expected: no output

- [ ] **Step 4: Refresh the GitNexus index**

Run: `npx gitnexus analyze`
Expected: completes successfully, picking up the new `scripts/claude-hooks/*.cjs` files and skill `SKILL.md` files. (This will rewrite the `<!-- gitnexus:start -->...<!-- gitnexus:end -->` block in both `CLAUDE.md` and `AGENTS.md` with updated symbol counts — that's expected and keeps the two files identical to each other since both get the same regenerated block.)

- [ ] **Step 5: Review the full diff for this plan's work**

Run: `git log --oneline -15` and `git status`
Expected: one commit per task (Tasks 1–11), working tree clean except any GitNexus-regenerated block changes from Step 4, which should be committed next.

- [ ] **Step 6: Commit the GitNexus refresh, if any**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "chore: refresh GitNexus index after Claude Code setup"
```

(Skip this step if `git status` shows no changes after Step 4.)

---

## Self-Review Notes

- **Spec coverage:** All three spec sections (CLAUDE.md/AGENTS.md content, 5 skills, 3 hooks + settings.json) map to Tasks 1–11. The spec's "Testing" section (synthetic stdin payloads, passing/failing repo states) is covered by the Jest unit tests in Tasks 1–3, which exercise `evaluate()` directly with constructed payloads and injected `runCheck` — equivalent coverage to spawning the CLI with real stdin, without the flakiness of process-spawning in tests.
- **Simplification carried over from spec:** the edit-time hook (Task 2) reuses `checkPrivacyBoundary()` wholesale rather than needing a new export, per the spec amendment made during self-review.
- **Type/naming consistency:** `evaluate(payload, runCheck)` signature, `{ block, message }` / `{ warn, message }` / `{ remind, message }` return shapes, and `tool_name`/`tool_input.command`/`tool_input.file_path` payload field names are used consistently across Tasks 1–3 and their tests.
