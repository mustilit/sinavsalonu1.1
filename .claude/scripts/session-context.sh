#!/usr/bin/env bash
# Oturum basinda repo durumunu kisaca Claude'a bildir.
set -euo pipefail

{
  echo "### Repo durumu"
  git status --short 2>/dev/null | head -20
  echo ""
  echo "### Son 5 commit"
  git log --oneline -5 2>/dev/null
  echo ""
  echo "### Aktif branch"
  git rev-parse --abbrev-ref HEAD 2>/dev/null
} 1>&2

exit 0
