# BustedAI — būsena ir darbai

## Atnaujinimas (Tomas, 2026-11-14): telefonija + smegenys veikia

Plano pakeitimai (aptarti su Tomu, dar reikia suderinti su visais):
- **Skambutis per naršyklę, ne per telefono numerius.** Naujai Twilio paskyrai (sukurtai ne JAV) skambučiai į tikrus numerius blokuojami (klaida 21216, reikia verslo profilio). Todėl „sukčius“ ir „auka“ yra du tinklalapiai: `/phone/scammer.html` ir `/phone/victim.html` (Twilio Voice JS SDK).
- **Transkripcija – Twilio Real-Time Transcription su Deepgram nova-3 (lt) + raktažodžių užuominos**, ne ElevenLabs. Nereikia /media WebSocket.
- **Jokių balso įspėjimų aukai.** 3 lygis → SMS šeimai. 5 lygis → skambutis iškart nutraukiamas + SMS šeimai. Po skambučio (jei buvo 3+) → santrauka SMS žinute.
- SMS siunčiamos vardu „BustedAI“ (Twilio Messaging Service, sukuriamas automatiškai).

Kas padaryta:
- `src/index.ts` (Fastify), `src/telephony/` (žetonai, /voice, /transcription, /call-status, SMS, skambučio nutraukimas, Pinggy tunelis kūrimui), `public/phone/` (aukos ir sukčiaus puslapiai, gyvas smegenų skydelis).
- `src/brain/`: Claude Haiku 5.5 išskiria faktus (kas skambina, ko prašo, koks spaudimas), `rules.ts` paverčia juos rizika. Įrodymai (prašymai) niekada nemažėja, įtarimas gali kristi. 5 lygis tik prašant kodų / PIN / prisijungimų / nuotolinės prieigos; 3 lygis – prašant pinigų / grynųjų / slaptumo arba 2 kartus iš eilės aukštas įtarimas.
- `GET /events` (SSE) veikia.
- `npm run eval` – 9 testiniai skambučiai (sukčiai ir tikri skambučiai), visi praeina. `npm run replay` – dashboardo scenarijai per smegenis.

Paleidimas: `cp .env.example .env`, užpildyti Twilio ir `ANTHROPIC_API_KEY`, `npm install`, `npm start` – konsolėje bus aukos ir sukčiaus nuorodos.

## Dabartinė būsena

### Padaryta
- Repo struktūra, AGENTS.md (taisyklės ir atsakomybės), .gitignore (.env, node_modules, dist neįkeliami).
- src/events.ts — įvykių sutartis ir bus, įskaitant action.speech.
- web/ dashboardas (Vite + React + TS), pilnai veikiantis:
  - dviejų spalvų minimalistinis dizainas, IBM Plex Mono;
  - gyva akis (mirksi, seka kalbančius, susiaurėja kylant rizikai);
  - transkriptas su pabrauktais pavojingais žodžiais ir sargo („BustedAI") eilutėmis;
  - rizikos blokas su protokolu (1 Monitor, 3 Alert, 5 Intervene);
  - įvykių žurnalas su tipais (CALL, AI, RISK, SMS, VOICE) ir bylos santrauka;
  - 5 lygio raudona banga per ekraną;
  - scrollinimas prilimpa prie apačios, „Latest ↓" mygtukas;
  - 4 demo scenarijai: 1 bankas (→5), 2 policija (→5, ilgas), 3 kurjeris (lieka 1), 4 investicijos (→3);
  - jungiasi prie /events per SSE, veikia ir be backendo.
- web/scripts/mock-backend.mjs — netikras backendas SSE formatui testuoti.

### Dar nėra
- src/index.ts (Fastify serveris).
- src/telephony/ (Justas).
- src/brain/ (Tomas).
- public/audio/warning.mp3 ir intervention.mp3.
- Twilio paskyros ir numerio nustatymai.

## Darbai

### Justas — telefonija ir paruošimas
- [ ] Twilio paskyrą atnaujinti į mokamą (bandomoji paleidžia „trial account" pranešimą ir skambina tik į patvirtintus numerius).
- [ ] Nupirkti numerį su Voice + SMS.
- [ ] Geo permissions: Voice → Lietuva, Messaging → Lietuva.
- [ ] Numerio „A call comes in" → https://<adresas>/voice (POST).
- [ ] ElevenLabs (eleven_v3, lt) sugeneruoti warning.mp3 ir intervention.mp3 → public/audio/.
- [ ] src/telephony: POST /voice (Stream + Conference), aukos prijungimas, konferencijos statusų callback → call_started / call_ended.
- [ ] Sargo balsas tik aukai (coaching), POST /debug/warn rankiniam testui.
- [ ] SMS artimajam, POST /debug/sms rankiniam testui.
- [ ] Reakcija į level įvykius: 3 → SMS + warning, 5 → SMS + intervention, kiekvienas po kartą. Siųsti action įvykius su speech.
- [ ] Railway diegimas (stabilus adresas pitchui), ngrok tik kūrimui.

### Tomas — smegenys
- [ ] src/index.ts karkasas kartu su Justu (Fastify, formbody, websocket, static web/dist ir public/audio).
- [ ] GET /events (SSE) iš bus.
- [ ] /media WebSocket: start → room iš customParameters, media → pagal takelį į dvi STT jungtis.
- [ ] ElevenLabs STT: committed_transcript → transcript įvykis (scammer / victim).
- [ ] Rizika: raktažodžių greitas kelias + Claude Haiku JSON { score, reason } → risk; lygis tik aukštyn → level.
- [ ] Santrauka pokalbio pabaigoje → summary.

### Visi
- [ ] Generalinė repeticija salėje su projektoriumi, 3 kartus iš eilės.
- [ ] Pitch scenarijus ir vaidmenys (kas sukčius, kas auka, kas kalba).

## Testai (eilės tvarka)
| # | Testas | Sėkmė, kai |
|---|---|---|
| 1 | Skambutis → konferencija → srautas | Konsolėje media paketai su abiem takeliais, kol abu kalba |
| 2 | Transkribavimas | Dashboarde CALLER ir VICTIM eilutės lietuviškai, vėlavimas < 2 s |
| 3 | Sargo balsas | POST /debug/warn: auka girdi įrašą, sukčius negirdi |
| 4 | SMS | POST /debug/sms: žinutė ateina į LT telefoną |
| 5 | Visa grandinė | „Pasakykite Smart-ID kodą" → per ~2 s 5 lygis, auka girdi sargą, ateina SMS |
| 6 | Repeticija | 3 kartai iš eilės salėje per renginio internetą |

Sprendimo taškas: jei testas 3 nepraeina iki penktadienio vidurnakčio, sargo balsas grojamas visiems (announceUrl konferencijai).

## Gyvos demonstracijos taisyklės
- Sukčius kitame kambaryje arba toli su ausinukais (kitaip aidas ir sumaišyti balsai).
- Aukos telefonas ant garsiakalbio prie scenos mikrofono: salė girdi sukčių ir sargą.
- Serveris Railway, nešiojamasis per telefono hotspot, jei wifi blokuoja WebSocket.
- Atsarginis planas: dashboarde klavišai 1–4 paleidžia demo skambutį per sekundę.

## Paleidimas
- Dashboardas: `cd web && npm install && npm run dev` → http://localhost:5173/?offline, klavišai D, 1–4, R.
- Su netikru backendu: `node web/scripts/mock-backend.mjs`, tada http://localhost:5173.
- Pitchui: `cd web && npm run build`, backendas patiekia web/dist adresu http://localhost:3000 (arba Railway adresu).
