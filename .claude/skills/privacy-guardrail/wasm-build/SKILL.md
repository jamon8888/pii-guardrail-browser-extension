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
