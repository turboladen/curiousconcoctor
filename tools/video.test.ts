import { expect, test } from "bun:test";
import { hasVideoLocation, MAX_LONG_SIDE, posterArgs, transcodeArgs } from "./video";

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
