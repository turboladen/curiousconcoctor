// Helpers for the short videos that posts embed: the ffmpeg arguments that shrink a phone clip and
// strip its metadata, and a detector for the location tags that phones write into MP4 and MOV files.

export const MAX_LONG_SIDE = 1280;
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

const CRF = 28;
const MAX_FPS = 30;

// Shrinks the longer side to MAX_LONG_SIDE and never scales up. H.264 with yuv420p needs even
// dimensions, so the side that is set explicitly is rounded down to an even number, and a -2 lets
// ffmpeg pick the other side so it stays even too.
export const SCALE_FILTER =
  `scale=w='if(gt(iw,ih),trunc(min(${MAX_LONG_SIDE},iw)/2)*2,-2)':h='if(gt(iw,ih),-2,trunc(min(${MAX_LONG_SIDE},ih)/2)*2)'`;

// Keeps the first video stream and the first audio stream, if there is one. Phones also write timed
// metadata tracks, which can hold a location for every frame, so mapping only those two streams drops
// them. -map_metadata -1 drops the container tags, which hold the location and the device.
export function transcodeArgs(input: string, output: string): string[] {
  return [
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    SCALE_FILTER,
    "-fpsmax",
    String(MAX_FPS),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(CRF),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-movflags",
    "+faststart",
    output,
  ];
}

// A clip shorter than two seconds has no frame at the one-second mark, so the poster comes from
// its midpoint instead. A length that cannot be read falls back to the first frame.
export function posterSeconds(duration: number): number {
  return Number.isFinite(duration) ? Math.min(1, Math.max(0, duration) / 2) : 0;
}

export function posterArgs(video: string, output: string, atSeconds: number): string[] {
  return [
    "-y",
    "-ss",
    String(atSeconds),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    SCALE_FILTER,
    "-q:v",
    "5",
    "-map_metadata",
    "-1",
    output,
  ];
}

// QuickTime stores a location in a "com.apple.quicktime.location" key, in an ISO 6709 string such as
// "+12.3456-123.4567/", or in a ©xyz atom that holds the same string.
const LOCATION_KEY = Buffer.from("com.apple.quicktime.location");
const ISO6709 = Buffer.from("ISO6709");
const XYZ_ATOM = /\xA9xyz[\s\S]{4}[+-]\d/;

export function hasVideoLocation(bytes: Uint8Array): boolean {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.includes(LOCATION_KEY) || buffer.includes(ISO6709)) return true;
  return XYZ_ATOM.test(buffer.toString("latin1"));
}
