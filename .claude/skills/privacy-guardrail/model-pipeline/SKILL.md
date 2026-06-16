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
