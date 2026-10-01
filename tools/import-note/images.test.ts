import { expect, test } from "bun:test";
import { hasJpegMetadata, stripJpegMetadata } from "./images";

const enc = (s: string) => new TextEncoder().encode(s);

function segment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  return Buffer.concat([Buffer.from([0xff, marker, length >> 8, length & 0xff]), payload]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const SCAN = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x12, 0x34, 0xff, 0x00, 0xff, 0xd9]);
const jfif = segment(0xe0, enc("JFIF\0"));
const icc = segment(0xe2, enc("ICC_PROFILE\0abc"));
const exif = segment(0xe1, enc("Exif\0\0GPSLatitude"));
const xmp = segment(0xe1, enc("http://ns.adobe.com/xap/1.0/\0<x/>"));
const mpf = segment(0xe2, enc("MPF\0xx"));
const comment = segment(0xfe, enc("camera comment"));

test("removes Exif, XMP, MPF, and comment segments and keeps JFIF, ICC, and the scan", () => {
  const input = Buffer.concat([SOI, jfif, exif, xmp, icc, mpf, comment, SCAN]);
  const output = Buffer.from(stripJpegMetadata(input));
  expect(output.equals(Buffer.concat([SOI, jfif, icc, SCAN]))).toBe(true);
  expect(output.includes(enc("GPSLatitude"))).toBe(false);
});

test("a JPEG with no metadata comes back unchanged", () => {
  const input = Buffer.concat([SOI, jfif, SCAN]);
  expect(Buffer.from(stripJpegMetadata(input)).equals(input)).toBe(true);
});

test("hasJpegMetadata sees Exif and XMP but not ICC", () => {
  expect(hasJpegMetadata(Buffer.concat([SOI, jfif, exif, SCAN]))).toBe(true);
  expect(hasJpegMetadata(Buffer.concat([SOI, jfif, xmp, SCAN]))).toBe(true);
  expect(hasJpegMetadata(Buffer.concat([SOI, jfif, icc, SCAN]))).toBe(false);
});

test("bytes after the scan marker are never interpreted as segments", () => {
  const trap = Buffer.from([0xff, 0xe1, 0x00, 0x04, 0x00, 0x00]);
  const input = Buffer.concat([SOI, jfif, SCAN.subarray(0, 4), trap, SCAN.subarray(4)]);
  const output = Buffer.from(stripJpegMetadata(input));
  expect(output.equals(input)).toBe(true);
});

test("non-JPEG input throws", () => {
  expect(() => stripJpegMetadata(Buffer.from([0x89, 0x50]))).toThrow("not a JPEG");
});
