# NEON BREACH Case Study

This is the preserved output of a nine-hour Qwen3.8-27B (3-bit quantized) evaluation run. Qwen created the game, procedural pixel art, automated tests, browser experiments, and captured screenshots.

- [`game/`](game/) is the unchanged project produced during the run.
- [`scenario/`](scenario/) contains the supplied prompts and reference images.
- [`artifacts.sha256`](artifacts.sha256) verifies every preserved game file.
- [`traces.html`](traces.html) is the complete interactive Pi session export.
- [`qwen3.8-27b-rtx5060ti.ini`](qwen3.8-27b-rtx5060ti.ini) is llama.cpp preset used.

Run the game locally:

```bash
cd examples/neon-breach/game
python3 -m http.server 8123
```

Open <http://127.0.0.1:8123>

## Run Summary

The run used one Pi session that lasted nine hours. It contained one initial turn, seven continuation turns, and one final-validation turn. The initial prompt supplied the generic `game_test` interface alongside Playwright MCP;
Qwen implemented the required deterministic `window.__gameTest` contract in the production game.

Qwen did not call the optional `generate_image` tool. It generated the game's art procedurally in JavaScript and used browser screenshots while testing.

## Run Configuration

The llama.cpp server used an ASCII-condensed Qwen3.8-27B `UD-Q3_K_XL` target derived from the methods described here [bsaleh03/Qwen3.8-27B-ASCII-Condensed](https://huggingface.co/bsaleh03/Qwen3.8-27B-ASCII-Condensed)
with a compatible ASCII-condensed DFlash2 [Q2_K draft](https://huggingface.co/Blazestorm001/Qwen3.8-27B-ASCII-Condensed-DFlash2-GGUF) exported using the same
token mapping. It ran with an 86,000-token context, Q4 target and draft KV
caches, and DFlash proposals of up to four tokens. The target and draft ran on
an RTX 5060 Ti; the F16 multimodal projector ran on a T400.


| Measure | Count | Method |
| --- | ---: | --- |
| Qwen-created game and test code | 3,137 lines | HTML, JavaScript, and `.mjs` files in `game/` |
| Provider-reported input context | 46,346,032 tokens | Uncached input plus cache-read tokens |
| Provider-reported output | 618,034 tokens | Sum across saved assistant records |
| Tool calls | 749 | Unique tool-call IDs in the saved session |
| `game_test` calls | 192 | Unique tool-call IDs |
| Playwright MCP calls | 140 | All `mcp_playwright_*` tool calls |
| Browser screenshots requested | 27 | `mcp_playwright_browser_take_screenshot` calls |
| Image blocks processed | 69 | Image content blocks in the saved session |
| Screenshots retained with the game | 7 | PNG files in the game root |

## Demo

[Watch the NEON BREACH demo](neon-breach-eval-demo.mp4).

## Agent Trace

The complete session is available as an interactive
[agent trace](https://blazestorm001.github.io/game-harness/traces.html).
