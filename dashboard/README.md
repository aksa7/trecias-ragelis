# Demo dashboard (Tomas)

The screen shown on the projector during the pitch: the live conversation and the risk.
Plain HTML/CSS/JS, no build step. Served by the backend at `/dashboard/`.
(Justas's dashboard in `web/` is a separate version.)

## Open it

- Live, with real calls: `<server address>/dashboard/`
- Demo mode for the pitch: `<server address>/dashboard/?demo`. Opens the demo stage (`demo.html`): the dashboard on
  the left, in English, playing a scripted scam call on a loop with the ElevenLabs voice-over (`demo.mp3`, click once
  for sound), the level mascots under the meter, and on the right the daughter's phone receiving the SMS alerts.
  Script and voice-over: `docs/demo-voiceover.md`.
- Replay a recorded real call: `<server address>/dashboard/?replay` (the last one) or `?replay=<name>` (from `recordings/`)

## Files

| File | What it is | Change when designing? |
|---|---|---|
| `index.html` | Layout (placeholder) | Yes |
| `style.css` | Look (placeholder). `body[data-level]` is `1`, `3` or `5` | Yes |
| `app.js` | `render(call)` puts the data into the page | Yes, to match your layout |
| `state.js` | Turns events into the `call` object | Only if you need new data |
| `demo.js` | The scripted call for `?demo`, timed to `demo.mp3`; also loads recordings for `?replay` | Optional, to change the story |
| `demo.html` | Demo stage: dashboard frame + phone with SMS notifications | Yes |
| `demo.mp3`, `mascots/` | Voice-over and the mascot video for each level (1, 3, 5) | Replace to change them |

## Data available in `render(call)`

| Field | Meaning |
|---|---|
| `room`, `from` | Call id and caller |
| `startedAt`, `endedAt` | Dates; `endedAt` is null while the call is live |
| `level` | 1 MONITOR, 3 ALERT (family texted), 5 INTERVENE (call cut). Only goes up |
| `levelReason`, `levelChanges[]` | Why, and when each level was reached |
| `risk` (0–100), `riskReason` | Current risk; it can go down, never below the evidence |
| `riskHistory[]` | `{ at, score }` for a chart |
| `lines[]` | `{ at, role: "scammer" \| "victim", text }`: the live conversation |
| `actions[]` | `{ at, kind, text }`: `family_sms` (SMS sent) and `intervention` (call cut) |
| `summary` | Lithuanian summary after the call |
