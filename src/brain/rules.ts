// Turns Claude's facts about a call into numbers. Deterministic and explainable:
// the same facts always give the same score, and every number here can be tuned.
//
// evidence  = hard facts that stay true for the rest of the call (a PIN was asked for).
// suspicion = how the call looks right now; it can go down when the context clears up.
import type { Facts } from './scorer';

export interface Judgement {
  evidence: number;
  suspicion: number;
}

const INSTITUTIONS = new Set(['bank', 'police', 'government', 'investment_firm', 'tech_support']);

// What each request proves on its own (sticky).
const REQUEST_EVIDENCE: Record<Facts['requests'][number], number> = {
  credentials: 90,
  card_details: 90,
  remote_access: 90,
  money_transfer: 60,
  cash_handover: 65,
  investment: 55,
  personal_info: 0, // suspicious, but not proof: counts towards suspicion only
};

export function judge(facts: Facts): Judgement {
  // A relative the person clearly knows, asking calmly, is not a scam signal.
  const trustedRelative =
    facts.claimed_identity === 'relative' && facts.legit_cues.includes('known_relationship') && facts.pressure.length === 0;

  let evidence = trustedRelative ? 0 : Math.max(0, ...facts.requests.map((r) => REQUEST_EVIDENCE[r]));
  if (facts.pressure.includes('secrecy')) evidence = Math.max(evidence, 55);
  if (evidence >= 80 && facts.victim_state === 'complying') evidence = 95;

  // Suspicion: who they claim to be + what they ask + how they push.
  let suspicion = INSTITUTIONS.has(facts.claimed_identity) ? 25 : facts.claimed_identity === 'unknown' ? 10 : 5;
  if (facts.requests.includes('personal_info')) suspicion += 20;
  suspicion += 12 * facts.pressure.filter((p) => p !== 'secrecy').length;
  if (facts.victim_state === 'complying') suspicion += 10;

  // Only informing, or ordinary logistics, with nothing asked: looks legitimate.
  const legit = facts.legit_cues.some((c) => c !== 'known_relationship');
  if (facts.requests.length === 0 && legit) suspicion = Math.min(suspicion, 30);
  if (trustedRelative) suspicion = Math.min(suspicion, 20);

  // Level 5 (call cut) is reserved for hard evidence; suspicion alone stays below it.
  suspicion = Math.min(Math.max(suspicion, evidence), evidence >= 80 ? 100 : 79);
  return { evidence, suspicion };
}
