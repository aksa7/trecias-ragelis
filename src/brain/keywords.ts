// Fast path: unmistakable REQUESTS count as evidence instantly, without waiting for Claude.
// Only asks, not mentions: "kažkas bando pervesti" (someone tries to transfer) is a story, Claude judges it;
// "perveskite" (transfer it) is a request. Patterns use Lithuanian word stems with Unicode letters,
// so endings and small transcription errors still match.

export interface KeywordHit {
  floor: number;
  reason: string;
}

interface Rule extends KeywordHit {
  pattern: RegExp;
}

// Requests no real bank, police or courier ever makes: level 5.
const CRITICAL: Rule[] = [
  { pattern: /smart[\s-]?id|mobile[\s-]?id/iu, floor: 85, reason: 'Prašo Smart-ID / Mobile-ID kodo' },
  { pattern: /(?<!\p{L})pin(?!\p{L}{3})/iu, floor: 85, reason: 'Prašo PIN kodo' },
  { pattern: /slaptaž/iu, floor: 85, reason: 'Prašo slaptažodžio' },
  { pattern: /prisijungim\p{L}* (duomen|vard)|vartotojo vard/iu, floor: 85, reason: 'Prašo prisijungimo duomenų' },
  { pattern: /(?<!\p{L})(cvv|cvc)(?!\p{L})|kortel\p{L}* numer/iu, floor: 85, reason: 'Prašo kortelės duomenų' },
  { pattern: /any\s?desk|team\s?viewer|nuotolin\p{L}* prieig/iu, floor: 85, reason: 'Prašo įdiegti nuotolinės prieigos programą' },
  {
    pattern: /(pasakyk|padiktuok|perskaityk|nurodyk|atsiųsk|įvesk)\p{L}*.*kod|(?<!\p{L})kod\p{L}*.*(sms|žinut|patvirtin)/iu,
    floor: 85,
    reason: 'Prašo pasakyti patvirtinimo kodą',
  },
];

// Money and secrecy requests: level 3.
const ELEVATED: Rule[] = [
  { pattern: /saug\p{L}* sąskait/iu, floor: 60, reason: 'Siūlo „saugią sąskaitą“' },
  { pattern: /(pervesk|perkelk|pervedinėk)\p{L}*|atiduok\p{L}* (pinig|gryn)/iu, floor: 60, reason: 'Prašo pervesti ar atiduoti pinigus' },
  { pattern: /niekam nesakyk|nesakykite niekam|niekam nepasakok/iu, floor: 55, reason: 'Prašo niekam nesakyti' },
];

// A real bank warns: "niekada nesakykite Smart-ID kodo". Lines with these words are a warning, not a request.
const WARNING_NOT_REQUEST = /niekada|neprašo|neprašys|neatskleisk|nesidalink|nesakykite (jokių|savo) kod/iu;

/** Strongest request matched by one transcript line, or null. */
export function matchKeywords(text: string): KeywordHit | null {
  if (WARNING_NOT_REQUEST.test(text)) return null;
  const hit = CRITICAL.find((r) => r.pattern.test(text)) ?? ELEVATED.find((r) => r.pattern.test(text));
  return hit ? { floor: hit.floor, reason: hit.reason } : null;
}

/** The victim reading out a code (3+ digits) after a code was requested is the most dangerous moment. */
export function victimSaysDigits(text: string): boolean {
  const digitWord = '(?:nulis|vienas|du|trys|keturi|penki|šeši|septyni|aštuoni|devyni)';
  const twoDigitWords = new RegExp(`(?<!\\p{L})${digitWord}[\\s,]+${digitWord}(?!\\p{L})`, 'iu');
  return /\d[\d\s-]{2,}/.test(text) || twoDigitWords.test(text);
}
