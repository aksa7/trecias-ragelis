# BustedAI dashboard (`web/`)

Owner: Justas. Reads live call events from the backend over SSE (`GET /events`)
and shows them. Works without the backend through the built-in demo.

## Run

```bash
cd web
npm install
npm run dev            # http://localhost:5173, forwards /events to localhost:3000
```

| Want | Do |
|---|---|
| Demo without backend | open `http://localhost:5173/?offline`, press **D** for the menu or **1–4** |
| Autoplay a demo | `http://localhost:5173/?offline&demo=2` (scenario 2) |
| Fake backend (tests SSE path) | `node scripts/mock-backend.mjs` in a second terminal, then reload |
| Reset screen | press **R** |
| Backend on another port | `BACKEND_URL=http://localhost:4000 npm run dev` |
| Change protected person / contact | `web/.env.local`: `VITE_PROTECTED_NAME`, `VITE_EMERGENCY_CONTACT` |

## For the pitch (one URL, no Vite)

```bash
cd web && npm run build    # creates web/dist
```
The backend serves `web/dist` at `/` (see `@fastify/static` in `src/index.ts`).
Open `http://localhost:3000` on the presenting laptop.

## Event contract

The dashboard understands exactly the events in `src/types.ts`
(mirror of the backend `src/events.ts`). One SSE message per event:

```
data: {"type":"transcript","room":"room-CA123","role":"scammer","text":"..."}\n\n
```

- `level` only goes up (1 → 3 → 5). If the backend sends only `risk`, the
  dashboard derives the level itself (>= 50 → 3, >= 80 → 5).
- A `call_started` event resets the screen for the new call.
- An `action` with `speech` (the exact words the guardian said into the call)
  is also shown in the transcript as a BustedAI line.

## Structure

```
src/
  types.ts              event contract (keep in sync with backend)
  config.ts             protected person + emergency contact labels
  state/callReducer.ts  events → screen state (pure function)
  hooks/                SSE stream, demo player, timers
  demo/scenarios.ts     4 scripted calls: bank (5), police (5), courier (1), investment (3)
  lib/                  level definitions, trigger words, formatting
  components/           one file per section of the screen
  styles/global.css     all styling; two colours: --fg and --accent
```
