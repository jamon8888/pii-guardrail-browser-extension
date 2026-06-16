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
