// Turns an image from a note into a small JPEG with no metadata.

import { $ } from "bun";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Ymd } from "./dates";
import type { Image } from "./html";

const MAX_SIDE = 1600;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/gif": "gif",
};
// EXIF orientation values that sips can undo with a plain rotation.
const ROTATION: Record<number, number> = { 3: 180, 6: 90, 8: 270 };
const MIRRORED = new Set([2, 4, 5, 7]);

const ICC_TAG = Buffer.from("ICC_PROFILE\0");

function keepSegment(marker: number, segment: Uint8Array): boolean {
  if (marker === 0xfe) return false;
  if (marker === 0xe2) {
    return Buffer.from(segment.subarray(4, 4 + ICC_TAG.length)).equals(ICC_TAG);
  }
  return !(marker >= 0xe1 && marker <= 0xef && marker !== 0xee);
}

// Standalone markers carry no length field: TEM, RSTn, SOI, and EOI.
const isStandalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);

function walkSegments(jpeg: Uint8Array, onSegment: (marker: number, segment: Uint8Array) => void) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("not a JPEG");
  let i = 2;
  while (i < jpeg.length) {
    if (jpeg[i] !== 0xff) throw new Error(`bad JPEG marker at byte ${i}`);
    const marker = jpeg[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xda) {
      onSegment(marker, jpeg.subarray(i));
      return;
    }
    if (isStandalone(marker)) {
      onSegment(marker, jpeg.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const length = (jpeg[i + 2] << 8) | jpeg[i + 3];
    onSegment(marker, jpeg.subarray(i, i + 2 + length));
    i += 2 + length;
  }
}

// Keeps JFIF, the ICC color profile, and Adobe markers. Every other application segment (Exif and
// XMP in APP1, MPF in APP2, IPTC in APP13) and every comment is dropped.
export function stripJpegMetadata(jpeg: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [jpeg.subarray(0, 2)];
  walkSegments(jpeg, (marker, segment) => {
    if (keepSegment(marker, segment)) chunks.push(segment);
  });
  return Buffer.concat(chunks);
}

export function hasJpegMetadata(jpeg: Uint8Array): boolean {
  let found = false;
  walkSegments(jpeg, (marker, segment) => {
    if (!keepSegment(marker, segment)) found = true;
  });
  return found;
}

const EXIF_TAG = Buffer.from("Exif\0\0");
const GPS_INFO_TAG = 0x8825;

// Reads the first directory of a TIFF block and reports whether it lists the GPSInfo pointer.
function tiffHasGps(tiff: Uint8Array): boolean {
  const order = String.fromCharCode(tiff[0], tiff[1]);
  if (order !== "II" && order !== "MM") return false;
  const littleEndian = order === "II";
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const fits = (offset: number, size: number) => offset >= 0 && offset + size <= tiff.length;
  if (!fits(4, 4)) return false;
  const directory = view.getUint32(4, littleEndian);
  if (!fits(directory, 2)) return false;
  const count = view.getUint16(directory, littleEndian);
  for (let i = 0; i < count; i++) {
    const entry = directory + 2 + i * 12;
    if (!fits(entry, 12)) return false;
    if (view.getUint16(entry, littleEndian) === GPS_INFO_TAG) return true;
  }
  return false;
}

// Returns true when the JPEG's Exif block records a location. Anything that is not a JPEG has none.
export function hasJpegGps(jpeg: Uint8Array): boolean {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return false;
  let found = false;
  walkSegments(jpeg, (marker, segment) => {
    const isExif = marker === 0xe1 && Buffer.from(segment.subarray(4, 10)).equals(EXIF_TAG);
    if (isExif && tiffHasGps(segment.subarray(10))) found = true;
  });
  return found;
}

// sips keeps EXIF through a resize and through a PNG round trip, so it only resizes and rotates
// here. The metadata is removed afterwards by stripJpegMetadata.
export async function processImage(
  img: Image,
): Promise<{ taken: Ymd | null; jpeg: Uint8Array; warnings: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), "import-note-"));
  try {
    const src = join(dir, `src.${EXTENSIONS[img.mime] ?? "img"}`);
    const out = join(dir, "out.jpg");
    await writeFile(src, img.bytes);

    const info = await $`sips -g creation -g orientation ${src}`.text();
    const date = /creation:\s*(\d{4}):(\d{2}):(\d{2})/.exec(info);
    const taken = date
      ? { year: Number(date[1]), month: Number(date[2]), day: Number(date[3]) }
      : null;
    const orientation = Number(/orientation:\s*(\d)/.exec(info)?.[1] ?? 1);

    const warnings: string[] = [];
    await $`sips -s format jpeg -Z ${MAX_SIDE} ${src} --out ${out}`.quiet();
    if (ROTATION[orientation]) await $`sips -r ${ROTATION[orientation]} ${out}`.quiet();
    if (MIRRORED.has(orientation)) {
      warnings.push(`image has mirrored orientation ${orientation}; not corrected`);
    }

    return { taken, jpeg: stripJpegMetadata(await readFile(out)), warnings };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
