// Words the speech engine should expect, so scam vocabulary is transcribed correctly.
// Twilio passes these to Deepgram as "keyterms". Deepgram rejects the WHOLE transcription
// if all keyterms together exceed 500 tokens, and Lithuanian words cost several tokens each.
// So keep this list short (~800 characters total) and prefer the most important word forms.

const BANKS = ['Swedbank', 'SEB', 'Luminor', 'Šiaulių bankas', 'Revolut', 'Citadele', 'Paysera'];

const IDENTITY_AND_LOGIN = [
  'Smart-ID', 'Mobile-ID', 'PIN kodas', 'PIN kodą', 'slaptažodis', 'slaptažodį', 'prisijungimo',
  'prisijungimo duomenis', 'vartotojo vardą', 'asmens kodą', 'kodą', 'patvirtinimo kodą', 'SMS kodą',
  'SMS žinute', 'patvirtinkite',
];

const CARDS_AND_ACCOUNTS = [
  'sąskaita', 'sąskaitą', 'sąskaitos', 'saugią sąskaitą', 'mokėjimo kortelę', 'kortelės numerį', 'CVV',
  'limitą', 'limitus', 'įtartiną mokėjimą', 'operaciją', 'pavedimą', 'perveskite', 'grynuosius',
];

const IMPERSONATED = [
  'banko saugumo skyriaus', 'policija', 'policijos pareigūnas', 'VMI', 'Sodra', 'kurjeris', 'DPD', 'Omniva',
  'Telia', 'Bitė', 'Microsoft',
];

const PRESSURE_AND_SECRECY = [
  'skubiai', 'nedelsiant', 'užblokuota', 'niekam nesakykite', 'nepadėkite ragelio', 'likite ant linijos',
];

const OTHER_SCAMS = [
  'AnyDesk', 'TeamViewer', 'nuorodą', 'įdiekite', 'kriptovaliuta', 'investuoti', 'laimėjote', 'avarija',
  'ligoninėje', 'advokatas', 'užstatas',
];

const ALL = [...BANKS, ...IDENTITY_AND_LOGIN, ...CARDS_AND_ACCOUNTS, ...IMPERSONATED, ...PRESSURE_AND_SECRECY, ...OTHER_SCAMS];

// Rough safety check: warn early instead of silently losing transcription during a call.
const MAX_CHARS = 1000;
const totalChars = ALL.join('').length;
if (totalChars > MAX_CHARS) {
  console.warn(`Transcription hints are ${totalChars} chars (> ${MAX_CHARS}); Deepgram may reject them.`);
}

export const TRANSCRIPTION_HINTS = ALL.join(',');
