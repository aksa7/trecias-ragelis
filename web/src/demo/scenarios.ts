import type { CallEvent, Level } from '../types';

/** One scripted step: `at` is milliseconds from the start of the scenario. */
export interface ScenarioStep {
  at: number;
  event: CallEvent;
}

export interface Scenario {
  id: string;
  /** Keyboard shortcut that starts it. */
  key: string;
  title: string;
  /** Short description of what happens, shown in the menu. */
  plot: string;
  /** Highest level the call reaches. */
  outcome: Level;
  steps: ScenarioStep[];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type StepInput = [seconds: number, event: DistributiveOmit<CallEvent, 'room'>];

function build(id: string, steps: StepInput[]): ScenarioStep[] {
  const room = `room-DEMO-${id}`;
  return steps.map(([seconds, event]) => ({
    at: Math.round(seconds * 1000),
    event: { ...event, room } as CallEvent,
  }));
}

// What the guardian says into the call. Polite at level 3, firm at level 5.
const WARNING_SPEECH =
  'Atsiprašau, kad įsiterpiu. Čia jūsų skambučių sargas. Šiame pokalbyje matau sukčiavimo požymių. Nieko nepervedinėkite ir nieko nepatvirtinkite. Jūsų dukra jau informuota.';
const INTERVENTION_SPEECH =
  'Dėmesio, tai sukčiai. Nesakykite jokio kodo ir padėkite ragelį. Jūsų dukra jau informuota.';

const ATTACHED = 'BustedAI attached to the line';
const SMS_FIRST = 'SMS to emergency contact: “Mamai skambina galimi sukčiai. Paskambink jai.”';
const SMS_SECOND = 'SMS to emergency contact: call escalated to risk 5';

const bank: Scenario = {
  id: 'bank',
  key: '1',
  title: 'Bank security',
  plot: '“Safe account” transfer, then asks for the Smart-ID code',
  outcome: 5,
  steps: build('bank', [
    [0, { type: 'call_started', from: '+37061284412' }],
    [0.8, { type: 'action', kind: 'monitoring', text: ATTACHED }],
    [2, { type: 'transcript', role: 'scammer', text: 'Laba diena, skambinu iš banko saugumo skyriaus.' }],
    [3.5, { type: 'risk', score: 22, reason: 'Caller claims to be bank staff' }],
    [5, { type: 'transcript', role: 'victim', text: 'Laba diena. O kas atsitiko?' }],
    [7.5, { type: 'transcript', role: 'scammer', text: 'Iš jūsų sąskaitos kažkas bando pervesti 2 400 eurų. Turime veikti skubiai.' }],
    [9.5, { type: 'risk', score: 61, reason: 'Urgency, money at stake' }],
    [10, { type: 'level', level: 3, reason: 'urgency and money' }],
    [10.6, { type: 'action', kind: 'family_sms', text: SMS_FIRST }],
    [11.4, { type: 'action', kind: 'victim_warning', text: 'Guardian warned the victim', speech: WARNING_SPEECH }],
    [18, { type: 'transcript', role: 'victim', text: 'Oi. O ką man dabar daryti?' }],
    [20.5, { type: 'transcript', role: 'scammer', text: 'Niekam nesakykite, tai konfidencialu. Perkelsime pinigus į saugią sąskaitą.' }],
    [22.5, { type: 'risk', score: 74, reason: 'Secrecy, “safe account” transfer' }],
    [25, { type: 'transcript', role: 'scammer', text: 'Dabar patvirtinkite tapatybę. Pasakykite Smart-ID kodą, kuris atsirado telefone.' }],
    [26.5, { type: 'risk', score: 96, reason: 'Requests the Smart-ID code' }],
    [27, { type: 'level', level: 5, reason: 'Smart-ID code requested' }],
    [27.6, { type: 'action', kind: 'intervention', text: 'Guardian told the victim to hang up', speech: INTERVENTION_SPEECH }],
    [28.4, { type: 'action', kind: 'family_sms', text: SMS_SECOND }],
    [32.5, { type: 'transcript', role: 'victim', text: 'Ne. Jokio kodo nesakysiu.' }],
    [35, { type: 'call_ended' }],
    [35.8, { type: 'summary', text: 'Bank impersonation. Asked for a €2,400 transfer to a “safe account” and the Smart-ID code. Victim disclosed nothing. Family notified twice.' }],
  ]),
};

// Long on purpose: tests transcript scrolling with a lot of text.
const police: Scenario = {
  id: 'police',
  key: '2',
  title: 'Police: son in an accident',
  plot: 'Long emotional call, bail in cash, then asks to log in to the bank',
  outcome: 5,
  steps: build('police', [
    [0, { type: 'call_started', from: '+37052733190' }],
    [0.8, { type: 'action', kind: 'monitoring', text: ATTACHED }],
    [2, { type: 'transcript', role: 'scammer', text: 'Laba diena, čia Vilniaus apskrities policija, tyrėjas Petrauskas. Ar kalbu su Aldona?' }],
    [4, { type: 'risk', score: 18, reason: 'Caller claims to be police' }],
    [5.5, { type: 'transcript', role: 'victim', text: 'Taip, aš. Kas nutiko?' }],
    [8, { type: 'transcript', role: 'scammer', text: 'Jūsų sūnus Tomas pateko į avariją Ukmergės gatvėje. Jis kaltas, sužeista moteris, nėščia. Jis dabar pas mus komisariate.' }],
    [10.5, { type: 'risk', score: 38, reason: 'Emotional pressure, relative in trouble' }],
    [12, { type: 'transcript', role: 'victim', text: 'Dieve mano... Ar jis gyvas? Ar galiu su juo pakalbėti?' }],
    [15, { type: 'transcript', role: 'scammer', text: 'Gyvas, bet labai išsigandęs. Dabar duosiu jam ragelį, tik trumpam.' }],
    [18, { type: 'transcript', role: 'scammer', text: 'Mama, čia aš... aš nenorėjau, padėk man, prašau, mane uždarys...' }],
    [20, { type: 'risk', score: 47, reason: 'Unverified voice of a relative, crying' }],
    [22, { type: 'transcript', role: 'victim', text: 'Tomai? Tomai, kas atsitiko? Tavo balsas kažkoks keistas.' }],
    [25, { type: 'transcript', role: 'scammer', text: 'Grįžtu aš. Kad sūnus negautų laisvės atėmimo, galima sumokėti užstatą. Reikia 8 000 eurų, šiandien, skubiai.' }],
    [27.5, { type: 'risk', score: 66, reason: 'Urgent cash demand, “bail”' }],
    [28, { type: 'level', level: 3, reason: 'urgent cash demand' }],
    [28.6, { type: 'action', kind: 'family_sms', text: SMS_FIRST }],
    [29.4, { type: 'action', kind: 'victim_warning', text: 'Guardian warned the victim', speech: WARNING_SPEECH }],
    [36, { type: 'transcript', role: 'victim', text: 'Bet tiek grynų namie neturiu. Turiu gal tūkstantį, kitkas banke.' }],
    [39, { type: 'transcript', role: 'scammer', text: 'Nieko tokio. Grynus atiduosite mūsų kurjeriui, jis atvažiuos per valandą. Niekam nesakykite, tai trukdytų tyrimui.' }],
    [41.5, { type: 'risk', score: 78, reason: 'Cash handover to a courier, secrecy' }],
    [44, { type: 'transcript', role: 'scammer', text: 'O likusią sumą pervesime kartu. Prisijunkite prie internetinės bankininkystės ir pasakykite man PIN kodą iš kortelės.' }],
    [46, { type: 'risk', score: 97, reason: 'Requests bank login and card PIN' }],
    [46.5, { type: 'level', level: 5, reason: 'bank login and PIN requested' }],
    [47.1, { type: 'action', kind: 'intervention', text: 'Guardian told the victim to hang up', speech: INTERVENTION_SPEECH }],
    [47.9, { type: 'action', kind: 'family_sms', text: SMS_SECOND }],
    [52, { type: 'transcript', role: 'victim', text: 'Ne, aš paskambinsiu Tomui pati. Viso gero.' }],
    [54, { type: 'call_ended' }],
    [54.8, { type: 'summary', text: 'Fake police, “son in an accident”. Asked for €8,000 bail in cash via courier, then bank login and card PIN. Victim hung up and called her son directly. Family notified twice.' }],
  ]),
};

// Shows that a trigger word alone ("kodas" for a door code) does not raise an alarm.
const courier: Scenario = {
  id: 'courier',
  key: '3',
  title: 'Courier delivery',
  plot: 'Normal call that mentions a door code. Stays at risk 1',
  outcome: 1,
  steps: build('courier', [
    [0, { type: 'call_started', from: '+37067012845' }],
    [0.8, { type: 'action', kind: 'monitoring', text: ATTACHED }],
    [2, { type: 'transcript', role: 'scammer', text: 'Sveiki, čia kurjeris, vežu jums siuntinį iš vaistinės. Ar būsite namuose apie trečią?' }],
    [4, { type: 'risk', score: 8, reason: 'Delivery coordination' }],
    [5.5, { type: 'transcript', role: 'victim', text: 'Taip, būsiu. Ačiū, kad paskambinot.' }],
    [8, { type: 'transcript', role: 'scammer', text: 'Puiku. Koks jūsų laiptinės durų kodas, kad nereikėtų skambinti?' }],
    [10, { type: 'risk', score: 14, reason: 'Door code for delivery: normal context, no money or bank data' }],
    [11.5, { type: 'transcript', role: 'victim', text: 'Kodas 2-4-8, trečias aukštas.' }],
    [14, { type: 'transcript', role: 'scammer', text: 'Ačiū, iki susitikimo.' }],
    [15.5, { type: 'risk', score: 6, reason: 'Ordinary delivery call' }],
    [17, { type: 'call_ended' }],
    [17.8, { type: 'summary', text: 'Legitimate delivery call. A door code was mentioned, but no money, bank data or pressure. No action taken.' }],
  ]),
};

const investment: Scenario = {
  id: 'investment',
  key: '4',
  title: 'Crypto investment',
  plot: '“Guaranteed” profit, pressure to invest today. Stops at risk 3',
  outcome: 3,
  steps: build('investment', [
    [0, { type: 'call_started', from: '+447700913452' }],
    [0.8, { type: 'action', kind: 'monitoring', text: ATTACHED }],
    [2, { type: 'transcript', role: 'scammer', text: 'Laba diena, skambinu iš investicijų platformos. Jūs anksčiau domėjotės kriptovaliutomis.' }],
    [4, { type: 'risk', score: 24, reason: 'Unsolicited investment offer, foreign number' }],
    [5.5, { type: 'transcript', role: 'victim', text: 'Nežinau, gal kažkada spaudžiau ant reklamos.' }],
    [8, { type: 'transcript', role: 'scammer', text: 'Mūsų klientai uždirba trisdešimt procentų per mėnesį, garantuotai. Pradėti galite nuo 500 eurų.' }],
    [10, { type: 'risk', score: 44, reason: '“Guaranteed” returns' }],
    [12, { type: 'transcript', role: 'victim', text: 'Skamba gerai, bet turiu pasitarti su dukra.' }],
    [14.5, { type: 'transcript', role: 'scammer', text: 'Pasiūlymas galioja tik šiandien. Pervesti reikia skubiai, o šeimai geriau nesakyti, kol neuždirbsite.' }],
    [16.5, { type: 'risk', score: 63, reason: 'Deadline pressure, isolates from family, asks for money' }],
    [17, { type: 'level', level: 3, reason: 'pressure to transfer money today' }],
    [17.6, { type: 'action', kind: 'family_sms', text: SMS_FIRST }],
    [18.4, { type: 'action', kind: 'victim_warning', text: 'Guardian warned the victim', speech: WARNING_SPEECH }],
    [25, { type: 'transcript', role: 'victim', text: 'Ačiū, aš nieko šiandien nepervesiu. Viso gero.' }],
    [27, { type: 'call_ended' }],
    [27.8, { type: 'summary', text: 'Investment fraud pattern: guaranteed returns, same-day deadline, isolation from family. Victim was warned and declined. Family notified.' }],
  ]),
};

export const SCENARIOS: readonly Scenario[] = [bank, police, courier, investment];

export function scenarioByKey(key: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.key === key);
}
