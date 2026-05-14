#!/usr/bin/env bash
# Kritik dosyalara yanlislikla yazmayi engelle.
# Stdin: { "tool_name": "...", "tool_input": { "file_path": "..." }, ... }
set -euo pipefail

payload=$(cat)
file=$(echo "$payload" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

if [[ -z "$file" ]]; then
  exit 0
fi

# Korumali yollar
protected_patterns=(
  ".env"
  ".env.production"
  "prisma/migrations/.*"
  ".github/workflows/.*"
  "pnpm-lock.yaml"
)

for pattern in "${protected_patterns[@]}"; do
  if [[ "$file" =~ $pattern ]]; then
    echo "KORUMALI: '$file' hook tarafindan engellendi. Gerekiyorsa hook'u gecici devre disi birak veya manuel duzenle." 1>&2
    exit 1
  fi
done

exit 0
