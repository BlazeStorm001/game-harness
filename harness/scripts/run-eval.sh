#!/usr/bin/env bash
set -Eeuo pipefail

harness_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd -- "$harness_root/.." && pwd)"
workspaces_root="$repo_root/.runs"

hours=10
hours_set=false
scenario="neon-breach"
resume_latest=false
skip_preflight=false

usage() {
  cat <<EOF
Usage:
  $0 [--scenario PATH_OR_NAME] [--hours N]
  $0 --resume-latest [--hours N]

Options:
  --scenario PATH_OR_NAME  Scenario directory or bundled scenario name
  --hours N                Total runtime in hours (default: 10)
  --resume-latest          Continue the newest saved session
  --skip-preflight         Skip model text/vision smoke calls

Environment:
  TURN_MINUTES             Per-turn watchdog (default: 75)
  FINAL_MINUTES            Reserved final phase (default: 60)
  PI_PROVIDER              Pi provider (default: llama-cpp)
  PI_MODEL                 Served model ID (default: qwen)
  LLAMA_URL                OpenAI-compatible base URL
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --scenario)
      shift
      [[ $# -gt 0 ]] || { echo "--scenario requires a value" >&2; exit 2; }
      scenario="$1"
      ;;
    --hours)
      shift
      [[ $# -gt 0 ]] || { echo "--hours requires a value" >&2; exit 2; }
      hours="$1"
      hours_set=true
      ;;
    --resume-latest)
      resume_latest=true
      ;;
    --skip-preflight)
      skip_preflight=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]] && [[ "$hours_set" == false ]]; then
        hours="$1"
        hours_set=true
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 2
      fi
      ;;
  esac
  shift
done

[[ "$hours" =~ ^[0-9]+$ ]] && (( hours >= 2 )) || {
  echo "Use at least two hours." >&2
  exit 2
}

turn_minutes="${TURN_MINUTES:-75}"
final_minutes="${FINAL_MINUTES:-60}"
[[ "$turn_minutes" =~ ^[0-9]+$ && "$final_minutes" =~ ^[0-9]+$ ]] || {
  echo "TURN_MINUTES and FINAL_MINUTES must be whole numbers." >&2
  exit 2
}
(( final_minutes < hours * 60 )) || {
  echo "FINAL_MINUTES must be shorter than the total run." >&2
  exit 2
}

"$harness_root/scripts/setup.sh" --check >/dev/null

provider="${PI_PROVIDER:-llama-cpp}"
model="${PI_MODEL:-qwen}"
url="${LLAMA_URL:-http://127.0.0.1:8080/v1}"
url="${url%/}"
pi_bin="$harness_root/node_modules/.bin/pi"

check_model() {
  local models_json
  models_json="$(curl -fsS "$url/models")" || {
    echo "Cannot reach the model endpoint: $url/models" >&2
    return 1
  }
  echo "$models_json" | jq -e --arg model "$model" \
    '.data[]? | select(.id == $model)' >/dev/null || {
      echo "Model '$model' was not found at $url/models" >&2
      return 1
    }
}

check_model

if [[ "$resume_latest" == true ]]; then
  latest_session_file=""
  [[ -d "$workspaces_root" ]] || {
    echo "No evaluation workspace directory found: $workspaces_root" >&2
    exit 1
  }
  latest_session_file="$(
    find "$workspaces_root" -mindepth 1 -type f -name '*.jsonl' \
      -path '*/.harness/pi-sessions/*' -printf '%T@ %p\n' 2>/dev/null |
      sort -nr | head -1 | cut -d' ' -f2-
  )"
  [[ -n "$latest_session_file" ]] && \
    workspace="${latest_session_file%%/.harness/pi-sessions/*}"
  [[ -n "${workspace:-}" && -d "$workspace/.harness/pi-sessions" ]] || {
    echo "No evaluation workspace with saved sessions was found." >&2
    exit 1
  }
  workspace="$(realpath "$workspace")"
else
  if [[ "$skip_preflight" == false ]]; then
    "$harness_root/scripts/preflight.sh" --scenario "$scenario"
  fi
  workspace="$("$harness_root/scripts/create-workspace.sh" "$scenario")"
fi

export AGENT_EVAL_HARNESS_DIR="$harness_root"
export PI_CODING_AGENT_DIR="$harness_root/.runtime/pi-agent"
export PLAYWRIGHT_BROWSERS_PATH="$harness_root/.runtime/browsers"
export PI_SKIP_VERSION_CHECK=1
export PI_TELEMETRY=0
export LLAMA_BASE_URL="$url"
export LLAMA_API_KEY="${LLAMA_API_KEY:-no-key}"

cd "$workspace"
mkdir -p eval-logs .harness/pi-sessions

start_epoch="$(date +%s)"
started_at="$(date --iso-8601=seconds)"
deadline=$((start_epoch + hours * 3600))
final_start=$((deadline - final_minutes * 60))
run_id="$(date +%Y%m%d-%H%M%S)"
turn=0
failures=0
context_failures=0
stop_reason="completed"

if [[ "$resume_latest" == true ]]; then
  latest_session_file="$(
    find .harness/pi-sessions -mindepth 2 -maxdepth 2 -type f -name '*.jsonl' \
      -printf '%T@ %p\n' |
      sort -nr | head -1 | cut -d' ' -f2-
  )"
  [[ -n "$latest_session_file" ]] || {
    echo "No saved Pi session found in $workspace" >&2
    exit 1
  }
  session_dir="$(dirname "$latest_session_file")"
  previous_metadata="$(
    find eval-logs -maxdepth 1 -name '*-run.json' -type f -printf '%T@ %p\n' 2>/dev/null |
      sort -nr | head -1 | cut -d' ' -f2-
  )"
  if [[ -n "$previous_metadata" ]]; then
    scenario_name="$(jq -r '.scenario.name // "unknown"' "$previous_metadata")"
  else
    scenario_name="unknown"
  fi
else
  session_dir=".harness/pi-sessions/$run_id"
  mkdir -p "$session_dir"
  if [[ -d "$scenario" ]]; then
    scenario_root="$(realpath "$scenario")"
  else
    scenario_root="$harness_root/scenarios/$scenario"
  fi
  scenario_name="$(basename "$scenario_root")"
fi

(
  find prompts references .pi/extensions -type f -print0
  printf '%s\0' .pi/mcp.json scripts/generate-image.sh
) | sort -z | xargs -0 sha256sum > .harness/inputs.sha256

input_hashes="$(
  jq -Rn '[inputs | select(length > 0) |
    capture("^(?<sha256>[0-9a-f]{64})  (?<file>.*)$")]' < .harness/inputs.sha256
)"

hash_file() { sha256sum "$1" | cut -d' ' -f1; }

metadata="eval-logs/$run_id-run.json"
jq -n \
  --arg runId "$run_id" \
  --arg startedAt "$started_at" \
  --arg workspace "/workspace/evaluation" \
  --arg sessionDirectory "$session_dir" \
  --arg provider "$provider" \
  --arg model "$model" \
  --arg endpoint "$url" \
  --arg scenarioName "$scenario_name" \
  --arg piVersion "$($pi_bin --version)" \
  --arg playwrightVersion "$(node -p "require('$harness_root/node_modules/@playwright/test/package.json').version")" \
  --arg piLlamaCommit "$(git -C "$harness_root/.runtime/pi-agent/git/github.com/huggingface/pi-llama" rev-parse HEAD)" \
  --arg piMcpVersion "$(jq -r '.version' "$harness_root/.runtime/pi-agent/npm/node_modules/pi-mcp-extension/package.json")" \
  --arg presetHash "$(hash_file "$harness_root/presets/qwen3.8-27b-rtx5060ti.ini")" \
  --argjson inputs "$input_hashes" \
  --argjson resumed "$resume_latest" \
  --argjson requestedHours "$hours" \
  --argjson turnMinutes "$turn_minutes" \
  --argjson finalMinutes "$final_minutes" \
  '{schemaVersion: 1, runId: $runId, startedAt: $startedAt,
    workspace: $workspace, resumed: $resumed, requestedHours: $requestedHours,
    turnMinutes: $turnMinutes, finalMinutes: $finalMinutes, provider: $provider,
    model: $model, endpoint: $endpoint, sessionDirectory: $sessionDirectory,
    scenario: {name: $scenarioName, inputs: $inputs},
    versions: {pi: $piVersion, playwright: $playwrightVersion,
      piLlamaCommit: $piLlamaCommit, piMcpExtension: $piMcpVersion},
    hashes: {preset: $presetHash}, turns: []}' > "$metadata"

session_id() {
  local file
  file="$(find "$session_dir" -maxdepth 1 -type f -name '*.jsonl' -print -quit)"
  [[ -n "$file" ]] || return 0
  head -1 "$file" | jq -r 'select(.type == "session") | .id // empty' 2>/dev/null || true
}

finalize_metadata() {
  local status="$?" tmp="${metadata}.tmp"
  jq --arg endedAt "$(date --iso-8601=seconds)" \
    --arg sessionId "$(session_id)" --arg stopReason "$stop_reason" \
    --argjson exitStatus "$status" \
    '. + {endedAt: $endedAt, sessionId: $sessionId,
      stopReason: $stopReason, exitStatus: $exitStatus}' \
    "$metadata" > "$tmp" && mv "$tmp" "$metadata"
}
trap finalize_metadata EXIT

record_turn() {
  local index="$1" label="$2" turn_started="$3" turn_ended="$4"
  local seconds="$5" process_status="$6" agent_error="$7" log_file="$8"
  local tmp="${metadata}.tmp"
  jq --argjson index "$index" --arg label "$label" \
    --arg startedAt "$turn_started" --arg endedAt "$turn_ended" \
    --argjson timeoutSeconds "$seconds" --argjson exitStatus "$process_status" \
    --argjson agentError "$agent_error" --arg logFile "$log_file" \
    '.turns += [{index: $index, label: $label, startedAt: $startedAt,
      endedAt: $endedAt, timeoutSeconds: $timeoutSeconds,
      exitStatus: $exitStatus, agentError: $agentError, logFile: $logFile}]' \
    "$metadata" > "$tmp" && mv "$tmp" "$metadata"
}

base=(
  --provider "$provider"
  --model "$model"
  --session-dir "$session_dir"
  --no-context-files
  --no-skills
  --approve
  --mode json
)
last_context_error=false
last_elapsed=0

run_prompt() {
  local prompt_file="$1" seconds="$2" label="$3" initial="$4"
  local status process_status prompt log_file turn_started turn_ended
  local turn_start_epoch last_agent_stop agent_error
  local -a args image_args

  turn=$((turn + 1))
  prompt="$(cat "$prompt_file")"
  log_file="eval-logs/$run_id-$(printf '%02d' "$turn")-$label.jsonl"
  turn_started="$(date --iso-8601=seconds)"
  turn_start_epoch="$(date +%s)"
  args=("$pi_bin" "${base[@]}")

  if [[ "$initial" == true ]]; then
    shopt -s nullglob nocaseglob
    image_args=(references/*.png references/*.jpg references/*.jpeg references/*.webp)
    shopt -u nullglob nocaseglob
    args+=(--name "agent-eval-$run_id" "${image_args[@]/#/@}" "$prompt")
  else
    args+=(--continue "$prompt")
  fi

  echo "Turn $turn: $label ($((seconds / 60)) minute limit)"
  set +e
  timeout --signal=INT --kill-after=180s "${seconds}s" "${args[@]}" 2>&1 | tee "$log_file"
  process_status=${PIPESTATUS[0]}
  set -e

  turn_ended="$(date --iso-8601=seconds)"
  last_elapsed=$(($(date +%s) - turn_start_epoch))
  last_agent_stop="$(
    jq -Rr 'fromjson? | select(.type == "agent_end") |
      ([.messages[]? | select(.role == "assistant")][-1].stopReason // empty)' \
      "$log_file" 2>/dev/null | tail -1
  )"
  agent_error=false
  [[ "$last_agent_stop" == "error" ]] && agent_error=true

  last_context_error=false
  if rg -qi 'context.{0,40}(exceed|limit)|exceeds the available context|n_ctx' "$log_file"; then
    last_context_error=true
  fi

  record_turn "$turn" "$label" "$turn_started" "$turn_ended" "$seconds" \
    "$process_status" "$agent_error" "$log_file"

  status="$process_status"
  if [[ $status -eq 0 && "$agent_error" == true ]]; then
    status=1
  fi
  return "$status"
}

echo "Workspace: $workspace"
echo "Session:   $session_dir"

if [[ "$resume_latest" == false ]]; then
  run_prompt prompts/initial.txt "$((turn_minutes * 60))" initial true || {
    status=$?
    [[ $status -eq 124 || $status -eq 130 ]] || failures=1
  }
else
  echo "Resuming saved session; initial prompt and reference images are not replayed."
fi

while (( $(date +%s) < final_start && failures < 3 )); do
  remaining=$((final_start - $(date +%s)))
  limit=$((turn_minutes * 60))
  (( limit > remaining )) && limit="$remaining"
  (( limit > 60 )) || break

  if run_prompt prompts/continue.txt "$limit" continue false; then
    failures=0
  else
    status=$?
    if [[ $status -eq 124 || $status -eq 130 ]]; then
      failures=0
    else
      failures=$((failures + 1))
    fi
  fi

  if [[ "$last_context_error" == true && $last_elapsed -lt 300 ]]; then
    context_failures=$((context_failures + 1))
  else
    context_failures=0
  fi

  if (( context_failures >= 2 )); then
    stop_reason="repeated-context-errors"
    echo "Stopping after two immediate context-limit failures." >&2
    break
  fi
done

if (( failures >= 3 )); then
  stop_reason="consecutive-failures"
fi

remaining=$((deadline - $(date +%s)))
if (( remaining > 60 )) && [[ "$stop_reason" != "repeated-context-errors" ]]; then
  final_limit=$((final_minutes * 60))
  (( final_limit > remaining )) && final_limit="$remaining"
  if run_prompt prompts/final.txt "$final_limit" final false; then
    :
  else
    status=$?
    if [[ $status -ne 124 && $status -ne 130 ]]; then
      stop_reason="final-turn-failed"
    fi
  fi
fi

echo "Evaluation finished. Metadata: $workspace/$metadata"

if [[ "$stop_reason" == "completed" ]]; then
  exit 0
fi
exit 1
