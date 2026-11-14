// Fast path: unmistakable REQUESTS count as evidence instantly, without waiting for Claude.
// Only asks, not mentions: "kažkas bando pervesti" (someone tries to transfer) is a story, Claude judges it;
// "perveskite" (transfer it) is a request. Patterns use Lithuanian word stems with Unicode letters,
// so endings and small transcription errors still match.
import { say } from '../language';

export interface KeywordHit {
  floor: number;
  reason: string;
}

interface Rule extends KeywordHit {
  pattern: RegExp;
}

// Requests no real bank, police or courier ever makes: level 5.
const CRITICAL: Rule[] = [
  { pattern: /smart[\s-]?id|mobile[\s-]?id/iu, floor: 85, reason: say('Prašo Smart-ID / Mobile-ID kodo', 'Asks for the Smart-ID / Mobile-ID code') },
  { pattern: /(?<!\p{L})pin(?!\p{L}{3})/iu, floor: 85, reason: say('Prašo PIN kodo', 'Asks for the PIN') },
  { pattern: /slaptaž/iu, floor: 85, reason: say('Prašo slaptažodžio', 'Asks for a password') },
  { pattern: /prisijungim\p{L}* (duomen|vard)|vartotojo vard/iu, floor: 85, reason: say('Prašo prisijungimo duomenų', 'Asks for login details') },
  { pattern: /(?<!\p{L})(cvv|cvc)(?!\p{L})|kortel\p{L}* numer/iu, floor: 85, reason: say('Prašo kortelės duomenų', 'Asks for card details') },
  { pattern: /any\s?desk|team\s?viewer|nuotolin\p{L}* prieig/iu, floor: 85, reason: say('Prašo įdiegti nuotolinės prieigos programą', 'Asks to install a remote access app') },
  {
    pattern: /(pasakyk|padiktuok|perskaityk|nurodyk|atsiųsk|įvesk)\p{L}*.*kod|(?<!\p{L})kod\p{L}*.*(sms|žinut|patvirtin)/iu,
    floor: 85,
    reason: say('Prašo pasakyti patvirtinimo kodą', 'Asks for a confirmation code'),
  },
];

// Money and secrecy requests: level 3.
const ELEVATED: Rule[] = [
  { pattern: /saug\p{L}* sąskait/iu, floor: 60, reason: say('Siūlo „saugią sąskaitą“', 'Offers a “safe account”') },
  { pattern: /(pervesk|perkelk|pervedinėk)\p{L}*|atiduok\p{L}* (pinig|gryn)/iu, floor: 60, reason: say('Prašo pervesti ar atiduoti pinigus', 'Asks to transfer or hand over money') },
  { pattern: /niekam nesakyk|nesakykite niekam|niekam nepasakok/iu, floor: 55, reason: say('Prašo niekam nesakyti', 'Asks her to tell no one') },
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
