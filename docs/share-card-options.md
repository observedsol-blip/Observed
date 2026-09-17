# OBSERVED — Share-Karte: Rendering-Optionen (1200×675 PNG, on device)

Stand 17. September 2026. Gilt für `app/` (Expo SDK 54, `expo@54.0.37`, React Native 0.81.5,
New Architecture, Android-only, Ziel Solana Seeker). Referenz: `docs/03-SCREEN-MAP.md` §10,
`docs/04-DESIGN-BIBLE-BRIEF.md`, `docs/02-TECH-STACK.md`. Diese Datei entscheidet nichts an der
Spec — sie wählt ein Werkzeug.

## Was die Karte ist

Ein gedruckter Abzug: heller Grund `#F0F1EC`, Perforationskante, Frage (Literata), Ausgang,
„I gave Yes a 40% chance.", Verteilungsreihe, „Brier 0.160 · 9 scored · 8 revealed · 1 missing",
„One round. Not a skill rating." Kein Wallet, kein Sponsor. Keine Radien, keine Schatten,
keine Verläufe. **Kein Screenshot des laufenden Screens** — der laufende Screen ist dunkel,
die Karte ist hell; sie wird eigens gezeichnet.

Ausgabe: exakt 1200×675 px, unabhängig von der Gerätedichte. Der Seeker meldet
`PixelRatio` 3 bzw. 3.5 (je nach `densityDpi`), das darf am Ergebnis nichts ändern.

## Versionsstand (Expo SDK 54 `bundledNativeModules.json`, geprüft)

| Paket | SDK-54-Pin | npm `latest` (17.09.2026) |
|---|---|---|
| `react-native` | 0.81.5 | — |
| `@shopify/react-native-skia` | 2.2.12 | 2.12.0 |
| `react-native-view-shot` | 4.0.3 | 5.1.1 |
| `react-native-svg` | 15.12.1 | 15.15.5 |
| `react-native-webview` | 13.15.0 | 14.0.1 |
| `expo-file-system` | ~19.0.24 | 57.0.7 |
| `expo-sharing` | ~14.0.8 | 57.0.20 |
| `expo-media-library` | ~18.2.1 | 57.0.5 |
| `expo-image-manipulator` | ~14.0.8 | 57.0.18 |
| `expo-gl` | ~16.0.10 | 57.0.2 |

Die `latest`-Spalte gehört zu SDK 57 und ist für uns irrelevant; wir bleiben auf den Pins.

## Option 1 — `react-native-view-shot` (Off-screen-RN-View abfotografieren)

Die Karte wird als normale RN-Komponente gebaut, außerhalb des sichtbaren Bereichs gemountet
und mit `captureRef(ref, { format: "png", result: "tmpfile", width, height })` gerastert.

- **Schriften:** ja, vollständig. Die RN-Textengine ist Androids eigene; Literata und IBM Plex
  werden über `expo-font` geladen und exakt so gemessen und umgebrochen wie im Rest der App.
  Das ist der stärkste Punkt dieser Option: **null zusätzliches Typografie-Risiko**.
- **Exakte 1200×675:** nur mittelbar. Der Snapshot entsteht in *physischen* Pixeln der
  gelayouteten View; `width`/`height` sind ein **Resize danach**, kein Layout-Target. Sauber ist:
  View in dp mit `1200 / PixelRatio.get()` × `675 / PixelRatio.get()` layouten, alle inneren Maße
  aus einem Faktor ableiten, `width: 1200, height: 675` zusätzlich setzen. Bei `PixelRatio` 3.5
  ergibt das krumme dp-Werte → Rundungsfehler von 1–2 px und leicht andere Zeilenumbrüche als
  bei Ratio 3. Typografie ist dann **nicht** bitgleich über Geräte hinweg.
- **Fabric/RN 0.81:** ja. 4.0.3 bringt `codegenConfig` (TurboModule-Codegen) mit und wird von
  Expo-Maintainern (`brentvatne`, `alanhughes`) veröffentlicht; es ist der von SDK 54 gepinnte
  Stand. 5.x nennt als Peer `react-native >=0.76`, getestet bis 0.84.1.
- **APK:** ~1,7 MB unpacked npm, praktisch **kein** nativer Zuwachs (dünner Wrapper um
  `View.draw()` / `PixelCopy`). Faktisch < 100 KB im APK.
- **Offline:** vollständig.
- **Aufwand:** **1–1,5 Tage**.
- **Fehlermodi:** „Failed to capture view snapshot" — die Standardursache ist, dass Android die
  View wegoptimiert; Gegenmittel ist `collapsable={false}` auf Wurzel *und* problematischen
  Kindern bzw. die `<ViewShot>`-Komponente, die das setzt. Weiter: transparente Ränder um Text,
  wenn kein Hintergrund gesetzt ist (Doku empfiehlt ausdrücklich eine `backgroundColor`);
  Off-screen heißt **nicht** „nicht gelayoutet" — `display:none` oder ein Parent mit Höhe 0
  liefert ein leeres Bild; Positionierung per `position:absolute` weit außerhalb des Viewports
  bei gleichzeitig gültigem Layout ist der verlässliche Weg. Auf manchen OEM-Builds ist der
  erste Capture nach dem Mount leer — ein `requestAnimationFrame`-Tick Wartezeit einplanen.

## Option 2 — `@shopify/react-native-skia` (Karte in Skia zeichnen)

Die Karte wird als Skia-JSX beschrieben und headless gerastert. Im gepinnten 2.2.12 existiert
dafür `drawAsImage(element, { width, height })` (Quelle: `lib/module/renderer/Offscreen.js`) —
es baut intern `Skia.Surface.MakeOffscreen(width, height)`, zeichnet das Element, `flush()`,
`makeImageSnapshot()`. Danach `image.encodeToBytes()` bzw. `encodeToBase64(ImageFormat.PNG, 100)`
und schreiben mit `expo-file-system`.

- **Schriften:** ja, aber selbst verwaltet. `useFonts({ Literata: [require("...ttf")], ... })`
  liefert einen `SkFontMgr`; daraus `matchFont`/`matchFamilyStyle`. Für mehrzeiligen Umbruch
  (die Frage!) braucht es die **Paragraph-API** mit `Skia.TypefaceFontProvider`:
  `para.layout(width)`, dann `getHeight()` / `getLongestLine()`. Das ist echtes, messbares
  Text-Layout — nicht nur `drawText`. Preis: Fallback-Ketten, Ziffernbreiten (IBM Plex Mono:
  `tnum` ist dort ohnehin Default) und Tracking müssen einmal manuell justiert werden.
- **Exakte 1200×675:** **ja, direkt.** Die Surface ist in Pixeln definiert; `PixelRatio` spielt
  keine Rolle. Das Ergebnis ist auf jedem Gerät identisch. Genau das will die Karte.
- **Fabric/RN 0.81:** ja. Skia 2.x verlangt React 19 / RN ≥ 0.78; `peerDependencies` von 2.12.0
  nennen `react-native >=0.78`. SDK 54 pinnt 2.2.12 ausdrücklich für RN 0.81.5.
- **APK:** der teuerste Posten. Offizielle Zahlen: **+41,3 MB Release-APK** (alle ABIs),
  **~4 MB Download** über App Bundle, `librnskia.so` arm64 ~3,8 MB, JS-Bundle +220 KB.
  Wir liefern zur Jury eine **APK**, kein AAB — deshalb muss `ndk.abiFilters` auf `arm64-v8a`
  beschränkt werden (Seeker ist arm64). Dann landet der Zuwachs realistisch bei ~5–8 MB.
- **Offline:** vollständig.
- **Aufwand:** **2,5–4 Tage** (Layout ohne Flexbox von Hand, Paragraph-Feinschliff,
  Perforationskante als Pfad/Dashed-Path).
- **Fehlermodi:** `Skia.Surface.MakeOffscreen` liefert auf Android in älteren Ständen
  gelegentlich `null`, wenn kein GPU-Kontext verfügbar ist (Hintergrund-Thread, App im
  Hintergrund); dokumentierter Workaround ist `Skia.Surface.Make` (CPU-Surface). Bilder aus
  einer GPU-Surface sind Texturen — vor dem Encodieren `makeNonTextureImage()` (macht
  `drawAsImage` bereits, wenn nicht auf dem Main-Thread). Bekanntes Thema: unscharfer Text bei
  `drawText` auf Offscreen-Surfaces, wenn die Surface-Größe nicht der Zeichengröße entspricht.
  Und: **16-KB-Page-Size** (Android 15/16) — hier muss der konkrete `.so`-Stand geprüft werden.

## Option 3 — `expo-image-manipulator` und Verwandte

`expo-image-manipulator` (~14.0.8) kann **resize, crop, rotate, flip, extent, Format/Qualität** —
es kann **keinen Text zeichnen und kein Bild aus dem Nichts komponieren**. Als Renderer der
Share-Karte scheidet es aus. Nützlich bleibt es als *Nachstufe*: ein in Option 1 oder 2
erzeugtes Bild auf exakt 1200×675 normalisieren bzw. als PNG neu kodieren.

Eine neuere Expo-eigene Canvas-/Text-Render-API gibt es in SDK 54 **nicht**. `expo-gl`
(~16.0.10) ist ein WebGL-Kontext ohne Textengine und damit keine Antwort.
`react-native-svg` (15.12.1) kann die Karte als SVG beschreiben, hat aber keinen eigenen
Export-nach-PNG-Pfad auf Android — man landet wieder bei `captureRef` (Option 1) oder bei
Skias SVG-Import. Kein Gewinn, eine Abhängigkeit mehr.

**Nicht verifiziert:** ob eine unveröffentlichte/Canary-Expo-API („expo-canvas" o. ä.) in
Vorbereitung ist. UNVERIFIED.

## Option 4 — Serverseitig rendern (satori/resvg oder Headless-Browser auf dem Cron-Service)

Technisch die sauberste Typografie: `satori` (0.33.4) erzeugt aus JSX ein SVG mit eingebetteten,
korrekt gemessenen Fonts, `@resvg/resvg-js` (2.6.2) rastert es pixelgenau auf 1200×675.

Und trotzdem: **verstößt gegen `docs/02-TECH-STACK.md`.** Das Backend ist dort auf
Cron + Benchmarks-Proxy + Push-Sender festgeschrieben, „Bewusst nicht" nennt ausdrücklich
keinen weiteren Serverdienst. Eine Render-Route wäre ein neuer Vertrauens- und Ausfallpunkt,
sie bräuchte die Rundendaten des Nutzers auf dem Server (die Karte zeigt seinen Brier, seine
Antwort) — und sie ist **offline tot**. Der Seeker in der Jury-Hand ohne Netz zeigt dann nichts.
Dazu: Latenz, Rate-Limits, Bildspeicher oder Signed URLs. Ein Headless-Chromium ist noch
schwerer (~300 MB Image, Fonts im Container installieren).

- **Aufwand:** 1,5–2 Tage Route + 0,5 Tage Client — plus laufender Betrieb.
- **Bewertung:** **ausgeschlossen**, nicht aus technischen, sondern aus Spec-Gründen.

## Option 5 — WebView + HTML-to-Canvas

`react-native-webview` (13.15.0), HTML mit `@font-face` auf `file://`-Assets, dann entweder
`html2canvas` oder `canvas.toDataURL()` und Rückgabe per `postMessage`.

- **Schriften:** Android-WebView lädt lokale `@font-face`-Dateien nur mit korrekt gesetztem
  `allowFileAccess`/`baseUrl` — oder man bettet die TTFs als base64-Data-URI ein. Literata und
  IBM Plex zusammen sind mehrere hundert KB base64 im HTML-String; funktioniert, ist aber grob.
- **Exakte 1200×675:** möglich über ein `<canvas width=1200 height=675>` und
  `devicePixelRatio`-Korrektur; `html2canvas` hat dabei bekannte Abweichungen bei
  Letter-Spacing und Baseline.
- **Fabric/RN 0.81:** ja (13.15.0 ist der SDK-54-Pin).
- **APK:** ~650 KB npm, kein nennenswerter nativer Zuwachs (System-WebView).
- **Offline:** ja, sofern alles inline.
- **Aufwand:** 2–3 Tage, davon die Hälfte Debugging in einer Umgebung ohne Debugger.
- **Fehlermodi:** die Android-System-WebView ist eine **updatebare Komponente** — ihr Verhalten
  ist nicht an unsere Build-Version gebunden. Das Rendering kann sich unter den Füßen ändern,
  und wir können es nicht pinnen. Für ein Artefakt, das die Marke transportiert, ist das falsch.
  Dazu: base64-Transfer großer PNGs über die Bridge ist langsam und speicherhungrig.

## Vergleich

| | Fonts | exakt 1200×675 | Fabric 0.81 | APK | offline | Aufwand |
|---|---|---|---|---|---|---|
| 1 view-shot | sehr gut (RN-Engine) | dichteabhängig, ±1–2 px | ja (4.0.3) | ~0 | ja | 1–1,5 d |
| 2 Skia | gut, selbst verwaltet | **exakt** | ja (2.2.12) | +5–8 MB (arm64) | ja | 2,5–4 d |
| 3 image-manipulator | — (kein Text) | — | ja | ~0 | ja | — |
| 4 Server | exzellent | exakt | n/a | 0 | **nein** | 2+ d, Spec-Bruch |
| 5 WebView | mittel, fragil | gut | ja | ~0 | ja | 2–3 d |

## Teilen, Berechtigungen, Text

**Teilen.** Kanonischer Weg: PNG nach `FileSystem.cacheDirectory` (bzw. der SDK-54-`File`-API)
schreiben, dann `Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share reading" })`.
`expo-sharing` reicht eine `content://`-URI über den App-eigenen FileProvider weiter —
**es wird keine einzige Storage-Berechtigung angefragt**, auf keiner Android-Version. Das ist
für uns entscheidend: der Jury-Flow darf keinen Permission-Dialog enthalten.

**Android 15/16 Storage.** Seit API 29 (Scoped Storage) ist `WRITE_EXTERNAL_STORAGE` für eigene
Dateien und für MediaStore-Inserts bedeutungslos; ab API 33 gelten die granularen
`READ_MEDIA_IMAGES`/`_VIDEO`/`_AUDIO`, ab API 34/35 zusätzlich
`READ_MEDIA_VISUAL_USER_SELECTED` (teilweiser Zugriff). All das betrifft **nur**
`expo-media-library`. Wenn wir ein optionales „Save to gallery" anbieten:
`MediaLibrary.saveToLibraryAsync()` mit `usePermissions({ writeOnly: true })` und im
Config-Plugin `granularPermissions: ["photo"]`, damit nicht Audio- und Video-Berechtigungen
ungefragt im Manifest landen. Empfehlung: **`expo-sharing` als Standard, MediaLibrary nur als
ausdrücklich angetippter Zweitknopf** — sonst zahlt die Karte mit einem Dialog, den sie nicht
braucht.

**Text selektierbar/kopierbar.** Ein PNG ist ein Raster; **in keiner der fünf Optionen ist der
Text im Bild markierbar oder kopierbar**. Das ist kein Mangel einer Option, sondern des Formats.
Die Forderung aus der Aufgabe ist deshalb doppelt zu lesen und so zu beantworten:

1. „Kein Screenshot des Live-Screens" — erfüllt: die Karte wird eigens gezeichnet (heller
   Papiergrund statt dunklem App-Grund; sie existiert als Bildschirm gar nicht).
2. Kopierbarkeit — separat lösen: In der Share-Vorschau steht die Ableselinie
   („I gave Yes a 40% chance." / „Brier 0.160 · 9 scored · 8 revealed · 1 missing") als echter,
   selektierbarer RN-Text mit `expo-clipboard`-Knopf. Zusätzlich kann der Android-Share-Intent
   im `message`-Feld denselben Satz mitführen (`Share.share` aus RN); Android reicht bei
   `image/png` je nach Zielapp aber nur eines von beidem weiter — **UNVERIFIED**, ob Text und
   Bild in einem Intent bei den relevanten Zielapps (X, Telegram, Signal) zuverlässig ankommen.

## Empfehlung

**Option 2 — `@shopify/react-native-skia` 2.2.12, `drawAsImage` auf eine Offscreen-Surface.**

Begründung in einem Satz: die Share-Karte ist das einzige Artefakt der App, das das Gerät
verlässt und die Marke außerhalb des Screens trägt — sie muss auf jedem Gerät **bitgleich**
aussehen, und nur Skia gibt uns eine in Pixeln definierte Zeichenfläche statt einer in dp
definierten. Dazu kommt: die Design-Bible verbietet Radien, Schatten und Verläufe; die Karte ist
Fläche, Haarlinie, Perforationskante und Text. Das ist genau das, was in Skia billig ist. Und
`react-native-skia` löst nebenbei das zweite offene Rendering-Problem aus `02-TECH-STACK.md` —
die Hero-Zeile des Widgets als Bitmap in Literata, weil RemoteViews keine eigenen Schriften
laden. Eine Abhängigkeit, zwei Probleme.

**Fallback: Option 1 (`react-native-view-shot` 4.0.3).** Wenn die Skia-Paragraph-Typografie nach
einem Tag nicht sitzt, oder wenn `MakeOffscreen` auf dem Seeker nicht liefert, oder wenn die
16-KB-Page-Size-Prüfung fehlschlägt: Karte als RN-View bauen, `collapsable={false}`,
`captureRef` mit `width: 1200, height: 675`. Kostet 1 Tag, die Typografie ist ohne jedes Risiko,
der Preis ist Dichteabhängigkeit um ±1–2 px — was niemand sieht, aber unsere Reproduzierbarkeit
kostet. Die Komponente ist in beiden Fällen dieselbe Datenstruktur, nur ein anderer Renderer;
den Umstieg kostet ein halber Tag, wenn man das Layout von Anfang an als Zahlen-Objekt
(`{x, y, size, weight}`) hält und nicht in Flexbox verdrahtet.

**Ausgeschlossen:** Option 3 (kann keinen Text), Option 4 (Spec-Bruch, offline tot),
Option 5 (nicht pinbarer Renderer).

## Checkliste vor der Festlegung — auf einem echten Seeker

1. `PixelRatio.get()` und `Dimensions.get("window")` auf dem Gerät protokollieren (erwartet
   ~390 dp Breite; Ratio 3 oder 3.5 entscheidet, wie schlimm Option 1 wirklich wäre).
2. Skia installieren, `drawAsImage(<Group/>, {width:1200,height:675})` aufrufen, Ergebnis
   encodieren — **liefert `MakeOffscreen` auf diesem Gerät eine Surface oder `null`?** Auch
   testen, während die App im Hintergrund ist (Share aus einer Notification heraus).
3. Literata und IBM Plex als TTF bündeln, über `useFonts` + `TypefaceFontProvider` in einer
   Paragraph laden: Umbruch der längsten realen Frage prüfen, `getLongestLine()` gegen die
   RN-Messung derselben Zeile vergleichen. Abweichung > 2 % ⇒ Fallback ernsthaft erwägen.
4. Ziffern: „0.160" und „40%" in IBM Plex Mono — kein durchgestrichenes Null, Punkt als
   Dezimaltrenner, Prozent ohne Leerzeichen (Copy-Regeln aus `04-DESIGN-BIBLE-BRIEF.md`).
5. Release-APK mit `ndk.abiFilters = ["arm64-v8a"]` bauen und die **tatsächliche Größendifferenz
   in MB** messen, nicht schätzen. Ergebnis nach `docs/spikes/share-card.md`.
6. **16-KB-Page-Size:** `zipalign -c -P 16 -v` bzw. die Android-Studio-Prüfung gegen die
   ausgelieferte `librnskia.so` / `libskia.so` laufen lassen. Android 15/16 auf dem Seeker ist
   der Grund, warum das hier steht.
7. `Sharing.shareAsync` mit `image/png` in X, Telegram und die Google-Fotos-Ansicht: kommt die
   Datei an, in 1200×675, ohne Recompression-Artefakte, ohne Permission-Dialog?
8. Kaltstart-Messung: Zeit von Tap auf „Share" bis Share-Sheet. Ziel < 400 ms.
9. Sichtprüfung auf dem Seeker-Display gegen Papier: `#F0F1EC` gegen den dunklen App-Grund,
   Perforationskante bei 1200 px nicht matschig.
10. Kein Wallet, kein Sponsor, keine verbotenen Wörter auf dem gerenderten Bild (Abgleich
    gegen die Copy-Regeln) — am gerenderten PNG prüfen, nicht am Quelltext.

## Nicht verifiziert (UNVERIFIED)

- **UNVERIFIED:** Ob `Skia.Surface.MakeOffscreen` speziell in 2.2.12 auf Android 15/16 und auf
  dem Seeker zuverlässig eine Surface liefert. Die bekannten `null`-Berichte stammen aus älteren
  Ständen; ein Gegentest auf 2.2.12 wurde nicht durchgeführt.
- **UNVERIFIED:** 16-KB-Page-Size-Konformität von `librnskia.so` in 2.2.12. Es gibt einen
  offenen/geschlossenen Issue-Faden dazu im Repo; welcher Stand die Korrektur enthält, wurde
  nicht geprüft.
- **UNVERIFIED:** Der konkrete APK-Zuwachs bei `arm64-v8a`-only. Die Zahl 5–8 MB ist aus den
  offiziellen Angaben (41,3 MB alle ABIs / ~4 MB AAB-Download / 3,8 MB `librnskia.so` arm64)
  abgeleitet, nicht gemessen.
- **UNVERIFIED:** Fabric-Verhalten von `react-native-view-shot` 4.0.3 beim Capture einer
  *nicht sichtbaren* View unter RN 0.81.5. Dass 4.0.3 `codegenConfig` mitbringt und von den
  Expo-Maintainern für SDK 54 gepinnt ist, ist geprüft; das Off-screen-Verhalten nicht.
- **UNVERIFIED:** Genauer `PixelRatio`-Wert des Seeker (3 oder 3.5). Davon hängt ab, wie groß
  der Rundungsfehler in Option 1 tatsächlich ist.
- **UNVERIFIED:** Ob Android-Share-Intents Bild und Text gleichzeitig an X/Telegram/Signal
  durchreichen.
- **UNVERIFIED:** Ob Expo eine neuere native Canvas-/Text-Render-API in Arbeit hat, die in
  SDK 55+ landet.
- **UNVERIFIED:** Ob `expo-image-manipulator` ~14.0.8 eine hier nicht dokumentierte
  Text- oder Compose-Operation besitzt; geprüft wurde die README-Beschreibung, nicht die
  vollständige API-Referenz.

## Quellen

- Expo SDK 54 Modulversionen: `https://unpkg.com/expo@54.0.37/bundledNativeModules.json`
- npm-Registry (`registry.npmjs.org`) für alle Versions-, Peer-Dependency- und Größenangaben
- `@shopify/react-native-skia` 2.2.12, `lib/module/renderer/Offscreen.js`
  (`drawAsPicture` / `drawAsImage` / `drawAsImageFromPicture`) via unpkg
- React Native Skia — Bundle Size: `https://shopify.github.io/react-native-skia/docs/getting-started/bundle-size/`
- React Native Skia — Paragraph / Text: `https://shopify.github.io/react-native-skia/docs/text/paragraph/`
- React Native Skia — Snapshot Views (`collapsable={false}`-Hinweis):
  `https://shopify.github.io/react-native-skia/docs/snapshotviews/`
- React Native Skia — Headless: `https://shopify.github.io/react-native-skia/docs/getting-started/headless/`
- `gre/react-native-view-shot` README und Issues #263, #489, #497 (Capture-Fehler,
  `collapsable`, Hintergrundfarbe)
- Expo Docs: `sdk/sharing`, `sdk/media-library`, `sdk/filesystem`, `sdk/imagemanipulator`
- `expo/expo` PR #20907 und #36142 (granulare Android-Medienberechtigungen,
  `granularPermissions`-Option im Media-Library-Plugin)
