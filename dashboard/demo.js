// Demo mode (open the dashboard with ?demo): plays a scripted scam call, no phones or server events needed.
// Useful while designing. Timings in seconds from the start. In English, for the pitch.
// Plays with the ElevenLabs voice-over demo.mp3 (script: docs/demo-voiceover.md). Each line appears 0.4 s
// after its speaker stops in the audio, like a final transcript. Risk, levels and their delays are what the
// real brain produced for these lines (reasons translated from Lithuanian):
// All good (1) → Suspicious (3, family SMS) → Scammer (5, call cut right after the code request).

const ROOM = "room-DEMO";
const SCRIPT = [
  [0, { type: "call_started", from: "client:scammer" }],
  [0.2, { type: "level", level: 1, reason: "Call monitored" }],
  [3.9, { type: "transcript", role: "scammer", text: "Good afternoon, this is John from your bank's security department." }],
  [5.9, { type: "risk", score: 25, reason: "Claims to be bank security, asks for nothing yet" }],
  [6.9, { type: "transcript", role: "victim", text: "Oh, hello. Is something wrong?" }],
  [12.8, { type: "transcript", role: "scammer", text: "We've noticed an unusual payment of 2,400 euros leaving your account." }],
  [16.3, { type: "transcript", role: "victim", text: "Oh dear... I didn't send any money!" }],
  [21.8, { type: "transcript", role: "scammer", text: "Don't worry, we'll stop it. But we have to act quickly, before the money is gone." }],
  [23.8, { type: "risk", score: 37, reason: "Bank security, 2,400 euros leaving, rushing her" }],
  [24.6, { type: "transcript", role: "victim", text: "All right... what do I need to do?" }],
  [31.9, { type: "transcript", role: "scammer", text: "We'll move your savings to a safe account. And please, don't tell anyone about this, not even your family." }],
  [33.6, { type: "risk", score: 60, reason: "Poses as the bank, wants her savings in a “safe account”" }],
  [33.6, { type: "level", level: 3, reason: "Wants her savings moved to a “safe account”" }],
  [34.4, { type: "action", kind: "family_sms", text: "SMS → Daughter: “GETBUSTED: a possible scammer is calling Mum. Please call her.”" }],
  [36.7, { type: "transcript", role: "victim", text: "Not even my daughter? She always helps me with the bank..." }],
  [44.1, { type: "transcript", role: "scammer", text: "No, this is a confidential investigation. You've just received a Smart-ID code. Read it to me." }],
  [44.1, { type: "risk", score: 85, reason: "Asks for the Smart-ID code" }],
  [44.1, { type: "level", level: 5, reason: "Asked for her Smart-ID code" }],
  [45.3, { type: "action", kind: "intervention", text: "Call cut: asked for the Smart-ID code" }], // the audio cuts here
  [45.4, { type: "call_ended" }],
  [46, { type: "risk", score: 95, reason: "Poses as the bank, asks for the Smart-ID code and her savings" }],
  [46.4, { type: "action", kind: "family_sms", text: "SMS → Daughter: “GETBUSTED: Mum's call was CUT. The caller asked for her Smart-ID code. Call her now.”" }],
  [48, {
    type: "summary",
    text: "A scam: the caller posed as the bank, wanted her savings moved, demanded secrecy and asked for her Smart-ID code. Call her now and check she didn't confirm anything.",
  }],
];

const END_PAUSE_SECONDS = 8; // the finished call stays on screen this long

// The voice-over. Browsers only allow sound after the viewer has clicked or pressed a key on the page,
// so until then the demo runs silently; the first click starts the audio at the right point of the call.
const audio = new Audio("demo.mp3");
let audioStartedAt = null; // performance.now() when the current demo call started

function playAudioFrom(seconds) {
  audio.currentTime = seconds;
  audio.play().catch(() => {});
}
function startAudio() {
  if (audioStartedAt !== null && audio.paused) playAudioFrom((performance.now() - audioStartedAt) / 1000);
}
for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, startAudio);
// The demo stage (demo.html) passes on clicks made outside this frame.
window.addEventListener("message", (e) => e.origin === location.origin && e.data === "start-audio" && startAudio());

/** Plays a script of [seconds, event] pairs once through `onEvent`, then calls `onDone`. */
export function playScript(script, onEvent, onDone) {
  for (const [seconds, event] of script) setTimeout(() => onEvent(event), seconds * 1000);
  setTimeout(() => onDone?.(), (script.at(-1)[0] + END_PAUSE_SECONDS) * 1000);
}

/** Plays the scripted demo call with its voice-over once, then calls `onDone` (back to the waiting screen). */
export function playDemo(onEvent, onDone) {
  audioStartedAt = performance.now();
  playAudioFrom(0);
  playScript(SCRIPT.map(([seconds, event]) => [seconds, { ...event, room: ROOM }]), onEvent, () => {
    audioStartedAt = null;
    audio.pause();
    onDone?.();
  });
}

/** A recorded call from the server (recordings/<name>.json) as a script. */
export async function loadRecording(name) {
  const res = await fetch(`/recordings/${encodeURIComponent(name)}.json`);
  if (!res.ok) throw new Error(`Recording "${name}" not found`);
  const recording = await res.json();
  return recording.events.map(({ t, event }) => [t, event]);
}
