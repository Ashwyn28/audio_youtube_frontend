import { writable } from "svelte/store";

export const audioAnalysis = writable<{ analyser: AnalyserNode | null; active: boolean }>({
  analyser: null,
  active: false,
});

/** Seven logarithmic, measured FFT bands; a silent or unavailable input stays flat. */
export function readSpectrumLevels(analyser: AnalyserNode, data: Uint8Array): number[] {
  const levels = Array<number>(7).fill(0);
  const sampleRate = analyser.context.sampleRate;
  if (!data.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return levels;
  try { analyser.getByteFrequencyData(data); }
  catch { return levels; }
  const lower = 70;
  const upper = Math.min(9000, sampleRate / 2);
  if (upper <= lower) return levels;
  const hzPerBin = sampleRate / analyser.fftSize;
  for (let band = 0; band < levels.length; band++) {
    const start = Math.max(1, Math.floor(lower * (upper / lower) ** (band / 7) / hzPerBin));
    const end = Math.min(data.length, Math.max(start + 1, Math.ceil(lower * (upper / lower) ** ((band + 1) / 7) / hzPerBin)));
    let energy = 0;
    for (let bin = start; bin < end; bin++) energy += (data[bin] / 255) ** 2;
    levels[band] = end > start ? Math.min(1, Math.sqrt(energy / (end - start))) : 0;
  }
  return levels;
}

export interface AudioAnalysisConnection {
  resume(): Promise<void>;
  setActive(active: boolean): void;
  destroy(): void;
}

/** Lazily wrap the existing media element. No microphone or extra media source. */
export function connectAudioAnalysis(audio: HTMLAudioElement): AudioAnalysisConnection {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let actualPlaying = false;
  let disposed = false;
  let pending: Promise<void> | null = null;
  let session: { type: string } | undefined;
  let previousSessionType: string | undefined;

  function publish() {
    if (disposed) return;
    audioAnalysis.set({ analyser, active: Boolean(analyser && context?.state === "running" && actualPlaying) });
  }
  function configureSession() {
    if (session || typeof navigator === "undefined") return;
    try {
      session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) {
        previousSessionType = session.type;
        // Supported Safari versions use this to keep Web Audio in playback mode.
        session.type = "playback";
      }
    } catch { session = undefined; }
  }
  function attach() {
    if (!context || context.state !== "running" || source || disposed) return;
    let candidate: AnalyserNode | null = null;
    try {
      candidate = context.createAnalyser();
      candidate.fftSize = 2048;
      candidate.smoothingTimeConstant = 0.7;
      candidate.minDecibels = -90;
      candidate.maxDecibels = -20;
      // Establish the output first so a visualisation failure cannot cut sound.
      candidate.connect(context.destination);
      source = context.createMediaElementSource(audio);
      source.connect(candidate);
      analyser = candidate;
    } catch {
      try { candidate?.disconnect(); } catch { /* Already disconnected. */ }
      // Once wrapped, a media element must retain a route to the speakers.
      if (source) {
        try { source.disconnect(); source.connect(context.destination); } catch { /* Browser graph failure. */ }
      }
      analyser = null;
    }
    publish();
  }
  function stateChanged() {
    if (disposed) return;
    if (context?.state === "running") attach();
    publish();
  }
  async function activate() {
    if (disposed || typeof window === "undefined") return;
    configureSession();
    try {
      if (!context) {
        const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        context = new Constructor();
        context.addEventListener("statechange", stateChanged);
      }
      if (context.state !== "running") await context.resume();
      if (!disposed) attach();
    } catch {
      // Do not wrap the element while a context cannot run: native audio stays
      // audible even if this browser refuses or does not support analysis.
      publish();
    }
  }
  return {
    resume() {
      if (pending) return pending;
      pending = activate().finally(() => { pending = null; });
      return pending;
    },
    setActive(active) {
      actualPlaying = active;
      publish();
    },
    destroy() {
      disposed = true;
      actualPlaying = false;
      try { source?.disconnect(); } catch { /* Already disconnected. */ }
      try { analyser?.disconnect(); } catch { /* Already disconnected. */ }
      if (context) {
        context.removeEventListener("statechange", stateChanged);
        try { void context.close().catch(() => {}); } catch { /* Already closed. */ }
      }
      if (session && previousSessionType !== undefined) {
        try { session.type = previousSessionType; } catch { /* Read-only device setting. */ }
      }
      audioAnalysis.set({ analyser: null, active: false });
    },
  };
}
