// Reads notes from the Apple Notes app through AppleScript, so it runs only on macOS.

import { $ } from "bun";
import { formatYmd, type Ymd } from "./dates";

const FOLDER = "Homebrew";

export type NoteInfo = { name: string; created: Ymd; imageCount: number };
export type Attachment = { name: string; created: Ymd };

const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "heif", "gif", "tif", "tiff"]);

const isPhoto = (name: string) => PHOTO_EXTENSIONS.has(name.split(".").pop()!.toLowerCase());

// Compares a note's attachment list with the images that were decoded from its body. AppleScript
// cannot save attachments, so only photos embedded in the body survive an import. Each other
// attachment gets its own warning, and a photo count that differs from the decoded image count
// gets one more.
export function unimportedAttachments(attachments: Attachment[], imageCount: number): string[] {
  const warnings = attachments
    .filter((a) => !a.name.includes(".") || !isPhoto(a.name))
    .map((a) => `attachment "${a.name}" from ${formatYmd(a.created)} is not a photo and was not imported`);
  const photos = attachments.length - warnings.length;
  if (photos !== imageCount) {
    warnings.push(`the note lists ${photos} photo attachments but its body holds ${imageCount} images`);
  }
  return warnings;
}

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

export async function getNote(
  name: string,
): Promise<{ created: Ymd; html: string; attachments: Attachment[] | null }> {
  const ref = `note "${escapeScript(name)}" of folder "${FOLDER}"`;
  const dateScript = `tell application "Notes" to set d to creation date of ${ref}\nreturn ${CREATED_SCRIPT}`;
  const created = parseCreated((await $`osascript -e ${dateScript}`.text()).trim());
  const bodyScript = `tell application "Notes" to get body of ${ref}`;
  const html = await $`osascript -e ${bodyScript}`.text();
  // The attachment list only feeds warnings, so a note whose attachments AppleScript cannot read
  // still imports. A null list tells the caller the comparison was skipped.
  const attachmentScript = `tell application "Notes"
set out to ""
repeat with a in attachments of ${ref}
set d to creation date of a
set out to out & (name of a) & tab & ${CREATED_SCRIPT} & linefeed
end repeat
return out
end tell`;
  let attachments: Attachment[] | null;
  try {
    attachments = (await $`osascript -e ${attachmentScript}`.text())
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const [attachmentName, date] = line.split("\t");
        return { name: attachmentName, created: parseCreated(date) };
      });
  } catch {
    attachments = null;
  }
  return { created, html, attachments };
}
