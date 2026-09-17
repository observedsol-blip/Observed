#!/usr/bin/env bash
# Blocks edits to secrets, keys and the frozen spec. Exit 2 = block with message.
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
[ -z "$path" ] && exit 0
case "$path" in
  *keys/*|*.env|*.env.*|*/.config/observed/*|*/.config/solana/*|*id.json|*keypair*)
    echo "Blocked: '$path' is a key/secret location. Keys never live in the repo." >&2; exit 2;;
  *docs/00-SPEC.md)
    if [ -f ".spec-unlock" ]; then exit 0; fi
    echo "Blocked: the spec is frozen. Owner creates .spec-unlock for an approved change." >&2; exit 2;;
esac
exit 0
