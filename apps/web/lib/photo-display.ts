/**
 * Strips the random dedup suffix (e.g. "__886d7a81") that admin-uploaded photo filenames
 * get appended on disk, for display purposes only — the stored filename/lookup is untouched.
 */
export function displayFilename(filename: string): string {
  return filename.replace(/__[0-9a-f]{6,10}(\.[^.]+)$/i, "$1");
}
