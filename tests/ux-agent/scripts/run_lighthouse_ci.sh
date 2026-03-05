#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
LHCI_CONFIG="${REPO_ROOT}/tests/ux-agent/config/lighthouserc.json"

if [[ -z "${CHROME_PATH:-}" ]]; then
  CHROME_PATH="$(node --input-type=module -e "import { chromium } from 'playwright'; console.log(chromium.executablePath())")"
  export CHROME_PATH
fi

echo "Using CHROME_PATH=${CHROME_PATH}"
npx lhci autorun --config="${LHCI_CONFIG}"
