/** Characters Windows forbids in file names; the stick moves between systems. */
const INVALID = /[<>:"/\\|?*\x00-\x1f]/

/** Why `segment` cannot be a file or folder name, or null if it can. Mirrors main's checkPath. */
export function nameProblem(segment: string): string | null {
  if (segment.trim() === '') return 'Name fehlt'
  if (INVALID.test(segment)) return 'Enthält < > : " / \\ | ? *'
  if (/[. ]$/.test(segment)) return 'Endet mit Punkt oder Leerzeichen'
  if (segment === '.' || segment === '..') return 'Ungültiger Name'
  return null
}

/**
 * A readable name from a download name: "Roll20-50x50-desert-ziggurat-1st-floor" -> "Desert Ziggurat 1st Floor".
 * Drops VTT and grid-size prefixes, turns - and _ into spaces and capitalizes all-lowercase words.
 */
export function cleanName(stem: string): string {
  const cleaned = stem
    .replace(/^(roll20|foundry|fvtt)[-_ ]*/i, '')
    .replace(/^\d+x\d+[-_ ]*/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/[. ]+$/, '')
  // Stripping everything ("50x50.jpg") would leave no name at all.
  return cleaned || stem
}

export const splitExt = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
}
