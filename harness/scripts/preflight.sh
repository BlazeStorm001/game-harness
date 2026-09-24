#!/usr/bin/env bash
set -Eeuo pipefail

harness_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd -- "$harness_root/.." && pwd)"
scenario=""

usage() {
  echo "Usage: $0 --scenario PATH" >&2
}

while (( $# > 0 )); do
  case "$1" in
    --scenario)
      shift
      [[ $# -gt 0 ]] || { usage; exit 2; }
      scenario="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  shift
done

[[ -n "$scenario" ]] || { usage; exit 2; }

"$harness_root/scripts/setup.sh" --check >/dev/null

provider="${PI_PROVIDER:-llama-cpp}"
model="${PI_MODEL:-qwen}"
url="${LLAMA_URL:-http://127.0.0.1:8080/v1}"
url="${url%/}"
pi_bin="$harness_root/node_modules/.bin/pi"

models_json="$(curl -fsS "$url/models")" || {
  echo "Cannot reach the model endpoint: $url/models" >&2
  exit 1
}
echo "$models_json" | jq -e --arg model "$model" \
  '.data[]? | select(.id == $model)' >/dev/null || {
    echo "Model '$model' was not found at $url/models" >&2
    exit 1
  }

workspace="$("$harness_root/scripts/create-workspace.sh" "$scenario")"
cleanup() {
  case "$workspace/" in
    "$repo_root/.runs/"*) rm -rf -- "$workspace" ;;
  esac
}
trap cleanup EXIT

export AGENT_EVAL_HARNESS_DIR="$harness_root"
export PI_CODING_AGENT_DIR="$harness_root/.runtime/pi-agent"
export PLAYWRIGHT_BROWSERS_PATH="$harness_root/.runtime/browsers"
export PI_SKIP_VERSION_CHECK=1
export PI_TELEMETRY=0
export LLAMA_BASE_URL="$url"
export LLAMA_API_KEY="${LLAMA_API_KEY:-no-key}"
export PREFLIGHT_IMAGE="$workspace/.harness/pi-vision-preflight.png"

cd "$harness_root"
node --input-type=module <<'NODE'
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent("<title>OK</title><h1 style='font:100px sans-serif'>VISION_OK_7319</h1>");
if (await page.title() !== "OK") throw new Error("browser check failed");
await page.screenshot({ path: process.env.PREFLIGHT_IMAGE });
await browser.close();
NODE

cd "$workspace"
common=(
  --provider "$provider"
  --model "$model"
  --no-context-files
  --no-skills
  --no-builtin-tools
  --no-session
  --approve
  -p
)

report_failure() {
  local message="$1"
  local output_file="$2"
  echo "$message" >&2
  if [[ -s "$output_file" ]]; then
    echo "Captured output:" >&2
    cat -- "$output_file" >&2
  fi
  exit 1
}

text_output=.harness/pi-preflight.txt
if ! timeout 240 "$pi_bin" "${common[@]}" \
  'Reply exactly: PI_OK. Do not use tools.' > "$text_output"; then
  report_failure "Pi failed during the text preflight." "$text_output"
fi
rg -Fx -e 'PI_OK' -e 'PI_OK.' "$text_output" >/dev/null || \
  report_failure "The model did not return the expected text preflight response." "$text_output"

vision_output=.harness/pi-vision-preflight.txt
if ! timeout 240 "$pi_bin" "${common[@]}" \
  @.harness/pi-vision-preflight.png \
  'Read the large text in this image. Reply with only that text.' \
  > "$vision_output"; then
  report_failure "Pi failed during the vision preflight." "$vision_output"
fi
rg -Fx 'VISION_OK_7319' "$vision_output" >/dev/null || \
  report_failure "The model did not return the expected vision preflight response." "$vision_output"

tool_output=.harness/pi-tool-preflight.jsonl
if ! timeout 240 "$pi_bin" "${common[@]}" \
  --mode json \
  --tools game_test \
  'Call game_test exactly once with operation "close". Do not answer before calling the tool.' \
  > "$tool_output"; then
  report_failure "Pi failed during the game_test tool-call preflight." "$tool_output"
fi
jq -e \
  'select(.type == "tool_execution_end" and .toolName == "game_test" and .isError == false)' \
  "$tool_output" >/dev/null || \
  report_failure "The model did not complete the game_test tool-call preflight." "$tool_output"

echo "Preflight passed: model, Pi, game_test, vision, and browser."
