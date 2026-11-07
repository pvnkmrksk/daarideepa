import {matchingTelemetry} from "./live_dataset.js";

export function mountLiveControls({receive, clear, pause, connectionLost}) {
  const byId = id => document.getElementById(id);
  const text = (id, value) => {
    const element = byId(id), next = value ?? "—";
    if (element.textContent !== next) element.textContent = next;
  };
  const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "—";
  const states = {receiving: "Telemetry receiving", waiting: "Waiting for publisher",
    stale: "Telemetry stale", error: "Receiver error", disconnected: "Choose a publisher"};
  const connectFields = ["connect-button", "endpoint", "topic"].map(byId);
  let lastVersion = -1, paused = false;
  function cell(row, primary, secondary, stale = false) {
    const td = document.createElement("td");
    td.textContent = primary ?? "—";
    td.dataset.stale = String(stale);
    if (secondary) {
      const small = document.createElement("small");
      small.textContent = secondary;
      td.append(small);
    }
    row.append(td);
  }

  function update(data) {
    if (data.version < lastVersion) return;
    lastVersion = data.version;
    const {frame, context, waitingForPose} = matchingTelemetry(data);
    const receiver = data.receiver || {}, system = frame?.system || context.experiment || {};
    const scene = system.sceneName || context.scene?.name;
    const units = frame?.experimentContext?.worldUnitsPerMetre ?? context.scene?.worldUnitsPerMetre;
    const status = states[receiver.state] || "Waiting for publisher";
    text("connection", status);
    byId("connection").dataset.state = receiver.state || "waiting";
    text("diagnostics", `${receiver.endpoint || "No publisher selected"} · ${receiver.snapshots || 0} snapshots · ${receiver.contexts || 0} context heartbeats · ${receiver.sequenceGaps || 0} source-sequence gaps · ${receiver.invalidPackets || 0} invalid packets · ${receiver.publisherRestarts || 0} publisher restarts · snapshot age ${number(receiver.snapshotAgeSeconds, 2)} s · context age ${number(receiver.contextAgeSeconds, 2)} s`);
    text("live-error", receiver.error || (waitingForPose ? "Waiting for a pose in the new trial or scene." : system.error || ""));
    text("run-id", context.experimentName || context.sessionId || frame?.experimentContext?.sessionId);
    text("scene", scene ? `${scene} · block ${system.sceneNumber || "—"}` : "—");
    text("phase", `Trial ${system.trialNumber || "—"} · ${system.phase || "idle"}${Number.isFinite(system.remainingStepSeconds) ? " · " + number(system.remainingStepSeconds) + " s" : ""}`);
    text("fps", Number.isFinite(frame?.frameTiming?.framesPerSecond) ? number(frame.frameTiming.framesPerSecond) + " FPS" : "—");
    text("config", frame?.experimentContext?.configFile || context.experiment?.configFile || context.experiment?.design);
    text("position-units", `World X / Z · ${units === 1 ? "metres" : units === 100 ? "centimetres" : "scene world units"}`);
    receive(data, frame, context, status);
    if (!byId("live-controls").open) return;
    const profiles = new Map((Array.isArray(context.animals) ? context.animals : []).filter(Boolean).map(a => [a.vrId, a]));
    const body = byId("live-animals");
    body.replaceChildren();
    for (const rig of (frame?.rigs || []).slice(0, 32)) {
      if (!rig) continue;
      const profile = profiles.get(rig.vrId) || {}, row = document.createElement("tr");
      cell(row, profile.animalId || rig.vrId, profile.animalId ? rig.vrId : "");
      cell(row, profile.speciesName || "Species unspecified", profile.backend || rig.input?.backend || rig.input?.source);
      const age = rig.input?.latest?.ageSeconds != null ? rig.input.latest.ageSeconds + (receiver.snapshotAgeSeconds || 0) : null;
      cell(row, rig.input?.state || "Inactive", age != null ? number(age, 2) + " s since input" : "",
        rig.input?.latest?.fresh === false || age > 1);
      cell(row, number(rig.closedLoop?.yawGain, 2), `DC ${number(rig.closedLoop?.yawDCOffsetDegrees, 2)}°`);
      cell(row, rig.autoTrim?.supported ? (rig.autoTrim.flying ? "Flying" : "Not flight ready") : "Walking / other", rig.autoTrim?.state);
      cell(row, number(rig.closedLoop?.yawOutputDegPerSecond) + " °/s", rig.closedLoop?.appliedThisFrame ? "Applied this frame" : "");
      body.append(row);
    }
  }

  byId("clear-view").onclick = clear;
  byId("pause-view").onclick = () => {
    paused = !paused;
    text("pause-view", paused ? "Resume view" : "Pause view");
    pause(paused);
  };
  byId("connect-form").onsubmit = async event => {
    event.preventDefault();
    byId("connect-button").disabled = true;
    try {
      const response = await fetch("/api/live/connect", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({endpoint: byId("endpoint").value, topic: byId("topic").value})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed");
      clear();
      text("connect-message", "Waiting for the next published snapshot.");
    } catch (error) { text("connect-message", error.message); }
    finally { byId("connect-button").disabled = false; }
  };
  fetch("/api/live/snapshot", {cache: "no-store"}).then(response => response.json()).then(data => {
    for (const field of connectFields) field.disabled = !data.controlAvailable;
    if (data.receiver?.endpoint) byId("endpoint").value = data.receiver.endpoint;
    if (data.receiver?.topic) byId("topic").value = data.receiver.topic;
    byId("recorded-link").hidden = data.recordedAvailable === false;
    if (!data.controlAvailable) text("connect-message", "The server operator controls the publisher connection.");
    update(data);
  }).catch(error => text("live-error", error.message));
  const events = new EventSource("/api/live/stream");
  events.addEventListener("snapshot", event => {
    try { update(JSON.parse(event.data)); }
    catch (error) { text("live-error", "Cannot display packet: " + error.message); }
  });
  events.onerror = () => {
    lastVersion = -1;
    text("connection", "Viewer connection lost · reconnecting");
    byId("connection").dataset.state = "stale";
    connectionLost();
  };
}
