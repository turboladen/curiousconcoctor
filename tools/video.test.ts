import { expect, test } from "bun:test";
import { hasVideoLocation, MAX_LONG_SIDE, posterArgs, posterSeconds, SCALE_FILTER, transcodeArgs } from "./video";

const enc = (s: string) => Buffer.from(s, "latin1");

test("transcodeArgs shrinks, re-encodes, and strips every tag, chapter, and extra stream", () => {
  const args = transcodeArgs("in.mov", "out.mp4");
  expect(args.slice(0, 3)).toEqual(["-y", "-i", "in.mov"]);
  expect(args.at(-1)).toBe("out.mp4");
  const pair = (flag: string) => args[args.indexOf(flag) + 1];
  expect(pair("-map_metadata")).toBe("-1");
  expect(pair("-map_chapters")).toBe("-1");
  expect(pair("-c:v")).toBe("libx264");
  expect(pair("-movflags")).toBe("+faststart");
  expect(args.filter((a) => a === "-map")).toHaveLength(2);
  expect(args).toContain("0:a:0?");
  expect(pair("-vf")).toContain(String(MAX_LONG_SIDE));
});

test("posterArgs grabs one frame at the given time with no metadata", () => {
  const args = posterArgs("clip.mp4", "clip.jpg", 1);
  expect(args[args.indexOf("-ss") + 1]).toBe("1");
  expect(args[args.indexOf("-frames:v") + 1]).toBe("1");
  expect(args[args.indexOf("-map_metadata") + 1]).toBe("-1");
  expect(args.at(-1)).toBe("clip.jpg");
});

test("hasVideoLocation finds the QuickTime location key and the ISO 6709 tag", () => {
  expect(hasVideoLocation(enc("....com.apple.quicktime.location.ISO6709...."))).toBe(true);
  expect(hasVideoLocation(enc("....ISO6709...."))).toBe(true);
});

test("hasVideoLocation finds a ©xyz atom that holds a location", () => {
  const atom = Buffer.concat([
    enc("udta"),
    Buffer.from([0, 0, 0, 24, 0xa9]),
    enc("xyz"),
    Buffer.from([0, 14, 0x15, 0xc7]),
    enc("+12.3456-123.4567/"),
  ]);
  expect(hasVideoLocation(atom)).toBe(true);
});

test("hasVideoLocation is false for a clip with no location and for a ©xyz with no coordinates", () => {
  expect(hasVideoLocation(enc("ftypmp42 moov mdat com.apple.quicktime.model"))).toBe(false);
  const bare = Buffer.concat([Buffer.from([0xa9]), enc("xyz"), Buffer.from([0, 0, 0, 0]), enc("hello")]);
  expect(hasVideoLocation(bare)).toBe(false);
});

// ffmpeg's expression language is close enough to JavaScript to evaluate the real filter string.
// A -2 asks ffmpeg to keep the aspect ratio with a dimension that is a multiple of 2.
function outputSize(width: number, height: number): [number, number] {
  const match = /^scale=w='(.+)':h='(.+)'$/.exec(SCALE_FILTER);
  if (!match) throw new Error(`unexpected scale filter: ${SCALE_FILTER}`);
  const evaluate = (expression: string) =>
    new Function(
      "iw",
      "ih",
      "iff",
      "gt",
      "min",
      "trunc",
      `return ${expression.replace(/\bif\(/g, "iff(")};`,
    )(
      width,
      height,
      (c: number, a: number, b: number) => (c ? a : b),
      (a: number, b: number) => (a > b ? 1 : 0),
      Math.min,
      Math.trunc,
    ) as number;
  let w = evaluate(match[1]);
  let h = evaluate(match[2]);
  if (w === -2) w = 2 * Math.round((h * width) / height / 2);
  if (h === -2) h = 2 * Math.round((w * height) / width / 2);
  return [w, h];
}

test("the scale filter always yields even dimensions and never exceeds the long-side limit", () => {
  const sizes: [number, number][] = [
    [1920, 1080],
    [1080, 1920],
    [853, 479],
    [479, 853],
    [1279, 720],
    [720, 1279],
    [100, 99],
    [1081, 1081],
    [4000, 3001],
    [1281, 721],
  ];
  for (const [width, height] of sizes) {
    const [w, h] = outputSize(width, height);
    expect([width, height, w % 2, h % 2]).toEqual([width, height, 0, 0]);
    expect(Math.max(w, h)).toBeLessThanOrEqual(MAX_LONG_SIDE);
  }
});

test("the scale filter never makes a small clip larger", () => {
  expect(outputSize(320, 180)).toEqual([320, 180]);
  expect(outputSize(180, 320)).toEqual([180, 320]);
});

test("posterSeconds is one second for a normal clip and half the length for a short one", () => {
  expect(posterSeconds(36.9)).toBe(1);
  expect(posterSeconds(2)).toBe(1);
  expect(posterSeconds(0.6)).toBeCloseTo(0.3);
  expect(posterSeconds(0)).toBe(0);
  expect(posterSeconds(Number.NaN)).toBe(0);
});
