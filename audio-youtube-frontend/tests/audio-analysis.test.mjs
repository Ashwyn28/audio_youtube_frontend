import test from "node:test";
import assert from "node:assert/strict";
import { get } from "svelte/store";
import { audioAnalysis, connectAudioAnalysis, readSpectrumLevels } from "../src/lib/audio-analysis.ts";

function spectrum(fill) {
  return { context: { sampleRate: 48000 }, fftSize: 2048, getByteFrequencyData(data) { data.fill(0); fill(data); } };
}
test("spectrum bands track actual low and high frequency energy and return flat silence", () => {
  const data = new Uint8Array(1024);
  const low = readSpectrumLevels(spectrum(bytes => { bytes[Math.round(160 / (48000 / 2048))] = 255; }), data);
  const high = readSpectrumLevels(spectrum(bytes => { bytes[Math.round(3200 / (48000 / 2048))] = 255; }), data);
  assert.equal(low.length, 7);
  assert.equal(low.indexOf(Math.max(...low)), 1);
  assert.equal(high.indexOf(Math.max(...high)), 5);
  assert.deepEqual(readSpectrumLevels(spectrum(() => {}), data), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(readSpectrumLevels(spectrum(bytes => bytes.fill(255)), data), [1, 1, 1, 1, 1, 1, 1]);
});
test("analysis read failures remain flat instead of inventing motion", () => {
  assert.deepEqual(readSpectrumLevels({ context: { sampleRate: 48000 }, getByteFrequencyData() { throw new Error("unavailable"); } }, new Uint8Array(1024)), Array(7).fill(0));
});

function graphEnvironment({ failResume = false, failAnalyser = false, failAnalyserConnect = false } = {}) {
  const calls = [];
  const listeners = new Set();
  const session = { type: "auto" };
  const analyser = { connect(to) { calls.push(["analyser-connect", to]); }, disconnect() { calls.push(["analyser-disconnect"]); } };
  const source = { connect(to) {
    calls.push(["source-connect", to]);
    if (failAnalyserConnect && to === analyser) throw new Error("graph unavailable");
  }, disconnect() { calls.push(["source-disconnect"]); } };
  let context;
  class FakeAudioContext {
    constructor() { context = this; this.state = "suspended"; this.destination = { speakers: true }; calls.push(["context"]); }
    addEventListener(name, listener) { listeners.add(listener); }
    removeEventListener(name, listener) { listeners.delete(listener); }
    async resume() {
      calls.push(["resume"]);
      if (failResume) throw new Error("gesture required");
      this.state = "running";
      for (const listener of listeners) listener();
    }
    createAnalyser() { if (failAnalyser) throw new Error("unsupported"); calls.push(["analyser"]); return analyser; }
    createMediaElementSource(audio) { calls.push(["source", audio]); return source; }
    async close() { this.state = "closed"; calls.push(["close"]); }
  }
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { AudioContext: FakeAudioContext } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { audioSession: session } });
  return { calls, source, analyser, session, context: () => context, listeners,
    restore() {
      for (const [name, descriptor] of [["window", windowDescriptor], ["navigator", navigatorDescriptor]]) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
      }
    },
  };
}
test("one audible graph is reused, follows actual playback and restores the device session on disposal", async () => {
  const env = graphEnvironment();
  const audio = {};
  const connection = connectAudioAnalysis(audio);
  try {
    assert.equal(env.calls.length, 0); // Creating the controller does not open an AudioContext.
    await connection.resume();
    assert.equal(env.session.type, "playback");
    assert.equal(get(audioAnalysis).active, false);
    assert.equal(env.analyser.fftSize, 2048);
    assert.equal(env.analyser.smoothingTimeConstant, 0.7);
    assert.equal(env.analyser.minDecibels, -90);
    assert.equal(env.analyser.maxDecibels, -20);
    const graph = env.calls.filter(call => call[0].endsWith("connect"));
    assert.deepEqual(graph, [["analyser-connect", env.context().destination], ["source-connect", env.analyser]]);
    connection.setActive(true);
    assert.equal(get(audioAnalysis).active, true);
    await connection.resume();
    assert.equal(env.calls.filter(call => call[0] === "source").length, 1);
    env.context().state = "suspended";
    for (const listener of env.listeners) listener();
    assert.equal(get(audioAnalysis).active, false);
    await connection.resume();
    assert.equal(get(audioAnalysis).active, true);
    connection.setActive(false);
    assert.equal(get(audioAnalysis).active, false);
    connection.destroy();
    assert.equal(env.session.type, "auto");
    assert.equal(env.context().state, "closed");
    assert.deepEqual(get(audioAnalysis), { analyser: null, active: false });
    assert.equal(env.listeners.size, 0);
  } finally { connection.destroy(); env.restore(); }
});
test("a refused context resume never wraps or mutes the native audio element", async () => {
  const env = graphEnvironment({ failResume: true });
  const connection = connectAudioAnalysis({});
  try {
    await connection.resume();
    assert.equal(env.calls.filter(call => call[0] === "source").length, 0);
    connection.setActive(true);
    assert.equal(get(audioAnalysis).active, false);
  } finally { connection.destroy(); env.restore(); }
});
test("analyser setup failure leaves native transport untouched", async () => {
  const env = graphEnvironment({ failAnalyser: true });
  const connection = connectAudioAnalysis({});
  try {
    await connection.resume();
    assert.equal(env.calls.filter(call => call[0] === "source").length, 0);
    assert.deepEqual(get(audioAnalysis), { analyser: null, active: false });
  } finally { connection.destroy(); env.restore(); }
});
test("a graph connection failure routes an already-wrapped source directly to speakers", async () => {
  const env = graphEnvironment({ failAnalyserConnect: true });
  const connection = connectAudioAnalysis({});
  try {
    await connection.resume();
    assert.deepEqual(env.calls.filter(call => call[0] === "source-connect").at(-1), ["source-connect", env.context().destination]);
    assert.equal(get(audioAnalysis).analyser, null);
  } finally { connection.destroy(); env.restore(); }
});
