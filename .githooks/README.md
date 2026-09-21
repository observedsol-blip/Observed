# Git-Hooks

Ein Hook. Er verweigert einen Commit, der `docs/00-SPEC.md` ohne `.spec-unlock` ändert,
Schlüsselmaterial einchecken würde oder ein Keystore-Passwort im Klartext enthält.

**Einmal pro Arbeitskopie aktivieren:**

```
git config core.hooksPath .githooks
```

Git kopiert Hooks nicht beim Klonen, deshalb dieser eine Befehl. Ob er gilt:

```
git config --get core.hooksPath     # muss .githooks sagen
```

**Was der Hook nicht ist:** eine Grenze. `git commit --no-verify` geht daran vorbei, und wer
direkt in `.git/` schreibt, erst recht. Er fängt Versehen ab — vor allem das Versehen, die
eingefrorene Spec über ein Shell-Skript zu ändern, an dem der Werkzeug-Hook in
`.claude/settings.json` vorbeischaut (Audit vom 21.09.2026).
