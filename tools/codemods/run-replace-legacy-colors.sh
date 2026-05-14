#!/usr/bin/env bash
# Re-runner for the legacy-color codemod. Run from the repo root.
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found â please install Node.js (>=18)" >&2
  exit 1
fi

# Generate a JSON mirror of the legacy color map so the codemod can require() it.
node -e "
  const fs = require('fs');
  const ts = fs.readFileSync('theme/legacy-color-map.ts', 'utf8');
  const map = {};
  const re = /\"(#[A-Fa-f0-9]{3,8})\"\s*:\s*\"([^\"]+)\"/g;
  let m;
  while ((m = re.exec(ts)) !== null) {
    if (m[2] !== 'TODO_REVIEW') map[m[1].toUpperCase()] = m[2];
  }
  fs.writeFileSync('theme/legacy-color-map.json', JSON.stringify(map, null, 2));
  console.log('Wrote theme/legacy-color-map.json with', Object.keys(map).length, 'entries.');
"

npx -y jscodeshift@0.15.2 \
  -t tools/codemods/replace-legacy-colors.js \
  expo/ \
  --extensions=ts,tsx,js,jsx \
  --parser=tsx \
  --ignore-pattern='**/node_modules/**' \
  --ignore-pattern='**/__tests__/**' \
  --ignore-pattern='**/*.test.*' \
  --ignore-pattern='**/*.spec.*'
