// What telephony does when the brain raises the level. No voice warnings to the victim
// (a scared person can panic); the family is told by SMS and handles it.
//   level 3 → SMS to the family
//   level 5 → the call is cut immediately, then SMS to the family again
//   texts on the SMS line (textLine.ts): level 3 → SMS to the family, level 5 → the text is blocked + SMS
//   after a level 3+ call → the summary; if the risk had dropped back below 50 by the end
//                           (nothing was really asked), a calming "probably fine" message instead
import type { Twilio } from 'twilio';
import { bus, type CallEvent, type Level } from '../events';
import { say } from '../language';
import { familyContacts, textFamily } from './sms';
import { isTextRoom } from './textLine';

// The protected person as used in the texts: in Lithuanian the name in dative ("Mamai"), in English
// VICTIM_NAME_EN ("Mum"); the gender gives "jai" / "jam" and "her" / "him".
const GENDER = process.env.VICTIM_GENDER ?? '';
const VICTIM = say(process.env.VICTIM_NAME ?? 'Jūsų artimajam', process.env.VICTIM_NAME_EN ?? 'your relative');
const HIM_OR_HER = say({ f: 'jai', m: 'jam' }[GENDER] ?? 'jam ar jai', { f: 'her', m: 'him' }[GENDER] ?? 'them');

const highestLevel = new Map<string, Level>();
const lastRisk = new Map<string, number>();
const callSidOf = (room: string) => room.replace(/^room-/, '');
const sentence = (reason: string) => reason.trim().replace(/[.!\s]+$/, '');

export function startActions(client: Twilio, messagingServiceSid: string | null) {
  if (familyContacts().length === 0) console.warn('[actions] FAMILY_CONTACTS is empty: no SMS will be sent.');

  // SMS_ENABLED=false while testing: actions still show on the live panel, nothing is texted.
  const smsEnabled = process.env.SMS_ENABLED !== 'false';
  if (!smsEnabled) console.warn('[actions] SMS_ENABLED=false: texts are only shown, not sent.');

  const sms = async (room: string, body: string) => {
    if (!smsEnabled) {
      bus.emit({ type: 'action', room, kind: 'family_sms', text: `${say('(SMS išjungta)', '(SMS off)')} “${body}”` });
      return;
    }
    const sent = messagingServiceSid ? await textFamily(client, messagingServiceSid, body) : [];
    const to = sent.length ? sent.map((c) => c.name).join(', ') : say('niekam (SMS neišsiųsta)', 'nobody (SMS not sent)');
    bus.emit({ type: 'action', room, kind: 'family_sms', text: `SMS → ${to}: “${body}”` });
  };

  // React after every listener has seen the event, so an action never reaches the dashboard before
  // the level change that caused it.
  bus.on((event) => queueMicrotask(() => handle(event)));

  function handle(event: CallEvent) {
    if (event.type === 'risk') {
      lastRisk.set(event.room, event.score);
    } else if (event.type === 'level') {
      highestLevel.set(event.room, event.level);
      if (isTextRoom(event.room)) {
        textAlert(event.room, event.level, event.reason);
      } else if (event.level === 3) {
        void sms(
          event.room,
          say(
            `BustedAI: ${VICTIM} skambina galimas sukčius. ${sentence(event.reason)}. Paskambinkite ${HIM_OR_HER}.`,
            `BustedAI: a possible scammer is calling ${VICTIM}. ${sentence(event.reason)}. Please call ${HIM_OR_HER}.`,
          ),
        );
      }
      if (event.level === 5 && !isTextRoom(event.room)) void intervene(event.room, event.reason);
    } else if (event.type === 'summary' && (highestLevel.get(event.room) ?? 1) >= 3) {
      const calmedDown = highestLevel.get(event.room) === 3 && (lastRisk.get(event.room) ?? 0) < 50;
      const prefix = calmedDown
        ? say('BustedAI: skambutis baigėsi be pavojingų prašymų, tikėtina, kad viskas gerai.', 'BustedAI: the call ended without dangerous requests, it is probably fine.')
        : 'BustedAI:';
      void sms(event.room, `${prefix} ${event.text}`);
    }
  }

  /** A text on the SMS line: level 3 warns the family; at level 5 the text never reaches the victim. */
  function textAlert(room: string, level: Level, reason: string) {
    if (level === 3) {
      void sms(
        room,
        say(
          `BustedAI: ${VICTIM} gavo įtartiną SMS. ${sentence(reason)}. Paskambinkite ${HIM_OR_HER}.`,
          `BustedAI: ${VICTIM} got a suspicious text. ${sentence(reason)}. Please call ${HIM_OR_HER}.`,
        ),
      );
    } else if (level === 5) {
      bus.emit({ type: 'action', room, kind: 'victim_warning', text: `${say('Sukčių SMS užblokuota', 'Scam text blocked')}: ${reason}` });
      void sms(
        room,
        say(
          `BustedAI: užblokavome sukčių SMS, skirtą ${VICTIM}. ${sentence(reason)}. Paskambinkite ${HIM_OR_HER}.`,
          `BustedAI: we BLOCKED a scam text to ${VICTIM}, it never reached ${HIM_OR_HER}. ${sentence(reason)}. Give ${HIM_OR_HER} a call.`,
        ),
      );
    }
  }

  async function intervene(room: string, reason: string) {
    // Cut first: every second on the line is a chance to read out a code.
    try {
      await client.calls(callSidOf(room)).update({ status: 'completed' });
      bus.emit({ type: 'action', room, kind: 'intervention', text: `${say('Skambutis nutrauktas', 'Call cut')}: ${reason}` });
    } catch (err) {
      console.error('[actions] Could not end the call:', err instanceof Error ? err.message : err);
    }
    await sms(
      room,
      say(
        `BustedAI: skambutis ${VICTIM} NUTRAUKTAS. ${sentence(reason)}. Paskambinkite ${HIM_OR_HER} dabar.`,
        `BustedAI: the call to ${VICTIM} was CUT. ${sentence(reason)}. Call ${HIM_OR_HER} now.`,
      ),
    );
  }
}
