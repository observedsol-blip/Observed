#!/usr/bin/env bash
# Blocks access to keys, secrets and the frozen spec. Exit 2 = block with message.
#
# Two ways in, since the audit of 21.09.2026:
#   1. Edit/Write/MultiEdit — the path is in the call.
#   2. Bash — the path is somewhere in the command. That way was not covered at all before:
#      `sed -i docs/00-SPEC.md` ran straight through although the spec is frozen, and that is
#      exactly how the agent had been working. The command is read now.
#
# This stays a speed bump, not a boundary: a shell has endless spellings for the same path
# ($HOME, variables, base64). The hard lock for the spec is .githooks/pre-commit, because git
# sees every change no matter what wrote it.
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
command=$(echo "$input" | jq -r '.tool_input.command // empty')

block_secret() {
  echo "Blocked: '$1' is a key/secret location. Keys never live in the repo." >&2
  exit 2
}
block_spec() {
  [ -f ".spec-unlock" ] && exit 0
  echo "Blocked: the spec is frozen. Owner creates .spec-unlock for an approved change." >&2
  exit 2
}

# --- way 1: the path is in the call
if [ -n "$path" ]; then
  case "$path" in
    *keys/*|*.env|*.env.*|*/.config/observed/*|*/.config/solana/*|*id.json|*keypair*) block_secret "$path" ;;
    *docs/00-SPEC.md) block_spec ;;
  esac
fi

# --- way 2: Bash. Secret locations first (reading them counts), then the spec.
if [ -n "$command" ]; then
  # `Read(~/.config/observed/**)` in settings.json only covers the Read tool — `cat
  # ~/.config/observed/...` would walk past it.
  case "$command" in
    *".config/observed"*|*".config/solana"*|*"/keys/"*|*".keystore"*|*".jks"*)
      block_secret "$(echo "$command" | head -c 80)" ;;
  esac
  case "$command" in
    *docs/00-SPEC.md*)
      case "$command" in
        *sed\ -i*|*">"*|*">>"*|*tee*|*mv*|*cp*|*rm*|*truncate*|*python*|*perl*|*awk*) block_spec ;;
      esac ;;
  esac
fi

exit 0
