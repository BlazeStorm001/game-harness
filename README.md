# Minimal Agentic Game Development Harness

A minimal harness around the Pi coding agent for long-running autonomous simple browser-game development. The bundled NEON BREACH case study is a complete browser game created by a local Qwen3.8-27B model in a single nine-hour run.

[![Deploy game to GitHub Pages](https://github.com/BlazeStorm001/game-harness/actions/workflows/pages.yml/badge.svg)](https://github.com/BlazeStorm001/game-harness/actions/workflows/pages.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## Why

Evaluating whether a local model can do long-horizon, tool-using work requires a stable agent, a real browser, and sessions that survive hours of autonomous turns. This harness provides that setup, and the preserved NEON BREACH run shows what a single nine-hour session produces.


https://github.com/user-attachments/assets/13a52784-d0fe-40f3-91c3-5eb003e6f420

- [Play NEON BREACH](https://blazestorm001.github.io/game-harness/)
- [Agent trace](https://blazestorm001.github.io/game-harness/traces.html)
- [Experiment results](examples/neon-breach/README.md)


## Quick start

```bash
# install pinned dependencies and verify
./harness/scripts/setup.sh --install
./harness/scripts/setup.sh --check

# start a model server (see "Model server" below), then run the bundled scenario
./harness/scripts/run-eval.sh --scenario harness/scenarios/neon-breach --hours 10
```

## Requirements

- Linux or WSL2
- Node.js 20+, npm, Bash, Git
- `curl`, `jq`, `rg`, GNU `timeout`, `realpath`, `sha256sum`
- A running llama.cpp model server (see Model server)

## Scenarios

A scenario is a directory with three prompts and optional reference images:

```text
my-scenario/
  prompts/
    initial.txt
    continue.txt
    final.txt
  references/              # optional PNG, JPEG, or WebP files
```

`initial.txt` starts a new session with its references, `continue.txt` guides
each autonomous turn and later resumes, and `final.txt` reserves the closing
validation pass.

## Usage

Start the llama.cpp model server before running an experiment. See
[Model server](#model-server) below for the case-study configuration.

Run the bundled scenario:

```bash
./harness/scripts/run-eval.sh --scenario harness/scenarios/neon-breach --hours 10
```

Run a custom scenario:

```bash
./harness/scripts/run-eval.sh --scenario /path/to/my-scenario --hours 10
```

Each run receives a new workspace at `.runs/<scenario>-<timestamp>/`. Continue
a specific saved session without replaying its initial prompt or references:

```bash
./harness/scripts/run-eval.sh --resume neon-breach-20260910-004540 --hours 10
```

Or continue the newest saved session:

```bash
./harness/scripts/run-eval.sh --resume-latest --hours 10
```

`TURN_MINUTES` (default 75) limits a stalled Pi process while preserving its
saved session for continuation. `FINAL_MINUTES` (default 60) reserves time for
the scenario's closing validation prompt. Each invocation records versions,
input hashes, timings, statuses, and session identity in its run metadata.

## Model server

The bundled and tested configuration uses Pi's `llama-cpp` provider with a
llama.cpp server. Set `LLAMA_URL` to its OpenAI-compatible API base URL and
`PI_MODEL` to a model ID returned by the server's `/models` endpoint.

A portable copy of the configuration used for the case study is
[`examples/neon-breach/qwen3.8-27b-rtx5060ti.ini`](examples/neon-breach/qwen3.8-27b-rtx5060ti.ini).
Replace the placeholder `model`, `spec-draft-model`, and `mmproj` paths, then run
from the repository root:

```bash
llama serve \
  --models-preset examples/neon-breach/qwen3.8-27b-rtx5060ti.ini \
  --models-max 1 \
  --host 127.0.0.1 \
  --port 8080
```

The harness defaults match the preset section name and server address:

```bash
export PI_MODEL=qwen
export LLAMA_URL=http://127.0.0.1:8080/v1
export MODEL_PRESET=examples/neon-breach/qwen3.8-27b-rtx5060ti.ini
```

The case study paired an ASCII-condensed Qwen3.8-27B target with a DFlash2 draft
on an RTX 5060 Ti. See the preset and the
[case study notes](examples/neon-breach/README.md) for the full configuration.

## Context and tools

Pi runs with `--no-context-files`, `--no-skills`, and an isolated
`PI_CODING_AGENT_DIR` to reduce accidental context contamination. This is not a
security boundary: Pi retains the launching user's filesystem permissions.

The `game_test` extension drives a real browser and asks generated games for an
action-transition-observation loop. Playwright MCP is also available.

Optional integrations:

- Cloudflare image generation: export `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` in the shell used to launch the experiment. The
  `generate_image` tool uses FLUX.1 Schnell and requires ImageMagick's `magick`
  command. Leave the variables unset to run without remote image generation.
- Context7 documentation access: set `ENABLE_CONTEXT7=1` and
  `CONTEXT7_API_KEY`.

## Contributing

Open an issue for problems and ideas; pull requests are welcome.

## License

Apache 2.0 - see [LICENSE](LICENSE).
