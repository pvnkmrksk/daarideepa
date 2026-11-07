/* Adapt a bounded MATREX observation window to the native analysis columns. */
const MAX_RIGS = 32;
const MAX_POINTS_PER_RIG = 1800;
const MAX_WINDOW_SECONDS = 180;
const LEGACY_JUMP_METRES = .5;
const categoryKeys = ["config", "scene", "vr", "fly", "folder", "file", "animal", "mirrorConfig"];
const statsKeys = ["Trial", "Step", "Replicate", "OrientationR", "MovementR", "Points",
  "Distance", "Displacement", "PeakSpeed", "MedianSpeed", "Tortuosity", "Duration"];
const safeText = value => typeof value === "string" ? value : "";
const wrap = angle => ((angle + 180) % 360 + 360) % 360 - 180;
const finite = Number.isFinite;
const textOr = (...values) => values.map(safeText).find(Boolean);
const percentile = (sorted, p, fallback = 0) => {
  if (!sorted.length) return fallback;
  const index = (sorted.length - 1) * p, lo = Math.floor(index);
  return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
};
const sortedFinite = values => Array.from(values).filter(finite).sort((a, b) => a - b);

function histogram(values, range = null) {
  const sorted = sortedFinite(values);
  const lo = range?.[0] ?? sorted[0] ?? 0, hi = range?.[1] ?? sorted.at(-1) ?? 1;
  const p99 = percentile(sorted, .99, 1);
  const cap = p99 > lo ? p99 : hi > lo ? hi : lo + 1;
  const bins = 32, step = (cap - lo) / bins, counts = Array(bins).fill(0);
  let overflow = 0;
  for (const value of sorted) {
    if (value > cap) overflow += 1;
    else counts[Math.max(0, Math.min(bins - 1, Math.floor((value - lo) / step)))] += 1;
  }
  return {range: [lo, hi], displayRange: [lo, cap], overflow, counts,
    edges: Array.from({length: bins + 1}, (_, i) => lo + i * step)};
}

export function matchingTelemetry(data) {
  const frame = data.telemetry, context = data.context || {}, receiver = data.receiver || {};
  const pairs = [
    [frame?.experimentContext?.sessionId, context.sessionId],
    [frame?.system?.sceneName, context.experiment?.sceneName || context.scene?.name],
    [frame?.system?.sceneNumber, context.experiment?.sceneNumber],
    [frame?.system?.trialNumber, context.experiment?.trialNumber],
    [frame?.system?.running, context.experiment?.running],
  ];
  const mismatch = frame && pairs.some(([a, b]) => a != null && b != null && String(a) !== String(b));
  const contextTime = Date.parse(context.timestampUtc), frameTime = Date.parse(frame?.timestampUtc);
  const newer = finite(contextTime) && finite(frameTime) ? contextTime > frameTime
    : receiver.contextAgeSeconds != null && (receiver.snapshotAgeSeconds == null || receiver.contextAgeSeconds < receiver.snapshotAgeSeconds);
  return {frame: mismatch && newer ? null : frame, context: mismatch && !newer ? {} : context,
    waitingForPose: Boolean(mismatch && newer)};
}

export class LiveWindow {
  constructor() {
    this.publisher = null;
    this.session = "";
    this.scale = null;
    this.revision = 0;
    this.boundary = 0;
    this.clear();
  }

  clear() {
    this.rigs = new Map();
    this.animals = new Map();
    this.present = new Set();
    this.sequence = null;
    this.block = null;
    this.replicate = 0;
    this.revision += 1;
    this.boundary += 1;
  }

  ingest(data, frame, context) {
    const receiver = data.receiver || {};
    const publisher = JSON.stringify([receiver.endpoint, receiver.topic, receiver.connectionGeneration, receiver.publisherRestarts]);
    const session = textOr(frame?.experimentContext?.sessionId, context.sessionId);
    const units = frame?.experimentContext?.worldUnitsPerMetre ?? context.scene?.worldUnitsPerMetre;
    const scale = finite(units) && units > 0 ? units : null;
    const sequence = frame?.sequence;
    const restarted = this.publisher !== publisher || (session && this.session && session !== this.session)
      || (scale && this.scale && scale !== this.scale)
      || (finite(sequence) && finite(this.sequence) && sequence < this.sequence);
    if (restarted) {
      this.clear();
      this.session = "";
      this.scale = null;
    }
    this.publisher = publisher;
    if (session) this.session = session;
    if (scale) this.scale = scale;
    for (const animal of Array.isArray(context.animals) ? context.animals : []) {
      if (!animal || typeof animal.vrId !== "string" || !safeText(animal.animalId)) continue;
      if (this.animals.get(animal.vrId) !== animal.animalId && (this.animals.has(animal.vrId) || this.animals.size < MAX_RIGS)) {
        this.animals.set(animal.vrId, animal.animalId);
        this.revision += 1;
      }
    }
    const system = frame?.system ?? context.experiment;
    const running = system?.running !== false && Boolean(frame);
    const trial = finite(system?.trialNumber) ? Math.max(0, system.trialNumber - 1) : 0;
    const step = finite(system?.sceneNumber) ? Math.max(0, system.sceneNumber - 1) : 0;
    const scene = textOr(system?.sceneName, context.scene?.name, "Unknown scene");
    const key = JSON.stringify([trial, step, scene, system?.sceneBuildIndex ?? context.scene?.buildIndex ?? null]);
    if (!running) {
      if (this.block) this.boundary += 1;
      this.block = null;
      this.present.clear();
      if (finite(sequence)) this.sequence = sequence;
      return;
    }
    if (!finite(sequence) || this.sequence === sequence) return;
    const clock = finite(frame.realtimeSeconds) ? frame.realtimeSeconds : Date.parse(frame.timestampUtc) / 1000;
    if (!finite(clock)) return;
    this.sequence = sequence;
    if (this.block?.key !== key) {
      this.block = {key, trial, step, scene, replicate: ++this.replicate, start: clock, config: ""};
      this.boundary += 1;
    }
    const config = textOr(frame.experimentContext?.configFile, frame.experimentContext?.design,
      context.experiment?.configFile, context.experiment?.design);
    if (config) this.block.config = config;

    const current = new Set();
    const visible = (Array.isArray(frame.rigs) ? frame.rigs : []).slice(0, MAX_RIGS);
    const visibleIds = new Set(visible.filter(rig => rig?.active !== false && finite(rig?.pose?.x) && finite(rig?.pose?.z))
      .map(rig => rig.vrId));
    for (const rig of visible) {
      const id = safeText(rig?.vrId), pose = rig?.pose;
      if (!id || current.has(id) || rig.active === false || !finite(pose?.x) || !finite(pose?.z)) continue;
      if (!this.rigs.has(id)) {
        if (this.rigs.size >= MAX_RIGS) {
          const absent = [...this.rigs.keys()].find(known => !visibleIds.has(known));
          if (absent == null) continue;
          this.rigs.delete(absent);
        }
        this.rigs.set(id, []);
      }
      current.add(id);
      const samples = this.rigs.get(id), previous = samples.at(-1);
      const {x, z} = pose, yaw = pose.yaw ?? rig.headingDegrees, marker = rig.poseContinuityId;
      const dt = clock - (previous?.clock ?? clock);
      const markerKnown = Number.isSafeInteger(marker) && Number.isSafeInteger(previous?.marker);
      const gap = !previous || !this.present.has(id) || previous.block !== this.block || dt <= 0 || dt > 1
        || (markerKnown ? marker !== previous.marker
          : this.scale && Math.hypot(x - previous.x, z - previous.z) > this.scale * LEGACY_JUMP_METRES);
      const distance = gap ? 0 : Math.hypot(x - previous.x, z - previous.z);
      const rawSpeed = gap ? NaN : distance / dt;
      const movement = distance > 0 ? Math.atan2(x - previous.x, z - previous.z) * 180 / Math.PI : NaN;
      const point = {block: this.block, clock, x, z, marker, gap, distance, rawSpeed, movement,
        orientation: finite(yaw) ? wrap(yaw) : NaN};
      let speedSum = 0, speedCount = 0, path = 0;
      if (!gap) {
        speedSum = rawSpeed; speedCount = 1; path = distance;
        for (let offset = 1; offset <= 14 && offset <= samples.length; offset += 1) {
          const old = samples[samples.length - offset];
          if (offset === 14) {
            const chord = Math.hypot(x - old.x, z - old.z);
            point.tortuosity = chord > 0 ? Math.max(1, path / chord) : NaN;
          }
          if (old.gap) break;
          if (offset < 14) path += old.distance;
          if (offset < 10 && finite(old.rawSpeed)) { speedSum += old.rawSpeed; speedCount += 1; }
        }
      }
      point.speed = speedCount ? speedSum / speedCount : NaN;
      samples.push(point);
    }
    for (const [id, points] of this.rigs) {
      let remove = Math.max(0, points.length - MAX_POINTS_PER_RIG);
      while (remove < points.length && points[remove].clock < clock - MAX_WINDOW_SECONDS) remove += 1;
      if (remove) points.splice(0, remove);
      if (!points.length) this.rigs.delete(id);
    }
    this.present = current;
    this.revision += 1;
  }

  dataset(targets = {}) {
    const pattern = "MATREX live";
    const names = Object.fromEntries(categoryKeys.map(key => [key, new Map()]));
    const columns = Object.fromEntries(["x", "z", "time", "speed", "rawSpeed", "orientation",
      "movement", "tortuosity", "segment", "breakBefore", "segmentMirrorSign",
      ...statsKeys.map(key => "segment" + key),
      ...categoryKeys.map(key => "segment" + key[0].toUpperCase() + key.slice(1)),
    ].map(key => [key, []]));
    const segmentIds = [];

    for (const [id, points] of this.rigs) {
      for (let start = 0, end = 0; start < points.length; start = end) {
        const block = points[start].block;
        end = start + 1;
        while (end < points.length && points[end].block === block) end += 1;
        const config = block.config || block.scene, fly = this.animals.get(id) || id;
        const file = `${this.session || pattern}/${id}`, segment = segmentIds.length;
        segmentIds.push(`${file}:${block.trial}:${block.step}:${block.replicate}`);
        const labels = {config, scene: block.scene, vr: id, fly, folder: this.session || pattern,
          file, animal: `${fly}@${id}`, mirrorConfig: config};
        for (const [key, label] of Object.entries(labels)) {
          if (!names[key].has(label)) names[key].set(label, names[key].size);
          columns["segment" + key[0].toUpperCase() + key.slice(1)].push(names[key].get(label));
        }
        let distance = 0, displacement = 0, spanStart = points[start];
        const speeds = [], tortuosities = [];
        const circular = {orientation: [0, 0, 0], movement: [0, 0, 0]};
        for (let index = start; index < end; index += 1) {
          const point = points[index], gap = index === start || point.gap;
          if (gap && index > start) {
            const previous = points[index - 1];
            displacement += Math.hypot(previous.x - spanStart.x, previous.z - spanStart.z);
            spanStart = point;
          }
          columns.x.push(point.x); columns.z.push(point.z);
          columns.time.push(point.clock - block.start);
          columns.segment.push(segment); columns.breakBefore.push(Number(gap));
          for (const key of ["speed", "rawSpeed", "orientation", "movement", "tortuosity"]) {
            columns[key].push(gap && key !== "orientation" ? NaN : point[key] ?? NaN);
          }
          if (!gap) {
            distance += point.distance;
            if (finite(point.speed)) speeds.push(point.speed);
            if (finite(point.tortuosity)) tortuosities.push(point.tortuosity);
          }
          for (const [key, sum] of Object.entries(circular)) {
            if (!finite(point[key]) || (gap && key === "movement")) continue;
            const radians = point[key] * Math.PI / 180;
            sum[0] += Math.sin(radians); sum[1] += Math.cos(radians); sum[2] += 1;
          }
        }
        const last = points[end - 1];
        displacement += Math.hypot(last.x - spanStart.x, last.z - spanStart.z);
        speeds.sort((a, b) => a - b); tortuosities.sort((a, b) => a - b);
        const resultant = ([sin, cos, count]) => count ? Math.min(1, Math.hypot(sin, cos) / count) : NaN;
        const stats = {Trial: block.trial, Step: block.step, Replicate: block.replicate,
          OrientationR: resultant(circular.orientation), MovementR: resultant(circular.movement),
          Points: end - start, Distance: distance, Displacement: displacement,
          PeakSpeed: speeds.at(-1) ?? 0, MedianSpeed: percentile(speeds, .5),
          Tortuosity: percentile(tortuosities, .5, 1), Duration: last.clock - block.start};
        for (const key of statsKeys) columns["segment" + key].push(stats[key]);
        columns.segmentMirrorSign.push(1);
      }
    }
    for (const [key, values] of Object.entries(columns)) {
      columns[key] = key === "segment" ? Uint32Array.from(values)
        : key === "breakBefore" ? Uint8Array.from(values) : Float32Array.from(values);
    }
    const categories = Object.fromEntries(categoryKeys.map(key => [key, [...names[key].keys()]]));
    const filterHistograms = {
      trial: histogram(columns.segmentTrial), step: histogram(columns.segmentStep),
      replicate: histogram(columns.segmentReplicate), time: histogram(columns.time),
      resultant: histogram(columns.segmentOrientationR, [0, 1]), peak: histogram(columns.segmentPeakSpeed),
      displacement: histogram(columns.segmentDisplacement), distance: histogram(columns.segmentDistance),
    };
    const ranges = Object.fromEntries(Object.entries(filterHistograms).map(([key, item]) => [key, item.range]));
    ranges.peakSpeed = ranges.peak;
    for (const key of ["x", "z", "speed", "rawSpeed"]) {
      let lo = Infinity, hi = -Infinity;
      for (const value of columns[key]) if (finite(value)) { lo = Math.min(lo, value); hi = Math.max(hi, value); }
      ranges[key] = finite(lo) ? [lo, hi] : [0, 1];
    }
    const durations = sortedFinite(columns.segmentDuration);
    const playbackQuantiles = Object.fromEntries(Object.entries({median: .5, p95: .95, p99: .99, max: 1})
      .map(([key, p]) => [key, percentile(durations, p)]));
    const rois = Object.fromEntries(categories.config.filter(key => Object.hasOwn(targets, key)).map(key => [key, targets[key]]));
    return {columns, header: {pattern, datasetId: pattern, categories, displayCategories: categories, segmentIds,
      counts: {files: 0, sourceRows: columns.x.length, retainedRows: columns.x.length,
        segments: segmentIds.length, animals: categories.animal.length},
      playbackQuantiles, playbackMax: playbackQuantiles.p95, filterHistograms, ranges, rois}};
  }
}
