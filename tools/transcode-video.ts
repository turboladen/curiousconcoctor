// Shrinks a phone video into a web-sized MP4 with no metadata and makes a poster frame beside it.
//
// Usage: bun tools/transcode-video.ts INPUT OUTPUT.mp4
//
// The poster is OUTPUT with a .jpg extension. The script exits with status 1 if the MP4 is over the
// size limit or still records a location, and it never changes the input.

import { $ } from "bun";
import { existsSync, readFileSync, statSync } from "node:fs";
import { hasVideoLocation, MAX_VIDEO_BYTES, posterArgs, posterSeconds, transcodeArgs } from "./video";

const [input, output] = Bun.argv.slice(2);
if (!input || !output?.endsWith(".mp4")) {
  console.error("usage: bun tools/transcode-video.ts INPUT OUTPUT.mp4");
  process.exit(1);
}
const poster = output.replace(/\.mp4$/, ".jpg");

const run = async (args: string[]) => {
  const result = await $`ffmpeg -v error ${args}`.nothrow();
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
    process.exit(1);
  }
};

await run(transcodeArgs(input, output));
const duration = Number(
  (await $`ffprobe -v error -show_entries format=duration -of csv=p=0 ${output}`.nothrow().text()).trim(),
);
await run(posterArgs(output, poster, posterSeconds(duration)));
if (!existsSync(poster)) {
  console.error(`error: ffmpeg wrote no poster frame for ${output}`);
  process.exit(1);
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const size = statSync(output).size;
console.log(`${output}: ${megabytes(statSync(input).size)} MB -> ${megabytes(size)} MB`);
console.log(`${poster}: ${megabytes(statSync(poster).size)} MB`);

let failed = false;
if (size > MAX_VIDEO_BYTES) {
  console.error(`error: the MP4 is over the ${megabytes(MAX_VIDEO_BYTES)} MB limit; trim the clip first`);
  failed = true;
}
if (hasVideoLocation(readFileSync(output))) {
  console.error("error: the MP4 still records a location");
  failed = true;
}
process.exit(failed ? 1 : 0);
