#!/usr/bin/env bash
set -Eeuo pipefail

harness_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="$harness_root/.runtime"
agent_dir="$runtime_root/pi-agent"
pi_bin="$harness_root/node_modules/.bin/pi"
playwright_bin="$harness_root/node_modules/.bin/playwright"

pi_version="0.84.2"
pi_llama_commit="8a876fca45c7824a50cd74f01ea11e0bab7964a2"
pi_llama_source="git:github.com/huggingface/pi-llama@$pi_llama_commit"
pi_mcp_source="npm:pi-mcp-extension@1.5.0"

usage() {
  cat <<EOF
Usage:
  $0 --install   Install pinned harness dependencies locally
  $0 --check     Verify the local installation without changing it
EOF
}

[[ $# -eq 1 ]] || { usage >&2; exit 2; }
mode="$1"
[[ "$mode" == "--install" || "$mode" == "--check" ]] || {
  usage >&2
  exit 2
}

required=(bash node npm git curl jq rg timeout sha256sum realpath find sort tee)
for command in "${required[@]}"; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( node_major >= 20 )) || {
  echo "Node.js 20 or newer is required." >&2
  exit 1
}

export PI_CODING_AGENT_DIR="$agent_dir"
export PLAYWRIGHT_BROWSERS_PATH="$runtime_root/browsers"
export PI_SKIP_VERSION_CHECK=1
export PI_TELEMETRY=0
export GIT_TERMINAL_PROMPT=0

check_installation() {
  [[ -x "$pi_bin" && -x "$playwright_bin" ]] || {
    echo "Harness dependencies are not installed." >&2
    echo "Run: ./harness/scripts/setup.sh --install" >&2
    return 1
  }

  [[ "$($pi_bin --version)" == "$pi_version" ]] || {
    echo "Unexpected Pi version. Run: ./harness/scripts/setup.sh --install" >&2
    return 1
  }

  settings="$agent_dir/settings.json"
  [[ -f "$settings" ]] || {
    echo "Isolated Pi packages are not installed." >&2
    echo "Run: ./harness/scripts/setup.sh --install" >&2
    return 1
  }

  jq -e --arg llama "$pi_llama_source" --arg mcp "$pi_mcp_source" \
    '(.packages // []) | index($llama) != null and index($mcp) != null' \
    "$settings" >/dev/null || {
      echo "Pinned Pi packages are missing." >&2
      echo "Run: ./harness/scripts/setup.sh --install" >&2
      return 1
    }

  llama_dir="$agent_dir/git/github.com/huggingface/pi-llama"
  [[ -d "$llama_dir/.git" ]] && \
    [[ "$(git -C "$llama_dir" rev-parse HEAD)" == "$pi_llama_commit" ]] || {
      echo "The pinned pi-llama checkout is missing." >&2
      echo "Run: ./harness/scripts/setup.sh --install" >&2
      return 1
    }

  mcp_package="$agent_dir/npm/node_modules/pi-mcp-extension/package.json"
  [[ -f "$mcp_package" ]] && \
    [[ "$(jq -r '.version' "$mcp_package")" == "1.5.0" ]] || {
      echo "The pinned pi-mcp-extension package is missing." >&2
      echo "Run: ./harness/scripts/setup.sh --install" >&2
      return 1
    }

  cd "$harness_root"
  if ! node --input-type=module <<'NODE'
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent("<title>harness-check</title>");
if (await page.title() !== "harness-check") throw new Error("browser check failed");
await browser.close();
NODE
  then
    echo "Chromium could not start. Install its Linux system dependencies with:" >&2
    echo "  sudo $playwright_bin install-deps chromium" >&2
    return 1
  fi

  echo "Harness installation check passed."
}

if [[ "$mode" == "--check" ]]; then
  check_installation
  exit
fi

mkdir -p "$runtime_root" "$agent_dir"
cd "$harness_root"
npm ci

"$playwright_bin" install chromium
"$pi_bin" install "$pi_llama_source" --no-approve
"$pi_bin" install "$pi_mcp_source" --no-approve

check_installation
