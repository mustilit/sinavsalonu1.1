#!/usr/bin/env bash
# Oturum sonunda degisen dosyalarin ozetini log'a yaz.
set -euo pipefail

log_dir=".claude/logs"
mkdir -p "$log_dir"
log_file="$log_dir/session-$(date +%Y%m%d-%H%M%S).log"

{
  echo "Oturum sonu: $(date)"
  echo "--- git status ---"
  git status --short 2>/dev/null || true
  echo ""
  echo "--- git diff --stat ---"
  git diff --stat 2>/dev/null || true
} > "$log_file"

exit 0
