// Shared browser helpers for the victim and scammer pages.
const statusEl = document.getElementById("status");
const qualityEl = document.getElementById("quality");

export function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

async function fetchToken(role) {
  const res = await fetch(`/token?role=${role}`);
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  return res.json();
}

// Logs this page in to Twilio as `role` (scammer or victim) and keeps the token fresh.
// Returns the device plus the rtcConfiguration (TURN relays) to pass to connect()/accept().
export async function createDevice(role, options = {}) {
  const { token, iceServers } = await fetchToken(role);
  const device = new Twilio.Device(token, {
    codecPreferences: ["opus", "pcmu"],
    edge: ["dublin", "frankfurt"], // nearest Twilio entry points for Lithuania
    closeProtection: true,
    ...options,
  });
  device.on("error", (err) => setStatus(`Error ${err.code ?? ""}: ${err.message}`, "error"));
  device.on("tokenWillExpire", async () => device.updateToken((await fetchToken(role)).token));
  return { device, rtcConfiguration: { iceServers } };
}

const WARNING_TEXT = {
  "high-rtt": "high delay",
  "high-jitter": "uneven audio timing",
  "high-packet-loss": "audio packets lost",
  "low-mos": "low call quality",
  "constant-audio-input-level": "microphone seems silent",
  "constant-audio-output-level": "no audio coming in",
};

// Shows live network/audio problems the SDK detects during a call.
export function watchQuality(call) {
  const active = new Set();
  const render = () => {
    qualityEl.textContent = active.size ? `⚠️ ${[...active].map((w) => WARNING_TEXT[w] ?? w).join(", ")}` : "";
  };
  call.on("warning", (name) => { active.add(name); render(); });
  call.on("warning-cleared", (name) => { active.delete(name); render(); });
  call.on("disconnect", () => { active.clear(); render(); });
}
