#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CHROME_PATH:-}" ]]; then
  CHROME_PATH="$(node --input-type=module -e "import { chromium } from 'playwright'; console.log(chromium.executablePath())")"
  export CHROME_PATH
fi

echo "Using CHROME_PATH=${CHROME_PATH}"
npx lhci autorun --config=./lighthouserc.json
