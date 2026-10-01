// Reads notes from the Apple Notes app through AppleScript, so it runs only on macOS.

import { $ } from "bun";
import type { Ymd } from "./dates";

const FOLDER = "Homebrew";

export type NoteInfo = { name: string; created: Ymd; imageCount: number };

const escapeScript = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

export function parseCreated(text: string): Ymd {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!match) throw new Error(`could not read the creation date from "${text}"`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

// AppleScript's own date-to-text conversion depends on the system locale, so the script builds
// year-month-day itself. An integer on the left of & builds a list rather than text, so the first
// operand is coerced.
export const CREATED_SCRIPT = `((year of d) as string) & "-" & ((month of d) as integer) & "-" & (day of d)`;

export async function listNotes(): Promise<NoteInfo[]> {
  const script = `tell application "Notes"
set out to ""
repeat with n in notes of folder "${FOLDER}"
set d to creation date of n
set out to out & (name of n) & tab & ${CREATED_SCRIPT} & tab & (count of attachments of n) & linefeed
end repeat
return out
end tell`;
  const text = await $`osascript -e ${script}`.text();
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name, created, count] = line.split("\t");
      return { name, created: parseCreated(created), imageCount: Number(count) };
    })
    .sort(
      (a, b) =>
        a.created.year - b.created.year
        || a.created.month - b.created.month
        || a.created.day - b.created.day,
    );
}

export async function getNote(name: string): Promise<{ created: Ymd; html: string }> {
  const ref = `note "${escapeScript(name)}" of folder "${FOLDER}"`;
  const dateScript = `tell application "Notes" to set d to creation date of ${ref}\nreturn ${CREATED_SCRIPT}`;
  const created = parseCreated((await $`osascript -e ${dateScript}`.text()).trim());
  const bodyScript = `tell application "Notes" to get body of ${ref}`;
  const html = await $`osascript -e ${bodyScript}`.text();
  return { created, html };
}
