// Claude's part of the brain: it reads the call so far and reports FACTS about it
// (who the caller claims to be, what they ask for, what pressure they use).
// It does not decide the risk score; src/brain/rules.ts turns these facts into a score.
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

export interface Line {
  role: 'scammer' | 'victim';
  text: string;
}

// Haiku: the fastest model; it only has to extract facts, the rules do the judging.
const MODEL = 'claude-haiku-5-5';
const client = new Anthropic();

export const IDENTITIES = ['bank', 'police', 'government', 'courier', 'relative', 'investment_firm', 'tech_support', 'other', 'unknown'] as const;
export const REQUESTS = ['credentials', 'card_details', 'remote_access', 'money_transfer', 'cash_handover', 'investment', 'personal_info'] as const;
export const PRESSURE = ['urgency', 'threat', 'secrecy', 'emotional_story'] as const;
export const LEGIT_CUES = ['informs_only', 'institution_handles_it', 'offers_official_channel', 'routine_logistics', 'known_relationship'] as const;
export const VICTIM_STATES = ['neutral', 'worried', 'complying', 'refusing'] as const;

export interface Facts {
  claimed_identity: (typeof IDENTITIES)[number];
  requests: (typeof REQUESTS)[number][];
  pressure: (typeof PRESSURE)[number][];
  legit_cues: (typeof LEGIT_CUES)[number][];
  victim_state: (typeof VICTIM_STATES)[number];
  reason: string;
}

const FACTS_FORMAT = jsonSchemaOutputFormat({
  type: 'object',
  properties: {
    claimed_identity: { type: 'string', enum: [...IDENTITIES] },
    requests: { type: 'array', items: { type: 'string', enum: [...REQUESTS] } },
    pressure: { type: 'array', items: { type: 'string', enum: [...PRESSURE] } },
    legit_cues: { type: 'array', items: { type: 'string', enum: [...LEGIT_CUES] } },
    victim_state: { type: 'string', enum: [...VICTIM_STATES] },
    reason: { type: 'string' },
  },
  required: ['claimed_identity', 'requests', 'pressure', 'legit_cues', 'victim_state', 'reason'],
  additionalProperties: false,
} as const);

const FACTS_PROMPT = `You listen to a live phone call to an elderly person in Lithuania and report facts about it.
Do not judge or score; only report what is actually present in the call so far.

The transcript comes from speech recognition of phone audio: words are often misheard
(e.g. "iš ledų" for "iš banko"). Go by the meaning. CALLER called; RECIPIENT is the person being protected.

claimed_identity: who the CALLER says they are (unknown if not said).
requests: only things the CALLER actually asks the RECIPIENT to do or give:
  credentials = Smart-ID / Mobile-ID codes, PIN, passwords, login details, SMS or confirmation codes, logging in to e-banking for them
  card_details = card number, CVV, expiry date
  remote_access = installing AnyDesk/TeamViewer or any app, clicking a link
  money_transfer = moving, sending or "securing" money, a "safe account", paying a fee or bail
  cash_handover = giving cash or valuables to a courier or anyone who comes by
  investment = putting money into crypto, trading or similar
  personal_info = personal code, address, ID details, door codes, who lives with them
  Mentioning money or the bank is NOT a request. Leave empty if nothing is asked.
pressure: urgency only if the CALLER pushes to act right now; threat = consequences like blocked accounts,
  arrest, losses; secrecy = asking not to tell family, the bank or anyone; emotional_story = a relative in trouble,
  an accident, a "new number".
legit_cues: informs_only = the CALLER only informs and asks for nothing; institution_handles_it = they say the bank or
  institution will deal with it themselves; offers_official_channel = they suggest calling the official number or visiting
  a branch; routine_logistics = ordinary delivery or appointment talk; known_relationship = the RECIPIENT clearly knows
  the caller (not just someone claiming to be a relative from a new number).
victim_state: how the RECIPIENT reacts (complying = agrees, looks for codes, reads digits, goes to transfer).
reason: at most 12 words in Lithuanian for a family member, e.g. "Prisistato banku ir prašo Smart-ID kodo".`;

function formatTranscript(lines: Line[]): string {
  return lines.map((l) => `${l.role === 'scammer' ? 'CALLER' : 'RECIPIENT'}: ${l.text}`).join('\n');
}

export async function extractFacts(lines: Line[]): Promise<Facts> {
  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low', format: FACTS_FORMAT },
      system: FACTS_PROMPT,
      messages: [{ role: 'user', content: `Transcript so far:\n${formatTranscript(lines)}` }],
    },
    { timeout: 8000, maxRetries: 1 },
  );
  const facts = response.parsed_output;
  if (!facts) throw new Error(`No facts (stop_reason: ${response.stop_reason})`);
  return facts as Facts;
}

const SUMMARY_PROMPT = `You write a short report for the family about a phone call to their elderly relative in Lithuania
that a scam guardian monitored. The transcript comes from speech recognition and may contain misheard words.
Write at most 2 sentences and 300 characters in Lithuanian, plain text: who the caller claimed to be, what they asked for,
and what the family should do. Base the tone on what was actually asked:
- nothing asked: say the call looks normal / like a real institution, and suggest checking via the official number only if in doubt;
- money or personal data asked: warning signs, call the relative;
- codes, PIN, logins or remote access asked: a clear scam attempt, call the relative now.`;

export async function summarizeCall(lines: Line[], maxLevel: number, requestsSeen: string[]): Promise<string> {
  const context = `Highest guardian level: ${maxLevel} (1 monitor, 3 alert, 5 call cut).
Requests detected: ${requestsSeen.length ? requestsSeen.join(', ') : 'none'}.`;
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low' },
      system: SUMMARY_PROMPT,
      messages: [{ role: 'user', content: `${context}\n\nTranscript:\n${formatTranscript(lines)}` }],
    },
    { timeout: 15000 },
  );
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
