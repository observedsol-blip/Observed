#!/usr/bin/env bash
# Blocks edits to secrets, keys and the frozen spec. Exit 2 = block with message.
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
[ -z "$path" ] && exit 0
case "$path" in
  *keys/*|*.env|*.env.*|*/.config/observed/*|*/.config/solana/*|*id.json|*keypair*)
    echo "Blocked: '$path' is a key/secret location. Keys never live in the repo." >&2; exit 2;;
  *docs/00-SPEC.md)
    echo "Blocked: the spec is frozen. Propose a dated change line to the owner instead." >&2; exit 2;;
esac
exit 0
