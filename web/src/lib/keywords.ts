// Phrases scammers use in Lithuanian calls. Each entry is a regex source.
// Entries ending in \p{L}* are word stems ("kod" catches "kodą", "kodo");
// "pin" must stand alone so that "pinigus" (money) is not flagged as PIN.
const TRIGGERS = [
  'smart[- ]?id',
  'kod\\p{L}*',
  'pin(?!\\p{L})',
  'slaptažod\\p{L}*',
  'pervesk\\p{L}*',
  'pervesti',
  'saug\\p{L}* sąskait\\p{L}*',
  'anydesk',
  'teamviewer',
  'niekam nesakyk\\p{L}*',
  'skubiai',
  'konfidencial\\p{L}*',
];

const PATTERN = new RegExp(`(?<!\\p{L})(?:${TRIGGERS.join('|')})`, 'giu');

export interface TextSegment {
  text: string;
  flagged: boolean;
}

/** Split a transcript line into plain and flagged segments for highlighting. */
export function splitByTriggers(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), flagged: false });
    segments.push({ text: match[0], flagged: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), flagged: false });
  return segments;
}
