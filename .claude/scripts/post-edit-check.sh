#!/usr/bin/env bash
# Edit/Write sonrasinda degisen TS/TSX dosyalari icin typecheck + lint.
# Stdin: { "tool_name": "...", "tool_input": { "file_path": "..." }, ... }
set -euo pipefail

payload=$(cat)
file=$(echo "$payload" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

if [[ -z "$file" ]]; then
  exit 0
fi

# Sadece TS/TSX dosyalari
if [[ ! "$file" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

status=0

# Typecheck (proje kokunden tsc; tek dosya icin workspace-aware komut varsa degistir)
if command -v pnpm >/dev/null 2>&1 && [[ -f pnpm-lock.yaml ]]; then
  if ! pnpm -s typecheck 2>/tmp/tsc.out; then
    echo "typecheck basarisiz:" 1>&2
    tail -40 /tmp/tsc.out 1>&2
    status=1
  fi
fi

# Lint (degisen dosya icin)
if command -v pnpm >/dev/null 2>&1 && [[ -f pnpm-lock.yaml ]]; then
  if ! pnpm -s eslint "$file" 2>/tmp/eslint.out; then
    echo "eslint uyari/hata:" 1>&2
    tail -40 /tmp/eslint.out 1>&2
    # Lint warning'leri block etmesin diye exit 0 tutuyoruz; hata da olsa Claude gorur.
  fi
fi

exit $status
