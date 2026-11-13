// Live view of what the brain decides, for testing without the dashboard.
// Follows the most recent call on /events: transcript, risk, level, reasons and summary.

const LEVEL_NAMES = { 1: "MONITOR", 3: "ALERT", 5: "INTERVENE" };

export function startLivePanel(root, { onAction } = {}) {
  root.innerHTML = `
    <div class="live-head">
      <span id="live-level" class="level level-0">NO CALL</span>
      <span id="live-risk">risk –</span>
    </div>
    <div class="risk-bar"><div id="live-risk-fill"></div></div>
    <div id="live-reason" class="reason"></div>
    <ol id="live-lines" class="lines"></ol>
    <div id="live-summary" class="summary" hidden></div>`;
  const $ = (id) => root.querySelector(`#${id}`);
  let room = null;

  function reset() {
    $("live-level").className = "level level-1";
    $("live-level").textContent = "LEVEL 1 · MONITOR";
    $("live-risk").textContent = "risk 0";
    $("live-risk-fill").style.width = "0%";
    $("live-reason").textContent = "";
    $("live-lines").innerHTML = "";
    $("live-summary").hidden = true;
  }

  function addLine(cls, label, text) {
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = `<b></b> <span></span>`;
    li.querySelector("b").textContent = label;
    li.querySelector("span").textContent = text;
    $("live-lines").append(li);
    li.scrollIntoView({ block: "nearest" });
  }

  const events = new EventSource("/events");
  events.onmessage = (message) => {
    const e = JSON.parse(message.data);
    if (e.type === "call_started") {
      room = e.room;
      reset();
    }
    if (e.room !== room) return;

    if (e.type === "transcript") {
      addLine(e.role, e.role === "scammer" ? "Skambinantysis" : "Auka", e.text);
    } else if (e.type === "risk") {
      $("live-risk").textContent = `risk ${e.score}`;
      $("live-risk-fill").style.width = `${e.score}%`;
      $("live-reason").textContent = e.reason;
    } else if (e.type === "level") {
      $("live-level").className = `level level-${e.level}`;
      $("live-level").textContent = `LEVEL ${e.level} · ${LEVEL_NAMES[e.level]}`;
      if (e.level > 1) addLine("alert", `▲ ${e.level}`, e.reason);
    } else if (e.type === "action") {
      addLine(e.kind === "intervention" ? "cut" : "action", e.kind === "intervention" ? "✂️" : "📱", e.text);
      onAction?.(e);
    } else if (e.type === "call_ended") {
      addLine("system", "—", "Skambutis baigtas");
    } else if (e.type === "summary") {
      $("live-summary").hidden = false;
      $("live-summary").textContent = e.text;
    }
  };
}
