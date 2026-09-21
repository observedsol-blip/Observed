# Release-Build der App — Konfiguration und der Schlüssel

Für Dinkelberg. **Den Schlüssel erzeugst du**, ich fasse `~/.config/observed/` nicht an. Diese
Seite sagt, welcher Befehl, wohin die Datei gehört, und was die Konfiguration daraus macht.

## Warum das jetzt entschieden wird
Der Signaturschlüssel ist ab dem ersten Build, den ein Tester installiert, **unveränderlich**.
Android verweigert jedes Update, das mit einem anderen Schlüssel signiert ist; der Tester müsste
deinstallieren, und eine Deinstallation löscht den Keystore mitsamt allen offenen Antworten. Der
Schlüssel vom 26.09. muss also bis zum Saisonende am 27.11. derselbe bleiben.

## 1. Den Schlüssel erzeugen (machst du, einmal)

```
mkdir -p ~/.config/observed
keytool -genkeypair -v \
  -keystore ~/.config/observed/observed-release.jks \
  -alias observed \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype JKS \
  -dname "CN=Observed, OU=Observed, O=Observed, L=-, ST=-, C=DE"
chmod 600 ~/.config/observed/observed-release.jks
```

`keytool` fragt zweimal nach einem Passwort (Keystore und Schlüssel — **nimm dasselbe**, EAS
erwartet beide Felder und verträgt gleiche Werte). Notiere es in deinem Passwortspeicher, nicht
in einer Datei im Repo.

`-validity 10000` sind gut 27 Jahre. Kürzer wäre falsch: Läuft der Schlüssel ab, lässt sich die
App nie wieder aktualisieren.

## 2. Die Zugangsdatei daneben legen (machst du)

**Das Passwort wird nicht in die Shell getippt.** Erst die leere Datei mit den richtigen Rechten
anlegen, dann im Editor füllen — ein Heredoc oder ein `echo` landet mitsamt Passwort in
`~/.bash_history` und steht dort noch, wenn der Keystore längst wichtig ist. (Stand bis zum
21.09.2026 anders auf dieser Seite; im eigenen Audit gefunden und geändert.)

```
umask 077
: > ~/.config/observed/release-credentials.json
chmod 600 ~/.config/observed/release-credentials.json
nano ~/.config/observed/release-credentials.json     # oder vim, egal
```

Inhalt, mit deinem Passwort an den zwei Stellen:

```json
{
  "android": {
    "keystore": {
      "keystorePath": "/home/observed/.config/observed/observed-release.jks",
      "keystorePassword": "",
      "keyAlias": "observed",
      "keyPassword": ""
    }
  }
}
```

**Absoluter Pfad, kein `~`** — EAS löst die Tilde nicht auf.

Danach einmal prüfen, dass nichts davon in der Historie steht:

```
grep -c "keystorePassword" ~/.bash_history   # muss 0 sein
ls -l ~/.config/observed/release-credentials.json   # muss -rw------- sein
```

## 3. Was die Konfiguration im Repo tut

`app/eas.json` hat dafür das Profil **`tester`**:

```json
"tester": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "credentialsSource": "local",
  "channel": "tester"
}
```

`credentialsSource: local` heißt: **EAS erzeugt keinen Schlüssel und speichert keinen.** Es liest
die Datei, die während des Builds im Projektordner liegt. Deshalb sieht der Bauablauf so aus:

```
cd ~/observed/app
cp ~/.config/observed/release-credentials.json credentials.json   # nur für den Build
eas build --platform android --profile tester --non-interactive
rm credentials.json                                               # sofort danach
```

`credentials.json` steht in `.gitignore`; sie darf nie committet werden.

## 4. Paketname und Version

| | |
|---|---|
| Paket | `day.observed.app` — fest, nie ändern |
| Diagnose-Build | `day.observed.app.diag`, eigener Wegwerfschlüssel, installiert daneben |
| `version` | `1.0.0` in `app.json`; der Kanal für Updates ist `tester` |
| `runtimeVersion` | Policy `appVersion` — JS-Updates gelten für alle Builds mit derselben Version |

**Wichtig für die Testerphase:** Solange `version` gleich bleibt, erreichen JS-Korrekturen über
`eas update --branch tester` alle installierten Builds, ohne dass jemand etwas neu installiert.
Nach dem Feature-Freeze am 02.10. wird auf diesem Kanal **nichts mehr veröffentlicht**; das ist
eine Verabredung, keine technische Sperre, und steht so im HANDOFF.

## 5. Prüfen, bevor es an Tester geht

```
# Paketname und Signatur des fertigen APK
$ANDROID_HOME/build-tools/35.0.0/aapt dump badging <apk> | head -2
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs <apk> | grep "Signer #1 certificate DN"
```

Erwartet: `package: name='day.observed.app'` und `CN=Observed` — **nicht** `CN=Android Debug`.
Wenn dort die Debug-Signatur steht, ist die `credentials.json` beim Build nicht gefunden worden.

## 6. Was dabei nicht passieren darf

- Kein Release-Schlüssel auf Expos Servern (deshalb `credentialsSource: local`).
- Kein Schlüssel im Repo, auch nicht verschlüsselt.
- Keine zweite Keystore-Datei „zum Testen" für dasselbe Paket — das ist genau der Fall, der
  später keine Updates mehr erlaubt.
