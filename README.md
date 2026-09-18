# Minimal Agentic Game Development Harness

A minimal Pi harness for long-running autonomous browser-game development.

NEON BREACH Game is the example case study: a complete browser game created by a local Qwen3.8-27B model, including procedural art, production tests, browser experiments, and deterministic simulation tests.

## NEON BREACH Case Study

[Play NEON BREACH](https://blazestorm001.github.io/game-harness/)

[Watch the Demo](examples/neon-breach/neon-breach-eval-demo.mp4)

- [Experiment Results](examples/neon-breach/README.md)
- [Agent trace](https://blazestorm001.github.io/game-harness/traces.html)

Qwen created the game, procedural sprites, game documentation, production tests, and Playwright experiments during a single nine-hour run.

## Requirements

The supported environments are Linux and WSL2. You need Node.js 20+, npm, Bash,Git, `curl`, `jq`, `rg`, GNU `timeout`, `realpath`, and `sha256sum`, plus a compatible running model server.

## Install

```bash
./harness/scripts/setup.sh --install
./harness/scripts/setup.sh --check
```

## Start The Model Server

A portable copy of the configuration used for the case study is
[`harness/presets/qwen3.8-27b-rtx5060ti.ini`](harness/presets/qwen3.8-27b-rtx5060ti.ini).
It pairs an ASCII-condensed `UD-Q3_K_XL` target with a compatible
ASCII-condensed DFlash2 `Q2_K` draft. Replace the placeholder `model`,
`spec-draft-model`, and `mmproj` paths, then run from the repository root:

```bash
llama serve \
  --models-preset harness/presets/qwen3.8-27b-rtx5060ti.ini \
  --models-max 1 \
  --host 127.0.0.1 \
  --port 8080
```

The harness defaults match the preset section name and server address:

```bash
export PI_MODEL=qwen
export LLAMA_URL=http://127.0.0.1:8080/v1
```

The evaluated machine used an RTX 5060 Ti as `CUDA0` for the target and draft,
and a T400 as `CUDA1` for the multimodal projector. Adjust the device fields for
your hardware. The preset uses an 86,000-token context, Q4 target and draft KV
caches, and DFlash proposals of up to four tokens.

The matched model pair was produced with one shared vocabulary mapping based on
[Qwen3.8-27B ASCII Condensed](https://huggingface.co/bsaleh03/Qwen3.8-27B-ASCII-Condensed),
retaining ASCII, byte-fallback, and special tokens. The draft originates from
[Qwen3.8-27B-DFlash2](https://huggingface.co/z-lab/Qwen3.8-27B-DFlash2); see
llama.cpp's [DFlash documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/speculative.md#dflash-draft-dflash).

## Supply A Scenario

A scenario can be a bundled name or a directory with three prompts and optional
reference images:

```text
my-scenario/
  prompts/
    initial.txt
    continue.txt
    final.txt
  references/              # optional PNG, JPEG, or WebP files
```

`initial.txt` starts a new session with its references for task, `continue.txt` guides
each autonomous turn and later resume, and `final.txt` reserves the closing
validation pass.

Run a custom scenario:

```bash
./harness/scripts/run-eval.sh --scenario /path/to/my-scenario --hours 10
```

## Run An Experiment

```bash
./harness/scripts/run-eval.sh --scenario neon-breach --hours 10
```

Each run receives a new workspace at
`.runs/<scenario>-<timestamp>/`. Continue the newest saved session without
replaying its initial prompt or references with:

```bash
./harness/scripts/run-eval.sh --resume-latest --hours 10
```

The historical defaults are a 75-minute turn watchdog and a 60-minute final
phase. `TURN_MINUTES` limits a stalled Pi process while preserving its saved
session for continuation. `FINAL_MINUTES` reserves time for the scenario's
closing validation prompt. Override them with `TURN_MINUTES` and `FINAL_MINUTES`.
Each invocation records versions, input hashes, timings, statuses, and session
identity in its run metadata.

## Context And Tools

Pi runs with `--no-context-files`, `--no-skills`, and an isolated
`PI_CODING_AGENT_DIR`. This reduces accidental context contamination, but it is
not a security boundary: Pi retains the launching user's filesystem permissions.

The `game_test` extension drives a real browser and asks generated games for a
action-transition-observation loop. Playwright MCP is also available.

Cloudflare image generation is optional and remote. Export credentials in the shell used to launch the experiment. See Cloudflare's
[Workers AI REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).:

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
```

The `generate_image` tool uses FLUX.1 Schnell and requires [ImageMagick's](https://imagemagick.org/#gsc.tab=0)
`magick` command. Leave these variables unset to run without remote image
generation.

[Context7](https://context7.com/) is optional documentation access enabled with `ENABLE_CONTEXT7=1` and
`CONTEXT7_API_KEY`.
