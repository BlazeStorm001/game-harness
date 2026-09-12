# Minimal Agentic Game Development Harness

A minimal Pi harness for long-running autonomous browser-game development.

NEON BREACH Game is the example case study: a complete browser game created by a local
Qwen3.8-27B model, including procedural art, production tests, browser
experiments, and autonomous test bots.

## NEON BREACH Case Study

[Play NEON BREACH](https://blazestorm001.github.io/game-harness/)



https://github.com/user-attachments/assets/b2d166ed-fc4b-4002-84df-28616f8f2507



- [Experiment Results](examples/neon-breach/README.md)
- [Sanitized agent trace](https://blazestorm001.github.io/game-harness/traces.html)

Qwen created the game, procedural sprites, game documentation, production tests,
Playwright experiments, and bots.

## Requirements

The supported environments are Linux and WSL2. You need Node.js 20+, npm, Bash,
Git, `curl`, `jq`, `rg`, GNU `timeout`, `realpath`, and `sha256sum`, plus a
compatible running model server.

## Install

```bash
./harness/scripts/setup.sh --install
./harness/scripts/setup.sh --check
```

## Start The Model Server

A tested configuration (Qwen3.8-27B `UD-Q3_K_XL`) is
[`harness/presets/qwen3.8-27b-rtx5060ti.ini`](harness/presets/qwen3.8-27b-rtx5060ti.ini).
Replace its placeholder `model` and `mmproj` paths, then run from the repository
root:

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
deterministic `window.__gameTest` contract. Playwright
MCP is also available.

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
