#!/usr/bin/env bash
set -Eeuo pipefail

harness_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd -- "$harness_root/.." && pwd)"
workspaces_root="$repo_root/.runs"
scenario="${1:-}"

usage() {
  echo "Usage: $0 SCENARIO_PATH" >&2
}

(( $# <= 1 )) || { usage; exit 2; }
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi
[[ -n "$scenario" ]] || { usage; exit 2; }

[[ -d "$scenario" ]] || {
  echo "Scenario directory not found: $scenario" >&2
  exit 2
}
scenario_root="$(realpath "$scenario")"

for prompt in initial continue final; do
  [[ -f "$scenario_root/prompts/$prompt.txt" ]] || {
    echo "Scenario is missing prompts/$prompt.txt: $scenario_root" >&2
    exit 2
  }
done

scenario_name="$(basename "$scenario_root")"
mkdir -p "$workspaces_root"
workspace="$workspaces_root/$scenario_name-$(date +%Y%m%d-%H%M%S)"
if [[ -e "$workspace" ]]; then
  echo "Evaluation workspace already exists: $workspace" >&2
  exit 2
fi

mkdir -p \
  "$workspace/.pi/extensions" \
  "$workspace/.harness/pi-sessions" \
  "$workspace/assets/generated" \
  "$workspace/eval-logs" \
  "$workspace/prompts" \
  "$workspace/references" \
  "$workspace/scripts"

cp "$harness_root/extensions/"*.ts "$workspace/.pi/extensions/"
cp "$scenario_root/prompts/"*.txt "$workspace/prompts/"
cp "$harness_root/scripts/generate-image.sh" "$workspace/scripts/"

if [[ "${ENABLE_CONTEXT7:-0}" == "1" ]]; then
  : "${CONTEXT7_API_KEY:?CONTEXT7_API_KEY is required when ENABLE_CONTEXT7=1}"
  cp "$harness_root/mcp-with-context7.json" "$workspace/.pi/mcp.json"
else
  cp "$harness_root/mcp.json" "$workspace/.pi/mcp.json"
fi

if [[ -d "$scenario_root/references" ]]; then
  find "$scenario_root/references" -maxdepth 1 -type f \
    \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) \
    -exec cp {} "$workspace/references/" \;
fi

printf '%s\n' "$workspace"
