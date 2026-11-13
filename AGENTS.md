# BustedAI (Trecias ragelis) — project rules

## Documentation
Read docs/ARCHITECTURE.md for how the system works and docs/STATUS.md for what is
done and what is next. Update docs/STATUS.md checkboxes when you finish a task.

## What we are building
A phone-call guardian. A scammer calls a Twilio number, the call is bridged to the
victim, we listen to both sides, transcribe Lithuanian speech in real time, score
scam risk, escalate through 3 levels, and show everything live on a dashboard.

## Escalation levels (only go up during a call: 1 -> 3 -> 5)
- Level 1 MONITOR: unknown caller, small talk or offers. AI listens silently.
- Level 3 ALERT (score >= 50): urgency, asks for money. SMS to emergency contact, victim is warned.
- Level 5 INTERVENE (score >= 80): asks for Smart-ID, PIN, logins. Guardian voice tells the victim
  not to share the code and to hang up; family notified again.
AI "granny" swap is postponed. Do not build it unless agreed.

## Who owns what
| Folder / file           | Owner  | Contents                                              |
|-------------------------|--------|-------------------------------------------------------|
| src/telephony/          | Justas | Twilio webhooks, call bridge, SMS, guardian voice     |
| src/brain/              | Tomas  | media WebSocket, speech-to-text, risk score, SSE      |
| web/                    | Justas | dashboard (Vite + React + TS), separate package.json  |
| src/events.ts           | shared | event contract. Change only after agreeing in chat    |
| src/index.ts            | shared | server start, route registration, serves web/dist     |
| AGENTS.md, .env.example | shared | tell the other person when you change them            |

Rule for humans and AI agents: do not edit files in the other person's folder.
If you need something from it, ask the owner.

## Event contract (src/events.ts, mirrored in web/src/types.ts)
- brain emits: transcript, risk, level, summary
- telephony emits: call_started, action, call_ended
- room is always "room-" + CallSid of the incoming call
- action.speech (optional) = the exact words the guardian said into the call; the dashboard shows it in the transcript as a BustedAI line
- level is emitted once per level, only upwards
- GET /events is Server-Sent Events, one message per event: data: <json>\n\n
If you change the contract, update BOTH src/events.ts and web/src/types.ts.

## Git workflow (both of us work directly on main)
Before starting work and every time the other says "pushed":
    git pull --rebase
When a piece works:
    git add .
    git commit -m "short description"
    git pull --rebase
    git push
Then write "pushed" in the team chat. Never push code that does not start. Never commit .env.

## Environment
Copy .env.example to .env and fill in your own values. Each developer uses their own
Twilio number and their own ngrok address.

## Verified API facts (do not invent alternatives)
- Twilio <Start><Stream> forks call audio to our WebSocket: mulaw, 8000 Hz, base64.
- Twilio Stream url does not support query strings. Use <Parameter>; values arrive in the
  "start" message under start.customParameters.
- Twilio WebSocket messages: connected, start, media (media.payload), stop.
- ElevenLabs realtime speech-to-text: wss://api.elevenlabs.io/v1/speech-to-text/realtime
  query: model_id=scribe_v2_realtime, language_code=lt, audio_format=ulaw_8000,
  commit_strategy=vad. Header: xi-api-key.
  Send: {"message_type":"input_audio_chunk","audio_base_64":"...","commit":false,"sample_rate":8000}
  Receive: session_started, partial_transcript, committed_transcript (field "text").

## Not yet verified (test before relying on it)
- <Start><Stream> together with <Dial><Conference>
- playing a warning to the victim mid-call (conference announce)
- Lithuanian transcription quality on phone audio, and total delay

## Style
Keep it simple. No database. In-memory state. Log every step to the console.
