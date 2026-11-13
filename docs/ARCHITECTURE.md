# BustedAI — architektūra

BustedAI (darbinis pavadinimas „Trečias ragelis") yra AI sargas telefono linijoje. Jis klausosi pokalbio, realiu laiku transkribuoja lietuvišką kalbą, vertina sukčiavimo riziką ir kylant rizikai įspėja auką balsu (girdi tik auka) bei siunčia SMS artimajam. Viskas rodoma gyvai dashboarde.

## Visa grandinė

```
Sukčius
   │ skambina į Twilio numerį
   ▼
Twilio ──POST /voice──► serveris grąžina TwiML:
   │                     1) <Start><Stream track="both_tracks"> → garsas į wss://.../media
   │                     2) <Dial><Conference>room-<CallSid></Conference>
   │
   ├─ serveris: participants.create → Twilio skambina aukai ir prijungia ją prie konferencijos
   │
   ├─ /media WebSocket
   │     inbound takelis  = sukčiaus balsas
   │     outbound takelis = aukos balsas
   │     → 2 ElevenLabs realaus laiko STT jungtys (lt, ulaw_8000)
   │     → galutiniai sakiniai → bus.emit({ type: 'transcript' })
   │
   ├─ Rizika (po kiekvieno sukčiaus sakinio)
   │     greitas kelias: raktažodžiai (Smart-ID, PIN, kodą, saugi sąskaita…)
   │     protingas kelias: Claude Haiku → { score 0–100, reason }
   │     → bus.emit({ type: 'risk' }), lygis tik kyla: ≥50 → 3, ≥80 → 5 → bus.emit({ type: 'level' })
   │
   ├─ Reakcija į lygį (telefonija)
   │     3 lygis: SMS artimajam + švelnus sargo įspėjimas, girdimas TIK aukai
   │     5 lygis: antras SMS + griežtas sargo įsikišimas („padėkite ragelį"), girdimas TIK aukai
   │     → bus.emit({ type: 'action', kind, text, speech })
   │
   ├─ Pabaiga: konferencijos statusas → call_ended, Claude santrauka → summary
   │
   └─ GET /events (Server-Sent Events) → dashboardas (web/) projektoriuje
```

## Komponentai ir atsakomybės

| Dalis | Kelias | Savininkas | Ką daro |
|---|---|---|---|
| Telefonija | src/telephony/ | Justas | /voice webhook, konferencija, aukos prijungimas, sargo balsas (coaching), SMS, /debug/* maršrutai |
| Smegenys | src/brain/ | Tomas | /media WebSocket, ElevenLabs STT, rizikos vertinimas, santrauka, /events SSE |
| Įvykių sutartis | src/events.ts | bendra | CallEvent tipai ir bus (emit/on) |
| Serveris | src/index.ts | bendra | Fastify paleidimas, maršrutų registravimas, web/dist ir public/audio patiekimas |
| Dashboardas | web/ | Justas | Vite + React + TS, rodo įvykius iš /events, turi demo režimą |

## Įvykių sutartis (src/events.ts ir web/src/types.ts)

| Įvykis | Kas siunčia | Laukai |
|---|---|---|
| call_started | telefonija | room, from |
| transcript | smegenys | room, role ('scammer' arba 'victim'), text |
| risk | smegenys | room, score (0–100), reason |
| level | smegenys | room, level (1, 3 arba 5), reason. Siunčiamas po kartą kiekvienam lygiui, tik aukštyn |
| action | telefonija | room, kind ('monitoring', 'family_sms', 'victim_warning', 'intervention'), text, speech? (tikslūs sargo žodžiai) |
| call_ended | telefonija | room |
| summary | smegenys | room, text |

- room visada yra "room-" + įeinančio skambučio CallSid.
- SSE formatas: viena žinutė vienam įvykiui, `data: <json>\n\n`.
- Keičiant sutartį keičiami ABU failai: src/events.ts ir web/src/types.ts.

## Sargo balsas, kurį girdi tik auka

Twilio konferencijose yra „coaching": dalyvį, sukurtą su `coaching: true` ir `callSidToCoach: <aukos CallSid>`, girdi tik auka. Sargo įrašai iš anksto sugeneruoti ElevenLabs (modelis eleven_v3, nes tik jis palaiko lietuvių kalbą TTS) ir patiekiami kaip statiniai failai:
- public/audio/warning.mp3 — 3 lygis
- public/audio/intervention.mp3 — 5 lygis

Bandomi du būdai (pirmas, kuris praeis testą 3):
1. participants.create su coaching į mūsų pačių Twilio numerį; /voice atpažįsta From = mūsų numeris ir grąžina `<Play>…mp3</Play><Hangup/>`.
2. announceUrl ant aukos dalyvio (reikia patikrinti, ar sukčius negirdi).
Atsarginis variantas, jei nepavyks: announceUrl visai konferencijai (girdės ir sukčius).

## Patvirtinti API faktai
- Twilio `<Start><Stream>`: mulaw, 8000 Hz, base64; žinutės connected, start, media, stop. Stream url be query parametrų, naudoti `<Parameter>` → start.customParameters.
- `track="both_tracks"`: inbound = ką Twilio gauna iš skambintojo, outbound = ką Twilio siunčia skambintojui (įskaitant „child call").
- Twilio coaching: coaching dalyvį girdi tik tas, kurį jis „koučina".
- ElevenLabs realaus laiko STT: wss://api.elevenlabs.io/v1/speech-to-text/realtime, model_id=scribe_v2_realtime, language_code=lt, audio_format=ulaw_8000, commit_strategy=vad, antraštė xi-api-key. Gaunamos žinutės: session_started, partial_transcript, committed_transcript (laukas text).
- ElevenLabs TTS lietuviškai: tik eleven_v3.

## Dar nepatvirtinta (testuoti prieš remiantis)
- Ar `<Start><Stream>` srautas tęsiasi po `<Dial><Conference>`.
- Lauko, kuriame media žinutėje nurodomas takelis, pavadinimas (tikimasi media.track).
- Koks būdas sukurti coaching botą veikia paprasčiausiai.
- Ar SMS iš ne lietuviško Twilio numerio patikimai pasiekia LT operatorius.
- Lietuviško transkribavimo kokybė ir bendras vėlavimas telefono garse.

## Žinomas produkto apribojimas (atsakymas komisijai)
Demo metu sukčius skambina tiesiai į Twilio numerį. Tikrame produkte žmogus įjungia peradresavimą (*21*). Jei peradresuojami visi skambučiai ir Twilio skambina atgal į tą patį numerį, susidaro ciklas. Sprendimas: peradresavimas „neatsiliepus" arba atskiras numeris. Tai po hackathono.
