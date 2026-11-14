// Live call view (a showcase: the calls themselves happen on the phones; this page only waits and
// shows them). render() reads the `call` object from state.js. SMS and call-cut actions show as a
// full-width banner for a few seconds, then move to the event log.
// Open with ?demo for a scripted call that plays on a loop, ?replay to replay the last real call
// (?replay=<name> for a specific one from recordings/), ?static for no animations.
import { applyEvent, emptyCall } from "./state.js";
import { loadRecording, playDemo, playScript } from "./demo.js";

const params = new URLSearchParams(location.search);
if (params.has("static")) document.documentElement.classList.add("static");
// Inside the demo stage the meter sits higher, leaving room for the mascots below it.
if (params.has("embedded")) document.documentElement.classList.add("embedded");
const DEMO = params.has("demo");
// ?demo opens the demo stage (dashboard on the left, room for notifications on the right), which shows
// this page inside it with ?demo&embedded.
if (DEMO && !params.has("embedded") && window === window.top) location.replace(`demo.html${location.search}`);
const REPLAY = params.has("replay") ? params.get("replay") || "latest" : null;

const BANNER_MS = 3500;
// The demo call is in English (for the pitch); live calls and replays are in Lithuanian.
const TEXT = DEMO
  ? {
      speakers: { scammer: "CALLER", victim: "GRANDMA" },
      states: { 1: "All good", 3: "Suspicious", 5: "Scammer" },
      cut: "Call cut",
      sms: "SMS sent to family",
      live: { waiting: "WAITING", live: "LIVE", cut: "CUT", ended: "ENDED" },
      ready: "Ready",
      waitingTitle: "Waiting for a call",
      waitingHint: "Call analysis starts automatically.",
    }
  : {
      speakers: { scammer: "SKAMBINANTYSIS", victim: "PAŠNEKOVAS" },
      states: { 1: "Viskas gerai", 3: "Įtartina", 5: "Sukčius" },
      cut: "Skambutis nutrauktas",
      sms: "Artimiesiems išsiųstas SMS",
      live: { waiting: "LAUKIAMA", live: "TIESIOGIAI", cut: "NUTRAUKTAS", ended: "BAIGTAS" },
    };
if (DEMO) {
  document.documentElement.lang = "en";
  document.querySelector(".ready").textContent = TEXT.ready;
  document.querySelector(".idle-panel h2").textContent = TEXT.waitingTitle;
  document.querySelector(".idle-panel p").textContent = TEXT.waitingHint;
}
const ICONS = {
  // phone handset, hung up (outline)
  cut: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"><path d="M32 24c-10 0-19 3-25 8-2 2-2 4 0 6l3 3c2 2 4 2 6 0l4-3c1-1 2-2 2-4v-3c3-1 7-1 10-1s7 0 10 1v3c0 2 1 3 2 4l4 3c2 2 4 2 6 0l3-3c2-2 2-4 0-6-6-5-15-8-25-8z"/></svg>`,
  // speech bubble
  sms: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"><path d="M10 14h44v28H30l-12 10V42h-8z"/></svg>`,
};

// Avatars: a photo in avatars/ (scammer.jpg, grandma.jpg) if there is one, otherwise the drawing.
const AVATARS = { scammer: "avatars/scammer.svg", victim: "avatars/grandma.svg" };
for (const [role, name] of [["scammer", "scammer"], ["victim", "grandma"]]) {
  fetch(`avatars/${name}.jpg`, { method: "HEAD" })
    .then((res) => res.ok && (AVATARS[role] = `avatars/${name}.jpg`) && render())
    .catch(() => {});
}

// Phrases worth highlighting in a line that raised the level (Lithuanian stems, any ending; English for the demo).
const KEY_PHRASES = [
  /safe\s+account/iu,
  /smart[\s-]?id\s+\p{L}*/iu,
  /mobile[\s-]?id\s+\p{L}*/iu,
  /pin\s+kod\p{L}*|(?<!\p{L})pin(?!\p{L})/iu,
  /slaptažod\p{L}*/iu,
  /prisijungim\p{L}*\s+\p{L}+/iu,
  /saug\p{L}*\s+sąskait\p{L}*/iu,
  /pervesk\p{L}*(\s+\p{L}+)?|perkelsime\s+pinigus/iu,
  /niekam\s+nesakyk\p{L}*/iu,
  /grynuos\p{L}*|užstat\p{L}*/iu,
  /\p{L}*kod\p{L}*/iu,
];

const $ = (id) => document.getElementById(id);
let call = emptyCall();
let seenRoom = null;
let seenLines = 0;
let seenActions = 0;
let liveFeed = false; // false while the server replays history on connect: old actions go straight to the log
const bannerQueue = [];
let bannerBusy = false;
const logged = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "02:31": time since the call started. */
function clock(at) {
  if (!call.startedAt || !at) return "00:00";
  const seconds = Math.max(0, Math.floor((at - call.startedAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The caller line that triggered each level change, with that level. */
function triggers(call) {
  const byLine = new Map();
  for (const change of call.levelChanges) {
    if (change.level < 3) continue;
    const line = call.lines.filter((l) => l.at <= change.at && l.role === "scammer").at(-1);
    if (line) byLine.set(line, change.level);
  }
  return byLine;
}

/** The text of a line, with the key phrase marked when the line raised the level. */
function textWithMark(text, marked) {
  const span = el("span", "text");
  const match = marked && KEY_PHRASES.map((p) => text.match(p)).find(Boolean);
  if (!match) {
    span.textContent = text;
    return span;
  }
  const end = match.index + match[0].length;
  span.append(text.slice(0, match.index), el("span", "mark", match[0]), text.slice(end));
  return span;
}

/** What a banner / log entry says about an action. */
function describe(action) {
  const reason = call.levelChanges.filter((c) => c.at <= action.at).at(-1)?.reason ?? "";
  const cut = action.kind === "intervention";
  return { style: cut ? "cut" : "sms", title: cut ? TEXT.cut : TEXT.sms, detail: reason, at: action.at };
}

/** Shows queued banners one at a time; each moves to the event log when it closes. */
function showNextBanner() {
  if (bannerBusy || !bannerQueue.length) return;
  bannerBusy = true;
  const item = bannerQueue.shift();
  $("banner").className = `banner ${item.style}`;
  $("banner-icon").innerHTML = ICONS[item.style];
  $("banner-title").textContent = item.title;
  $("banner-detail").textContent = item.detail;
  // Open right away (not on the next animation frame: background tabs delay those, and a late
  // "open" could land after the close). Reading offsetHeight first lets the slide-in animate.
  void $("banner").offsetHeight;
  $("banner").classList.add("open");

  setTimeout(() => {
    $("banner").classList.remove("open");
    logged.push(item);
    renderLog();
    setTimeout(() => {
      bannerBusy = false;
      showNextBanner();
    }, 500);
  }, BANNER_MS);
}

function renderLog() {
  // Only the last few, so the log never pushes the page past one screen.
  $("log").replaceChildren(
    ...logged.slice(-3).map((item) => {
      const li = el("li", item.style);
      li.append(el("span", "check", "✓"), el("span", "time", clock(item.at)), el("span", "", `·  ${item.title}`));
      return li;
    }),
  );
}

const METER_LENGTH = 2 * Math.PI * 46; // circumference of the meter ring (r = 46)
let meterRisk = 0;
let deltaTimer;

/** Big risk meter: arc, knob, number, state, and a short-lived "+15" pill when the risk changes. */
function renderMeter() {
  const risk = call.risk;
  $("meter-arc").style.strokeDasharray = `${(METER_LENGTH * risk) / 100} ${METER_LENGTH}`;
  $("meter-knob").style.transform = `rotate(${(360 * risk) / 100}deg)`;
  $("meter-value").textContent = risk;
  $("meter-state").textContent = TEXT.states[call.level];

  const delta = risk - meterRisk;
  meterRisk = risk;
  if (delta === 0 || !call.room) return;
  const pill = $("meter-delta");
  pill.textContent = `${delta > 0 ? "↗ +" : "↘ −"}${Math.abs(delta)}`;
  pill.className = `meter-delta show ${delta > 0 ? "up" : "down"}`;
  clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => pill.classList.remove("show"), 2500);
}

let mascotLevel = null;

/** Demo stage: shows the mascot video for the current level, restarted from its first frame. */
function renderMascot() {
  if (call.level === mascotLevel) return;
  mascotLevel = call.level;
  for (const video of document.querySelectorAll(".mascot")) {
    const active = Number(video.dataset.level) === call.level;
    video.classList.toggle("active", active);
    if (active) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }
}

function render() {
  if (call.room !== seenRoom) {
    seenRoom = call.room;
    seenLines = 0;
    seenActions = 0;
    meterRisk = 0;
    bannerQueue.length = 0;
    logged.length = 0;
    renderLog();
  }
  const live = Boolean(call.room && !call.endedAt);
  const cut = call.actions.some((a) => a.kind === "intervention");
  document.body.dataset.level = String(call.level);
  document.body.classList.toggle("on-air", live);
  document.body.classList.toggle("idle", !call.room); // waiting screen until a call starts

  $("live-label").textContent = TEXT.live[live ? "live" : call.room ? (cut ? "cut" : "ended") : "waiting"];
  renderMeter();
  renderMascot();

  const marked = triggers(call);
  const shown = call.lines.slice(-30);
  $("lines").replaceChildren(
    ...shown.map((line, i) => {
      const level = marked.get(line);
      const isNew = call.lines.indexOf(line) >= seenLines;
      const isLatest = i === shown.length - 1;
      // The newest line is the person speaking now: their avatar is in colour, all others grey.
      const classes = [level ? `level-${level} flagged` : "", isLatest ? "latest speaking" : "", isNew ? "new" : ""];
      const row = el("li", classes.filter(Boolean).join(" "));
      const avatar = el("img", "avatar");
      avatar.src = AVATARS[line.role];
      avatar.alt = "";
      const body = el("div", "body");
      body.append(el("span", "meta", `${clock(line.at)}  •  ${TEXT.speakers[line.role]}`), textWithMark(line.text, Boolean(level)));
      row.append(avatar, body);
      return row;
    }),
  );
  seenLines = call.lines.length;

  for (const action of call.actions.slice(seenActions)) {
    if (action.kind !== "intervention" && action.kind !== "family_sms") continue;
    if (liveFeed) bannerQueue.push(describe(action));
    else logged.push(describe(action));
  }
  if (!liveFeed) renderLog();
  seenActions = call.actions.length;
  showNextBanner();

  $("summary").textContent = call.summary ?? "";
}

function tick() {
  $("timer").textContent = call.room ? clock(call.endedAt ?? new Date()) : "00:00";
}

function onEvent(event) {
  // Inside the demo stage, the phone next to the dashboard shows the SMS alerts.
  if (window !== window.top) window.parent.postMessage({ kind: "call-event", event }, location.origin);
  call = applyEvent(call, event);
  render();
  tick();
}

const DEMO_WAIT_MS = 4000; // the waiting screen shows this long before each demo call

function backToWaiting() {
  call = emptyCall();
  render();
  tick();
}

render();
setInterval(tick, 500);

if (DEMO || REPLAY) {
  // Demo / replay: waiting screen, the call, back to waiting, and again.
  liveFeed = true;
  const play = REPLAY
    ? await loadRecording(REPLAY).then(
        (script) => (onDone) => playScript(script, onEvent, onDone),
        (err) => (console.error(err), (onDone) => playDemo(onEvent, onDone)),
      )
    : (onDone) => playDemo(onEvent, onDone);
  const loop = () =>
    setTimeout(() => play(() => {
      backToWaiting();
      loop();
    }), DEMO_WAIT_MS);
  loop();
} else {
  // Live: the call is made on the phones; this page waits for it and shows it.
  const events = new EventSource("/events");
  events.onmessage = (message) => onEvent(JSON.parse(message.data));
  events.addEventListener("live", () => (liveFeed = true)); // history replay is over
  events.onerror = () => (liveFeed = false); // on reconnect the server replays history again
}
