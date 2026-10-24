<script lang="ts">
  import { onMount } from "svelte";
  import { audioAnalysis, readSpectrumLevels } from "$lib/audio-analysis";

  let mounted = false;
  let live = false;
  let levels = Array<number>(7).fill(0);
  let bins = new Uint8Array(0);
  let analyser: AnalyserNode | null = null;
  let frame: number | null = null;
  let lastSample = 0;
  let reducedMotion = false;

  $: if (mounted) update($audioAnalysis.analyser, $audioAnalysis.active);

  function stop() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    lastSample = 0;
    live = false;
    levels = Array<number>(7).fill(0);
  }

  function update(next: AnalyserNode | null, active: boolean) {
    if (next !== analyser) {
      analyser = next;
      bins = new Uint8Array(next?.frequencyBinCount || 0);
      levels = Array<number>(7).fill(0);
    }
    if (!active || !analyser || document.hidden) {
      stop();
      return;
    }
    live = true;
    if (frame === null) frame = window.requestAnimationFrame(sample);
  }

  function sample(timestamp: number) {
    frame = null;
    if (!mounted || !$audioAnalysis.active || !analyser || document.hidden) {
      stop();
      return;
    }
    // The bars contain measured frequency energy only; silence settles to dots.
    // A lower refresh rate keeps the information available with reduced motion.
    if (timestamp - lastSample >= (reducedMotion ? 125 : 32)) {
      const measured = readSpectrumLevels(analyser, bins);
      levels = measured.map((level, index) => {
        const previous = levels[index] || 0;
        return previous + (level - previous) * (level > previous ? 0.75 : 0.4);
      });
      lastSample = timestamp;
    }
    frame = window.requestAnimationFrame(sample);
  }

  onMount(() => {
    mounted = true;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { reducedMotion = preference.matches; };
    const visibilityChanged = () => update($audioAnalysis.analyser, $audioAnalysis.active);
    motionChanged();
    preference.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      mounted = false;
      stop();
      preference.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  });
</script>

<span class="brand-mark" class:live data-testid="brand-mark" data-state={live ? "playing" : "idle"} aria-hidden="true">
  <picture class="original-mark">
    <source media="(prefers-color-scheme: dark)" srcset="/audio-youtube-icon-dark.svg" />
    <img src="/audio-youtube-icon-light.svg" alt="" width="30" height="30" />
  </picture>
  <svg class="live-spectrum" data-testid="logo-spectrum" viewBox="0 0 32 32" fill="currentColor">
    {#each levels as level, index}
      {@const height = 3 + Math.max(0, Math.min(1, level)) * 23}
      <rect x={3.1 + index * 4} y={16 - height / 2} width="1.8" height={height} rx="0.9" />
    {/each}
  </svg>
</span>

<style>
  .brand-mark { position: relative; display: inline-block; width: 30px; height: 30px; flex: 0 0 30px; }
  .original-mark, .live-spectrum { position: absolute; inset: 0; width: 30px; height: 30px; transition: opacity 180ms ease, transform 220ms cubic-bezier(.2, .8, .2, 1); }
  .original-mark { display: block; opacity: 1; transform: scale(1); }
  .original-mark img { display: block; width: 30px; height: 30px; }
  .live-spectrum { opacity: 0; transform: scale(.7); }
  .live .original-mark { opacity: 0; transform: scale(.7); }
  .live .live-spectrum { opacity: 1; transform: scale(1); }
  @media (prefers-reduced-motion: reduce) {
    .original-mark, .live-spectrum { transition: none; transform: none; }
    .live .original-mark, .live .live-spectrum { transform: none; }
  }
</style>
