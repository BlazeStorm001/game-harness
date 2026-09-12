#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  generate-image.sh "PROMPT" [OUTPUT_PATH] [STEPS] [--remove-bg]

Examples:
  ./scripts/generate-image.sh \
    "2D game environment tile, top-down view" \
    assets/generated/environment-tile.png

  ./scripts/generate-image.sh \
    "2D game character sprite, isolated, front view" \
    assets/generated/character.png \
    4 \
    --remove-bg

Notes:
- Cloudflare FLUX.1 Schnell returns JPEG bytes encoded as base64.
- This script can convert the result to PNG automatically.
- --remove-bg uses `rembg` if installed.
EOF
}

[[ $# -ge 1 ]] || { usage; exit 2; }

prompt="$1"
output="${2:-assets/generated/image-$(date +%Y%m%d-%H%M%S).png}"
steps="${3:-4}"
remove_bg="false"

if [[ "${4:-}" == "--remove-bg" ]]; then
  remove_bg="true"
fi

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is not set}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is not set}"

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

mkdir -p "$(dirname "$output")"

command -v curl >/dev/null || { echo "Missing: curl" >&2; exit 1; }
command -v jq >/dev/null || { echo "Missing: jq" >&2; exit 1; }
command -v base64 >/dev/null || { echo "Missing: base64" >&2; exit 1; }
command -v magick >/dev/null || { echo "Missing: magick (ImageMagick)" >&2; exit 1; }

tmp_json="$(mktemp)"
tmp_jpg="$(mktemp --suffix=.jpg)"
tmp_png="$(mktemp --suffix=.png)"
trap 'rm -f "$tmp_json" "$tmp_jpg" "$tmp_png"' EXIT

echo "Generating image from Cloudflare FLUX.1 Schnell..."
curl -fsS \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell" \
  -X POST \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$(
    jq -n \
      --arg prompt "$prompt" \
      --argjson steps "$steps" \
      '{
        prompt: $prompt,
        steps: $steps
      }'
  )" \
  > "$tmp_json"

success="$(jq -r '.success // false' "$tmp_json")"
if [[ "$success" != "true" ]]; then
  echo "Cloudflare generation failed:" >&2
  jq . "$tmp_json" >&2
  exit 1
fi

jq -r '.result.image' "$tmp_json" | base64 --decode > "$tmp_jpg"

ext="${output##*.}"
ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"

# If background removal is requested, convert to PNG first.
if [[ "$remove_bg" == "true" ]]; then
  command -v rembg >/dev/null || {
    echo "Missing: rembg" >&2
    echo "Install it with: pip install rembg" >&2
    exit 1
  }

  echo "Converting to PNG before background removal..."
  magick "$tmp_jpg" "$tmp_png"

  echo "Removing background..."
  rembg i "$tmp_png" "$output"

  echo "$output"
  exit 0
fi

case "$ext" in
  png)
    echo "Converting JPEG to PNG..."
    magick "$tmp_jpg" "$output"
    ;;
  jpg|jpeg)
    cp "$tmp_jpg" "$output"
    ;;
  *)
    echo "Unsupported output extension: .$ext" >&2
    echo "Use .png, .jpg, or .jpeg" >&2
    exit 2
    ;;
esac

echo "$output"
