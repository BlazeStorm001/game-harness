#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="$root/.runtime/browsers"

browser="$({
  cd "$root"
  node -e "const { chromium }=require('./node_modules/@playwright/test'); process.stdout.write(chromium.executablePath())"
})"

exec "$root/node_modules/.bin/playwright-mcp" \
  --headless \
  --isolated \
  --browser chromium \
  --viewport-size=1280x720 \
  --executable-path "$browser" \
  "$@"
