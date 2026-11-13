// Evaluation set for the brain: fixed calls with the level they should reach.
// Runs every case through the real brain (keywords + Claude + rules) in parallel and prints a table.
//   npm run eval
// Add a case whenever a live call is judged wrongly, so the mistake can't come back unnoticed.
import 'dotenv/config';
import { bus, type Level } from '../src/events';
import { startBrain } from '../src/brain';

type Role = 'scammer' | 'victim';
interface Case {
  name: string;
  expected: Level;
  lines: [Role, string][];
}

const CASES: Case[] = [
  {
    name: 'Fake bank → Smart-ID code',
    expected: 5,
    lines: [
      ['scammer', 'Laba diena, skambinu iš banko saugumo skyriaus.'],
      ['victim', 'Laba diena. O kas atsitiko?'],
      ['scammer', 'Iš jūsų sąskaitos kažkas bando pervesti 2 400 eurų. Turime veikti skubiai.'],
      ['scammer', 'Niekam nesakykite, tai konfidencialu. Perkelsime pinigus į saugią sąskaitą.'],
      ['scammer', 'Dabar patvirtinkite tapatybę. Pasakykite Smart-ID kodą, kuris atsirado telefone.'],
    ],
  },
  {
    name: 'Fake police, son in accident → PIN',
    expected: 5,
    lines: [
      ['scammer', 'Laba diena, čia policija, tyrėjas Petrauskas.'],
      ['scammer', 'Jūsų sūnus pateko į avariją ir sužeidė žmogų. Jis dabar pas mus.'],
      ['victim', 'Dieve mano, ar jis gyvas?'],
      ['scammer', 'Kad jo neuždarytų, reikia šiandien sumokėti aštuonis tūkstančius eurų užstatą.'],
      ['scammer', 'Grynus atiduosite mūsų kurjeriui. O likusiai sumai pasakykite PIN kodą iš kortelės.'],
    ],
  },
  {
    name: 'Fake police, son in accident (no code asked)',
    expected: 3,
    lines: [
      ['scammer', 'Laba diena, čia policija, tyrėjas Petrauskas.'],
      ['scammer', 'Jūsų sūnus pateko į avariją ir sužeidė žmogų.'],
      ['scammer', 'Kad jo neuždarytų, reikia šiandien sumokėti aštuonis tūkstančius eurų užstatą. Grynus atiduosite kurjeriui.'],
    ],
  },
  {
    name: 'Crypto investment pressure',
    expected: 3,
    lines: [
      ['scammer', 'Skambinu iš investicijų platformos. Siūlome investuoti į kriptovaliutas.'],
      ['scammer', 'Garantuotas pelnas trisdešimt procentų per mėnesį, pradėti galite nuo 500 eurų.'],
      ['scammer', 'Pasiūlymas galioja tik šiandien, pervesti reikia skubiai, šeimai nesakykite.'],
    ],
  },
  {
    name: 'Grandson scam: new number, send money',
    expected: 3,
    lines: [
      ['scammer', 'Močiute, čia aš, Tomas. Čia mano naujas numeris, senas telefonas sugedo.'],
      ['victim', 'Tomai? Balsas kažkoks kitoks.'],
      ['scammer', 'Peršalęs esu. Klausyk, man labai reikia pinigų, šiandien turiu sumokėti už nuomą, kitaip išmes.'],
      ['scammer', 'Pervesk man penkis šimtus, tik mamai nesakyk, gerai?'],
    ],
  },
  {
    name: 'Genuine bank: informs about payments',
    expected: 1,
    lines: [
      ['scammer', 'Sveiki. Čia skambina Swedbank klientų aptarnavimo skyrius.'],
      ['scammer', 'Ar kalbu su ponia Regina?'],
      ['victim', 'Taip.'],
      ['scammer', 'Mes pastebėjome, kad jūsų sąskaitoje buvo atlikti įtartini mokėjimai. Ar jūs juos atlikote?'],
      ['victim', 'Ne, ne aš.'],
      ['scammer', 'Tada šiuos mokėjimus pažymime ir grąžiname jums atgal. Daugiau nieko daryti nereikia. Ačiū, gražios dienos.'],
    ],
  },
  {
    name: 'Genuine bank: warns never to share codes',
    expected: 1,
    lines: [
      ['scammer', 'Laba diena, čia SEB bankas. Primename, kad jūsų kortelės galiojimas baigiasi kitą mėnesį.'],
      ['scammer', 'Naują kortelę galėsite atsiimti skyriuje. Atminkite, bankas niekada neprašo Smart-ID kodo telefonu.'],
    ],
  },
  {
    name: 'Courier asks for door code',
    expected: 1,
    lines: [
      ['scammer', 'Sveiki, čia kurjeris, vežu jums siuntinį iš vaistinės. Ar būsite namuose apie trečią?'],
      ['victim', 'Taip, būsiu.'],
      ['scammer', 'Koks jūsų laiptinės durų kodas, kad nereikėtų skambinti?'],
      ['victim', 'Kodas du keturi aštuoni.'],
    ],
  },
  {
    name: 'Real grandson borrows 20 eur',
    expected: 1,
    lines: [
      ['scammer', 'Labas, močiute, čia Tomas. Kaip sekasi?'],
      ['victim', 'Labas, Tomuk! Gerai, o tu kaip?'],
      ['scammer', 'Viskas gerai. Gal galėtum paskolinti dvidešimt eurų iki penktadienio? Atvažiuosiu sekmadienį pietų.'],
      ['victim', 'Žinoma, atvežk tik pyragų.'],
    ],
  },
];

const GAP_MS = 2500; // time between lines, so Claude can assess each one like in a live call
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(c: Case, index: number) {
  const room = `room-EVAL-${index}`;
  let level: Level = 1;
  let risk = 0;
  const off = bus.on((e) => {
    if (e.room !== room) return;
    if (e.type === 'level') level = Math.max(level, e.level) as Level;
    if (e.type === 'risk') risk = e.score;
  });

  bus.emit({ type: 'call_started', room, from: '+37060000000' });
  for (const [role, text] of c.lines) {
    await sleep(GAP_MS);
    bus.emit({ type: 'transcript', room, role, text });
  }
  await sleep(5000); // let the last assessments finish
  off();
  return { name: c.name, expected: c.expected, level, risk };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) console.warn('ANTHROPIC_API_KEY not set: only keyword rules are evaluated.\n');
  startBrain();
  const quiet = console.log;
  console.log = () => {}; // hide the brain's per-assessment logs; the table is the output
  const results = await Promise.all(CASES.map(run));
  console.log = quiet;

  let passed = 0;
  console.log('\n result | expected | got | final risk | case');
  for (const r of results) {
    const ok = r.level === r.expected;
    if (ok) passed++;
    console.log(` ${ok ? 'PASS  ' : 'FAIL  '} |    ${r.expected}     |  ${r.level}  |     ${String(r.risk).padStart(3)}    | ${r.name}`);
  }
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main();
