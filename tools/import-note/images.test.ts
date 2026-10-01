import { expect, test } from "bun:test";
import { hasJpegGps, hasJpegMetadata, stripJpegMetadata } from "./images";

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

// Builds an Exif APP1 segment whose IFD0 lists the given tags, each as a LONG with value 0.
function exifWithTags(tags: number[], littleEndian: boolean): Uint8Array {
  const tiff = Buffer.alloc(8 + 2 + tags.length * 12 + 4);
  const u16 = (v: number, o: number) => (littleEndian ? tiff.writeUInt16LE(v, o) : tiff.writeUInt16BE(v, o));
  const u32 = (v: number, o: number) => (littleEndian ? tiff.writeUInt32LE(v, o) : tiff.writeUInt32BE(v, o));
  tiff.write(littleEndian ? "II" : "MM", 0, "latin1");
  u16(0x2a, 2);
  u32(8, 4);
  u16(tags.length, 8);
  tags.forEach((tag, i) => {
    u16(tag, 10 + i * 12);
    u16(4, 12 + i * 12);
    u32(1, 14 + i * 12);
  });
  return segment(0xe1, Buffer.concat([enc("Exif\0\0"), tiff]));
}

test("hasJpegGps finds the GPS pointer in either byte order", () => {
  for (const littleEndian of [true, false]) {
    const withGps = Buffer.concat([SOI, jfif, exifWithTags([0x010f, 0x8825], littleEndian), SCAN]);
    expect(hasJpegGps(withGps)).toBe(true);
  }
});

test("hasJpegGps is false for Exif without GPS, for other metadata, and for no metadata", () => {
  const noGps = Buffer.concat([SOI, jfif, exifWithTags([0x010f, 0x0110], true), SCAN]);
  expect(hasJpegGps(noGps)).toBe(false);
  expect(hasJpegGps(Buffer.concat([SOI, jfif, xmp, SCAN]))).toBe(false);
  expect(hasJpegGps(Buffer.concat([SOI, jfif, SCAN]))).toBe(false);
});

test("hasJpegGps is false for a file that is not a JPEG", () => {
  expect(hasJpegGps(Buffer.from("RIFFxxxxWEBP"))).toBe(false);
});

test("hasJpegGps does not run off the end of a truncated Exif block", () => {
  const truncated = Buffer.concat([SOI, segment(0xe1, enc("Exif\0\0II*\0")), SCAN]);
  expect(hasJpegGps(truncated)).toBe(false);
});
