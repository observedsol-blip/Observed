# Spike 3 app — build notes

Signing credentials do NOT live here. `~/.config/observed/spike3-credentials.json` holds the
keystore path and passwords (0600). Before an EAS build:

    cp ~/.config/observed/spike3-credentials.json credentials.json
    npx eas build --platform android --profile spike3
    rm credentials.json

`credentials.json` is gitignored and was never committed. The check that showed it: `git log --all -S"keystorePassword" -- "*credentials.json"` = 0. (The bare `-S"keystorePassword"` now finds 3 commits — our own release documentation names the field, with placeholders. Corrected 22.09.2026 after the audit found the old claim false.)
The keystore itself is `~/.config/observed/spike3.jks` — test-only, never for a store release.
