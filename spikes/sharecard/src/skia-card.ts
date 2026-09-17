// Hardened Skia helpers for the share card. Reference implementation for the product code —
// both rules below come from crashes seen in the 17.09.2026 proof run, not from theory.
import { Skia, type SkData, type SkFont, type SkSurface, type SkTypeface } from "@shopify/react-native-skia";

/**
 * RULE 1 — font data must outlive every draw call.
 *
 * `Skia.Typeface.MakeFreeTypeFaceFromData(data)` does NOT take ownership of the `SkData` on the
 * JS side. If the only reference to the data (or to the typeface built from it) is a local
 * variable, JS garbage collection can free it while Skia still points at those bytes — the next
 * `drawText` then reads freed memory and the process dies with SIGSEGV. It is timing dependent,
 * so it survives a quick test and crashes in the field.
 *
 * Therefore: every typeface is registered here, in a module-level map that lives as long as the
 * JS context. Never hand out a typeface that is not in this map, never delete from it.
 */
const pinned = new Map<string, { data: SkData; typeface: SkTypeface }>();

export type FontKey = string;

/** Load a bundled TTF once and pin it. `bytes` is the asset's content (e.g. from expo-asset). */
export function registerTypeface(key: FontKey, bytes: Uint8Array): SkTypeface {
  const existing = pinned.get(key);
  if (existing) return existing.typeface;

  const data = Skia.Data.fromBytes(bytes);
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
  if (!typeface) {
    // Handled failure: a corrupt or unsupported TTF must not take the app down.
    throw new ShareCardError("font-decode-failed", `Skia could not decode the typeface "${key}"`);
  }
  pinned.set(key, { data, typeface }); // keeps BOTH alive — see RULE 1
  return typeface;
}

export function font(key: FontKey, size: number): SkFont {
  const entry = pinned.get(key);
  if (!entry) throw new ShareCardError("font-missing", `typeface "${key}" was never registered`);
  return Skia.Font(entry.typeface, size);
}

/** Errors the caller is expected to handle (show a message, skip the share card, log it). */
export class ShareCardError extends Error {
  constructor(
    readonly code: "font-decode-failed" | "font-missing" | "no-surface" | "encode-failed",
    message: string,
  ) {
    super(message);
    this.name = "ShareCardError";
  }
}

/**
 * RULE 2 — never call `Skia.Surface.MakeOffscreen` on the JS thread.
 *
 * It is GPU-backed. Without a live GL context it does not return null, it SIGSEGVs (observed on
 * an Android 35 emulator, 17.09.2026). A crash cannot be caught, so the only safe handling is to
 * not call it: the CPU raster surface is the correct factory for an offscreen PNG anyway, and a
 * missing surface is returned as a normal error.
 */
export function makeCardSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) {
    throw new ShareCardError(
      "no-surface",
      `Skia.Surface.Make(${width}, ${height}) returned null — no share card on this device`,
    );
  }
  return surface;
}

/** Draw and encode in one place, so callers cannot forget the error handling. */
export function renderCardPng(
  width: number,
  height: number,
  draw: (canvas: ReturnType<SkSurface["getCanvas"]>) => void,
): string {
  const surface = makeCardSurface(width, height);
  draw(surface.getCanvas());
  const image = surface.makeImageSnapshot();
  const base64 = image.encodeToBase64();
  if (!base64) throw new ShareCardError("encode-failed", "Skia returned no PNG bytes");
  return base64;
}
