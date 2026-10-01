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
// Each key is an EXIF orientation that a plain rotation fixes, and each value is the clockwise
// rotation in degrees that fixes it.
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
const ORIENTATION_TAG = 0x0112;

type TagHit = { view: DataView; entry: number; littleEndian: boolean };

// Looks for a tag in the first directory of a TIFF block. Every read is bounds-checked, so a
// truncated or malformed block yields null instead of throwing.
function ifd0Entry(tiff: Uint8Array, tag: number): TagHit | null {
  const order = String.fromCharCode(tiff[0], tiff[1]);
  if (order !== "II" && order !== "MM") return null;
  const littleEndian = order === "II";
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const fits = (offset: number, size: number) => offset >= 0 && offset + size <= tiff.length;
  if (!fits(4, 4)) return null;
  const directory = view.getUint32(4, littleEndian);
  if (!fits(directory, 2)) return null;
  const count = view.getUint16(directory, littleEndian);
  for (let i = 0; i < count; i++) {
    const entry = directory + 2 + i * 12;
    if (!fits(entry, 12)) return null;
    if (view.getUint16(entry, littleEndian) === tag) return { view, entry, littleEndian };
  }
  return null;
}

// Anything that is not a JPEG has no Exif block, so it has no tags.
function findExifTag(jpeg: Uint8Array, tag: number): TagHit | null {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
  const result: { hit: TagHit | null } = { hit: null };
  walkSegments(jpeg, (marker, segment) => {
    if (result.hit || marker !== 0xe1) return;
    if (!Buffer.from(segment.subarray(4, 10)).equals(EXIF_TAG)) return;
    result.hit = ifd0Entry(segment.subarray(10), tag);
  });
  return result.hit;
}

// Returns true when the JPEG's Exif block records a location.
export function hasJpegGps(jpeg: Uint8Array): boolean {
  return findExifTag(jpeg, GPS_INFO_TAG) !== null;
}

// Returns the EXIF orientation, 1 through 8, or 1 when the JPEG has none or an invalid one.
export function jpegOrientation(jpeg: Uint8Array): number {
  const hit = findExifTag(jpeg, ORIENTATION_TAG);
  if (!hit) return 1;
  const value = hit.view.getUint16(hit.entry + 8, hit.littleEndian);
  return value >= 1 && value <= 8 ? value : 1;
}

// sips keeps EXIF through a resize and through a PNG round trip, so it only resizes and rotates
// here, and stripJpegMetadata removes the metadata afterward. sips reports no orientation for
// these images and does not rotate the pixels when it converts, so the orientation is read from
// the converted JPEG's own EXIF before that tag is stripped.
export async function processImage(
  img: Image,
): Promise<{ taken: Ymd | null; jpeg: Uint8Array; warnings: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), "import-note-"));
  try {
    const src = join(dir, `src.${EXTENSIONS[img.mime] ?? "img"}`);
    const out = join(dir, "out.jpg");
    await writeFile(src, img.bytes);

    const info = await $`sips -g creation ${src}`.text();
    const date = /creation:\s*(\d{4}):(\d{2}):(\d{2})/.exec(info);
    const taken = date
      ? { year: Number(date[1]), month: Number(date[2]), day: Number(date[3]) }
      : null;

    const warnings: string[] = [];
    await $`sips -s format jpeg -Z ${MAX_SIDE} ${src} --out ${out}`.quiet();
    const orientation = jpegOrientation(await readFile(out));
    if (ROTATION[orientation]) await $`sips -r ${ROTATION[orientation]} ${out}`.quiet();
    if (MIRRORED.has(orientation)) {
      warnings.push(`image has mirrored orientation ${orientation}; not corrected`);
    }

    return { taken, jpeg: stripJpegMetadata(await readFile(out)), warnings };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
