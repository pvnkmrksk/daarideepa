'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
  const model = fs.readFileSync('native_dashboard/static/live_dataset.js');
  const {LiveWindow, matchingTelemetry} = await import('data:text/javascript;base64,' + model.toString('base64'));
  const live = new LiveWindow();
  const receiver = {endpoint: 'tcp://host:9880', topic: 'matrex.telemetry.v2', connectionGeneration: 1};
  const time = seconds => new Date(Date.UTC(2026, 9, 25) + seconds * 1000).toISOString();
  const identity = {sessionId: 'run-A', worldUnitsPerMetre: 100, configFile: 'choice.json'};
  let context = {sessionId: 'run-A', scene: {worldUnitsPerMetre: 100},
    animals: [{vrId: 'VR1', animalId: 'animal β'}]};
  let sequence = 0;
  function emit(x, {trial = 1, step = 1, marker, running = true, active = true, at,
    scene = 'Choice', rigs, source = identity, duplicate = false} = {}) {
    if (!duplicate) sequence += 1;
    const clock = at ?? sequence / 10;
    const telemetry = {schemaVersion: 2, sequence, timestampUtc: time(clock), realtimeSeconds: clock,
      experimentContext: source, system: {sceneName: scene, sceneNumber: step, trialNumber: trial, running},
      rigs: rigs ?? [{vrId: 'VR1', active, poseContinuityId: marker, pose: {x, z: 2, yaw: 45}}]};
    const data = {receiver, context, telemetry};
    const matched = matchingTelemetry(data);
    live.ingest(data, matched.frame, matched.context);
    return matched;
  }

  emit(0, {marker: 1}); emit(1, {marker: 1}); emit(1, {marker: 1, duplicate: true});
  emit(12, {marker: 4}); emit(13, {marker: 4});
  emit(14, {marker: 4, active: false}); emit(16, {marker: 4}); emit(17, {marker: 4});
  emit(70, {marker: 4, trial: 2}); emit(71, {marker: 4, trial: 2});
  emit(72, {marker: 4, trial: 2, step: 2}); emit(73, {marker: 4, trial: 2, step: 2});
  const {header, columns} = live.dataset({'choice.json': [{x: 4, z: 6, type: 'bar'}]});
  assert.equal(header.counts.retainedRows, 10);
  assert.equal(header.counts.segments, 3);
  assert.deepEqual(header.categories.animal, ['animal β@VR1']);
  assert.equal(header.rois['choice.json'][0].type, 'bar');
  assert.deepEqual([...columns.segmentTrial], [0, 1, 1]);
  assert.deepEqual([...columns.segmentStep], [0, 0, 1]);
  assert.deepEqual([...columns.breakBefore], [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual([...columns.segmentDistance], [3, 1, 1]);
  assert.deepEqual([...columns.segmentDisplacement], [3, 1, 1]);
  assert.ok(Number.isNaN(columns.rawSpeed[2]));
  assert.ok(Number.isNaN(columns.movement[2]));

  const messages = [];
  const worker = {self: {}, postMessage: message => messages.push(message), performance};
  vm.createContext(worker);
  vm.runInContext(fs.readFileSync('native_dashboard/static/worker.js', 'utf8'), worker);
  worker.self.onmessage({data: {type: 'init', header, columns}});
  worker.self.onmessage({data: {type: 'compute', scope: 'full', requestId: 1,
    state: {groupBy: 'all', colorBy: 'none', panelColumns: 1, pointBudget: 1000, binSize: 1}}});
  assert.equal(messages[0].type, 'ready');
  assert.equal(messages[1].type, 'result', messages[1].error);
  const {products} = messages[1];
  assert.deepEqual([...products.trajectory.vertices], [0, 2, 1, 2, 12, 2, 13, 2, 16, 2, 17, 2, 70, 2, 71, 2, 72, 2, 73, 2]);
  for (const key of ['heatmap', 'direction', 'polar', 'heading', 'metrics', 'roi', 'diagnostics']) {
    assert.ok(products[key], key + ' uses the shared native worker');
  }

  worker.self.onmessage({data: {type: 'compute', scope: 'transition', requestId: 2,
    state: {groupBy: 'all', colorBy: 'none', panelColumns: 1, pointBudget: 1000, binSize: 1, transitionSplit: 20}}});
  assert.ok(messages[2].products?.transition, messages[2].error);

  receiver.connectionGeneration += 1;
  emit(0); emit(51); emit(52);
  assert.deepEqual([...live.dataset().columns.breakBefore], [1, 1, 0], 'A large legacy jump breaks the path');
  emit(120, {running: false}); emit(60);
  assert.deepEqual([...live.dataset().columns.segment], [0, 0, 0, 1], 'Stop and restart breaks a reused trial number');
  const before = live.dataset().header.counts.retainedRows;
  context = {sessionId: 'run-A', timestampUtc: time(100),
    experiment: {sceneName: 'Choice', sceneNumber: 3, trialNumber: 1}, scene: {worldUnitsPerMetre: 100}};
  assert.equal(emit(61).waitingForPose, true);
  assert.equal(live.dataset().header.counts.retainedRows, before, 'Context heartbeat does not append stale poses');
  context.timestampUtc = time(0);
  assert.equal(emit(62).waitingForPose, false, 'Old context cannot relabel a newer frame');
  const swapped = {...identity, sessionId: 'run-B', worldUnitsPerMetre: 1};
  emit(0, {scene: 'Terrain', source: swapped});
  assert.deepEqual([...live.dataset().columns.x], [0], 'Session and scale changes clear incompatible history');
  assert.deepEqual(live.dataset().header.categories.animal, ['VR1@VR1']);
  sequence = 0;
  emit(3, {scene: 'Terrain', source: swapped});
  assert.deepEqual([...live.dataset().columns.x], [3], 'A sequence rewind resets the viewing window');
  const manyRigs = Array.from({length: 40}, (_, i) => ({vrId: 'VR' + (i + 1), pose: {x: i, z: i, yaw: 0}}));
  for (let i = 0; i < 1850; i += 1) emit(i, {at: 1 + i / 100, rigs: manyRigs, scene: 'Terrain', source: swapped});
  const bounded = live.dataset();
  assert.equal(bounded.header.counts.animals, 32);
  assert.equal(bounded.header.counts.retainedRows, 32 * 1800);
  console.log('PASS: live and recorded worker products, reset and trial links, legacy fallback, metadata and history bounds');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
