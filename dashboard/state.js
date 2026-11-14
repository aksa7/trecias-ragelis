// Data layer: turns the event stream into one plain object describing the current call.
// The design (app.js + index.html + style.css) only reads this object, so it can change freely.

export function emptyCall() {
  return {
    room: null,
    from: "",
    startedAt: null, // Date
    endedAt: null, // Date
    level: 1, // 1 MONITOR, 3 ALERT, 5 INTERVENE
    levelReason: "",
    risk: 0, // 0-100, can go down (but never below the evidence)
    riskReason: "",
    riskHistory: [], // [{ at: Date, score, reason }] for a chart or a signals timeline
    lines: [], // [{ at: Date, role: "scammer" | "victim", text }]
    levelChanges: [], // [{ at: Date, level, reason }]
    actions: [], // [{ at: Date, kind: "family_sms" | "intervention" | ..., text }]
    summary: null, // text after the call
  };
}

/** Applies one event to the state. A new call_started replaces the previous call. */
export function applyEvent(call, event) {
  const at = new Date();
  if (event.type === "call_started") return { ...emptyCall(), room: event.room, from: event.from, startedAt: at };
  if (event.room !== call.room) return call; // events of an older call

  switch (event.type) {
    case "transcript":
      return { ...call, lines: [...call.lines, { at, role: event.role, text: event.text }] };
    case "risk":
      return { ...call, risk: event.score, riskReason: event.reason, riskHistory: [...call.riskHistory, { at, score: event.score, reason: event.reason }] };
    case "level":
      return {
        ...call,
        level: event.level,
        levelReason: event.reason,
        levelChanges: [...call.levelChanges, { at, level: event.level, reason: event.reason }],
      };
    case "action":
      return { ...call, actions: [...call.actions, { at, kind: event.kind, text: event.text }] };
    case "call_ended":
      return { ...call, endedAt: at };
    case "summary":
      return { ...call, summary: event.text };
    default:
      return call;
  }
}
