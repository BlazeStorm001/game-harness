# NEON BREACH Case Study

NEON BREACH is the preserved output of the Qwen3.8-27B evaluation. Qwen created
a game, procedural pixel art, production tests, exploratory Playwright scripts,
and autonomous play bots.

- [`game/`](game/) is the complete game snapshot, including Qwen's historical
  root-level screenshots under their original filenames.
- [`game/.playwright-mcp/`](game/.playwright-mcp/) contains the main session's
  browser artifacts: scripts, bots, console captures, page snapshots, and images.
- [`scenario/`](scenario/) preserves the prompts and reference
  images associated with the main experiment, independently of the active harness scenario.
- [`artifacts.sha256`](artifacts.sha256) verifies the preserved output.

Run the game locally:

```bash
cd examples/neon-breach/game
npm start
```

Open <http://localhost:8000>. The Qwen-authored [game README](game/README.md)
contains controls and implementation details.

## Run Findings

One main Pi session continued across 3 overnight harness launches; later
launches used `--resume-latest`. Three `final` event logs are nightly validation
checkpoints in that continuing session.

Qwen initially attempted browser verification through Playwright MCP. When
compact, reliable game-state testing remained difficult, we added the generic
`game_test` extension and a stronger contract prompt. Qwen then implemented
`window.__gameTest` against production game logic and created richer tests and autonomous bots.

The logs contain 67 deduplicated `game_test` calls and no `generate_image`
calls. The optional Cloudflare image tool was available, but Qwen chose
procedural JavaScript sprite maps.

## Run Configuration

- Model: Unsloth Qwen3.8-27B `UD-Q3_K_XL` GGUF with F16 mmproj
- Hardware: NVIDIA RTX 5060 Ti, 16 GB VRAM, NVIDIA T400 4 GB VRAM (for mmproj)
- Context: 50,176 tokens

## Summary

| Measure | Count | Method |
| --- | ---: | --- |
| Qwen-created source and configuration | about 4,900 lines | 4,912 lines across preserved code, tests, bots, scripts, markup, styles, and package configuration |
| Input context tokens | about 54.4 million | 8,522,737 uncached input tokens plus 45,877,758 cache-read tokens |
| Output tokens | about 1.0 million | 1,002,728 provider-reported tokens |
| Deduplicated saved-session tool calls | 1,178 | Unique tool-call IDs in the session |
| `game_test` tool calls | 67 | Unique tool-call IDs |
| Browser automation calls | 261 | Unique Playwright MCP tool-call IDs |
| Browser screenshots requested | 22 | Unique `mcp_playwright_browser_take_screenshot` calls |
| Historical screenshots retained | 27 | Screenshot files in the preserved game snapshot |

Token totals are exact sums of the usage recorded for 1,322 completed model
responses. They exclude 34 context-limit rejections and two connection errors;
those records report zero usage. The decode speed was around 25 tokens per second on average with VRAM consumption hovering around 15.3 GB.

## Demo

[Watch the NEON BREACH demo](neon-breach-demo.mp4)

## Agent Trace

The sanitized agent trace is available as an interactive
[Agent Trace](https://blazestorm001.github.io/game-harness/traces.html).
