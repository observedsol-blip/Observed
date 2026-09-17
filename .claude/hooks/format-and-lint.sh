#!/usr/bin/env bash
# After any edit: format Rust/TS and lint the program. Output is fed back to Claude.
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  *.rs) cargo fmt --all >/dev/null 2>&1; cargo clippy --all-targets -- -D warnings 2>&1 | tail -30 ;;
  *.ts|*.tsx) (cd app 2>/dev/null && npx prettier --write "$path" >/dev/null 2>&1; npm run -s typecheck 2>&1 | tail -30) ;;
esac
exit 0
