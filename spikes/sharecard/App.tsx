import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Skia,
  ImageFormat,
  PaintStyle,
  FontHinting,
  FontEdging,
  type SkFont,
  type SkSurface,
} from '@shopify/react-native-skia';

const W = 1200;
const H = 675;
const PAPER = '#F0F1EC';
const INK = '#1C1F1D';
const ACCENT = '#5B7CFA';

const HEAD_1 = 'Will SOL be more than 1% above its';
const HEAD_2 = '12:00 UTC price at 00:00 UTC?';
const BIG = '40';
const MID = '0.160';
const STATS = 'Brier 0.160 . 9 scored . 8 revealed . 1 missing';
const ZERO = '0123456789';

const log: string[] = [];
const L = (s: string) => {
  log.push(s);
  console.log('[SHARECARD] ' + s);
};

function curve(): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 21; i++) {
    const t = i / 20;
    pts.push(Math.exp(-Math.pow((t - 0.55) * 3.2, 2)));
  }
  return pts;
}

function makeSurface(): { surface: SkSurface; api: string } {
  // NOTE: Skia.Surface.MakeOffscreen() is GPU-backed. Called from the JS thread on an
  // emulator with no live GL context it does not return null - it SIGSEGVs the process.
  // The CPU raster surface is the correct factory for offscreen PNG export, so try it first.
  let s = Skia.Surface.Make(W, H);
  if (s) return { surface: s, api: 'Skia.Surface.Make (CPU raster)' };
  L('WARN: Skia.Surface.Make returned null, trying GPU MakeOffscreen');
  s = Skia.Surface.MakeOffscreen(W, H);
  if (s) return { surface: s, api: 'Skia.Surface.MakeOffscreen (GPU)' };
  throw new Error('No Skia surface factory produced a surface');
}

function draw(variant: 'bundled' | 'system', head: SkFont, mono: SkFont, small: SkFont, big: SkFont, mid: SkFont) {
  L(`draw(${variant}): creating surface`);
  const { surface, api } = makeSurface();
  L(`draw(${variant}): surface ok via ${api}`);
  const canvas = surface.getCanvas();
  L(`draw(${variant}): canvas ok`);

  const bg = Skia.Paint();
  bg.setColor(Skia.Color(PAPER));
  canvas.drawRect(Skia.XYWHRect(0, 0, W, H), bg);

  const ink = Skia.Paint();
  ink.setColor(Skia.Color(INK));
  ink.setAntiAlias(true);

  const accent = Skia.Paint();
  accent.setColor(Skia.Color(ACCENT));
  accent.setAntiAlias(true);
  accent.setStyle(PaintStyle.Stroke);
  accent.setStrokeWidth(3);

  const label = Skia.Paint();
  label.setColor(Skia.Color(ACCENT));
  label.setAntiAlias(true);

  L(`draw(${variant}): background filled`);

  // variant tag
  canvas.drawText(variant === 'bundled' ? 'BUNDLED TTF' : 'SKIA DEFAULT / SYSTEM', 60, 60, label, small);
  L(`draw(${variant}): tag drawn`);


  // headline (Literata or default)
  L(`draw(${variant}): head line 1...`);
  canvas.drawText(HEAD_1, 60, 140, ink, head);
  L(`draw(${variant}): head line 2...`);
  canvas.drawText(HEAD_2, 60, 196, ink, head);
  L(`draw(${variant}): headline drawn`);

  // big digits (Mono or default) - marked-zero inspection
  L(`draw(${variant}): big digits...`);
  canvas.drawText(BIG, 60, 390, ink, big);
  L(`draw(${variant}): mid digits...`);
  canvas.drawText(MID, 340, 390, ink, mid);

  // full digit row so every zero form is visible
  L(`draw(${variant}): digit row...`);
  canvas.drawText(ZERO, 60, 480, ink, mid);

  // stats line
  L(`draw(${variant}): stats...`);
  canvas.drawText(STATS, 60, 540, ink, mono);
  L(`draw(${variant}): text drawn`);

  // 21-point polyline
  const pts = curve();
  const path = Skia.Path.Make();
  const x0 = 60;
  const x1 = W - 60;
  const yBase = 640;
  const amp = 70;
  pts.forEach((v, i) => {
    const x = x0 + ((x1 - x0) * i) / 20;
    const y = yBase - v * amp;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  canvas.drawPath(path, accent);

  const image = surface.makeImageSnapshot();
  L(`${variant}: api=${api} image=${image.width()}x${image.height()}`);
  return { image, api };
}

function fontInfo(name: string, f: SkFont, sample: string) {
  let family = 'n/a';
  try {
    const tf: any = f.getTypeface ? f.getTypeface() : null;
    if (tf) {
      if (typeof tf.getFamilyName === 'function') family = tf.getFamilyName();
      else family = 'typeface present, no getFamilyName()';
    } else {
      family = 'null typeface (default)';
    }
  } catch (e: any) {
    family = 'err: ' + e.message;
  }
  let width = -1;
  try {
    width = f.measureText(sample).width;
  } catch (e: any) {
    L(`measureText failed for ${name}: ${e.message}`);
  }
  // glyph IDs are typeface-specific: different ids for the same characters prove
  // a different typeface is in play, without needing a family name.
  let gids = 'n/a';
  try {
    const tf: any = f.getTypeface ? f.getTypeface() : null;
    gids = tf ? JSON.stringify(tf.getGlyphIDs('040.')) : 'null typeface';
  } catch (e: any) {
    gids = 'err: ' + e.message;
  }
  L(
    `FONT ${name}: size=${f.getSize()} family="${family}" ` +
      `measureText("${sample}")=${width.toFixed(2)} glyphIDs("040.")=${gids}`
  );
}

export default function App() {
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    (async () => {
      try {
        const litMod = require('@expo-google-fonts/literata/400Regular/Literata_400Regular.ttf');
        const monoMod = require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf');
        const litAsset = Asset.fromModule(litMod);
        const monoAsset = Asset.fromModule(monoMod);
        await litAsset.downloadAsync();
        await monoAsset.downloadAsync();
        L(`literata uri=${litAsset.localUri || litAsset.uri}`);
        L(`mono uri=${monoAsset.localUri || monoAsset.uri}`);

        const S: any = Skia as any;
        L(
          `API typeof: Data=${typeof S.Data} Data.fromURI=${typeof S.Data?.fromURI}` +
            ` Data.fromBase64=${typeof S.Data?.fromBase64} Data.fromBytes=${typeof S.Data?.fromBytes}` +
            ` Typeface=${typeof S.Typeface} MakeFreeTypeFaceFromData=${typeof S.Typeface?.MakeFreeTypeFaceFromData}` +
            ` Surface=${typeof S.Surface} MakeOffscreen=${typeof S.Surface?.MakeOffscreen} Make=${typeof S.Surface?.Make}` +
            ` Font=${typeof S.Font} FontMgr=${typeof S.FontMgr}`
        );

        // Read the shipped TTF bytes ourselves and hand them to Skia, so there is no
        // doubt that the bytes drawn are the bytes we bundled.
        const loadData = async (uri: string, label: string) => {
          try {
            const b64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            L(`${label}: read ${b64.length} base64 chars from bundled asset`);
            return Skia.Data.fromBase64(b64);
          } catch (e: any) {
            L(`${label}: fromBase64 path failed (${e?.message}), trying fromURI`);
            return await Skia.Data.fromURI(uri);
          }
        };
        const litData = await loadData(litAsset.localUri || litAsset.uri, 'literata');
        const monoData = await loadData(monoAsset.localUri || monoAsset.uri, 'mono');
        L(`SkData objects created: literata=${!!litData} mono=${!!monoData}`);

        const litTf = Skia.Typeface.MakeFreeTypeFaceFromData(litData);
        const monoTf = Skia.Typeface.MakeFreeTypeFaceFromData(monoData);
        if (!litTf) throw new Error('Literata typeface null');
        if (!monoTf) throw new Error('IBM Plex Mono typeface null');
        // Pin the SkData and typefaces on the global object: if the crash were the
        // font bytes being collected out from under Skia, this would prevent it.
        (global as any).__sharecardKeep = { litData, monoData, litTf, monoTf };
        L('typefaces created from bundled TTF data OK (pinned on global)');

        // Literata ships a `prep` table with no `fpgm`/`cvt `; running the TrueType
        // hinting interpreter over it segfaults Skia's FreeType backend. Disabling
        // hinting is the fix, and is what we want for a fixed-size export anyway.
        const mkFont = (tf: any, size: number): SkFont => {
          const f = Skia.Font(tf, size);
          try {
            f.setHinting(FontHinting.None);
            f.setEdging(FontEdging.AntiAlias);
          } catch (e: any) {
            L(`font tuning failed at size ${size}: ${e?.message}`);
          }
          return f;
        };
        const bundled = {
          head: mkFont(litTf, 46),
          mono: mkFont(monoTf, 28),
          small: mkFont(monoTf, 20),
          big: mkFont(monoTf, 180),
          mid: mkFont(monoTf, 72),
        };
        // Skia has no implicit "default font": Skia.Font() yields a font with a null
        // typeface that measures 0 and draws nothing. For an honest system-font
        // comparison we must ask the platform font manager for a real typeface.
        let sysTypeface: any = null;
        try {
          const fm: any = (Skia as any).FontMgr.System();
          const n = fm.countFamilies();
          const names: string[] = [];
          for (let i = 0; i < Math.min(n, 6); i++) names.push(fm.getFamilyName(i));
          L(`system FontMgr: countFamilies=${n} first=${JSON.stringify(names)}`);
          const styles: any[] = [
            { weight: 400, width: 5, slant: 0 },
            { weight: 400 },
            undefined,
          ];
          outer: for (const cand of ['sans-serif', 'Roboto', 'arial', names[0] ?? '']) {
            for (const st of styles) {
              try {
                const tf = st === undefined ? fm.matchFamilyStyle(cand) : fm.matchFamilyStyle(cand, st);
                if (tf) {
                  const probe = Skia.Font(tf, 46).measureText('Will SOL').width;
                  L(`matchFamilyStyle("${cand}", ${JSON.stringify(st)}) -> width ${probe}`);
                  if (probe > 0) {
                    sysTypeface = tf;
                    L(`system typeface RESOLVED via "${cand}" ${JSON.stringify(st)}`);
                    break outer;
                  }
                }
              } catch (e: any) {
                L(`matchFamilyStyle("${cand}", ${JSON.stringify(st)}) threw: ${e?.message}`);
              }
            }
          }
          if (!sysTypeface) {
            L('WARNING: no system typeface produced non-zero text metrics');
          }
        } catch (e: any) {
          L(`FontMgr.System() failed: ${e?.message}`);
        }
        const sysFont = (size: number): SkFont => {
          if (sysTypeface) return mkFont(sysTypeface, size);
          const f = (Skia as any).Font();
          f.setSize(size);
          return f;
        };
        const sys = {
          head: sysFont(46),
          mono: sysFont(28),
          small: sysFont(20),
          big: sysFont(180),
          mid: sysFont(72),
        };

        L('--- bundled font metrics ---');
        fontInfo('bundled.head(Literata 46)', bundled.head, HEAD_1);
        fontInfo('bundled.mono(IBMPlexMono 28)', bundled.mono, STATS);
        fontInfo('bundled.big(IBMPlexMono 180)', bundled.big, BIG);
        fontInfo('bundled.mid(IBMPlexMono 72)', bundled.mid, MID);
        L('--- system font metrics ---');
        fontInfo('system.head(46)', sys.head, HEAD_1);
        fontInfo('system.mono(28)', sys.mono, STATS);
        fontInfo('system.big(180)', sys.big, BIG);
        fontInfo('system.mid(72)', sys.mid, MID);

        const a = draw('bundled', bundled.head, bundled.mono, bundled.small, bundled.big, bundled.mid);
        const b = draw('system', sys.head, sys.mono, sys.small, sys.big, sys.mid);

        const dir = FileSystem.documentDirectory!;
        const write = async (name: string, img: any) => {
          const b64 = img.encodeToBase64(ImageFormat.PNG, 100);
          const p = dir + name;
          await FileSystem.writeAsStringAsync(p, b64, { encoding: FileSystem.EncodingType.Base64 });
          const info = await FileSystem.getInfoAsync(p);
          L(`wrote ${name} size=${(info as any).size}`);
        };
        await write('sharecard-proof.png', a.image);
        await write('sharecard-systemfont.png', b.image);
        L(`API USED: bundled=${a.api} system=${b.api}`);
        L('DONE_OK');
        await FileSystem.writeAsStringAsync(dir + 'sharecard-log.txt', log.join('\n'));
        setStatus('DONE_OK');
      } catch (e: any) {
        L('FATAL: ' + (e?.message || String(e)) + '\n' + (e?.stack || ''));
        try {
          await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + 'sharecard-log.txt', log.join('\n'));
        } catch {}
        setStatus('FAILED: ' + (e?.message || String(e)));
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, paddingTop: 80, backgroundColor: PAPER }}>
      <Text style={{ fontSize: 18, color: INK }}>{status}</Text>
      <ScrollView>
        <Text style={{ fontSize: 10, color: INK }}>{log.join('\n')}</Text>
      </ScrollView>
    </View>
  );
}
