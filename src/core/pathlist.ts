/**
 * Small helpers for the Windows PATH string. Kept out of the main process so
 * the fiddly parts — quoting, trailing slashes, empty entries — can be tested
 * without an Electron runtime.
 */

/** Entries as written, with the empty ones dropped. */
export function splitPath(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** Comparison form: unquoted, without a trailing separator, case-insensitive. */
function normalise(entry: string): string {
  return entry
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/[\\/]+$/, '')
    .toLowerCase()
}

export function containsDir(value: string, dir: string): boolean {
  const wanted = normalise(dir)
  return splitPath(value).some((entry) => normalise(entry) === wanted)
}

/** Appends the directory unless it is already there. */
export function appendDir(value: string, dir: string): string {
  if (containsDir(value, dir)) return value

  const entries = splitPath(value)
  entries.push(dir)
  return entries.join(';')
}
