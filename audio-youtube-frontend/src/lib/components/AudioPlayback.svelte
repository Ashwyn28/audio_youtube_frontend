<script lang="ts">
  import { onMount } from "svelte";
  import { videoStore, playbackStatus } from "$lib/store";
  import { audioUrl } from "$lib/services/search";
  import { connectAudioAnalysis, type AudioAnalysisConnection } from "$lib/audio-analysis";

  let audio: HTMLAudioElement;
  let analysis: AudioAnalysisConnection | null = null;
  let mounted = false;
  let loadedId = "";
  let activeSeekVersion = 0;
  let activeRetryVersion = 0;
  let position = 0;
  let duration = 0;
  let error = "";
  let buffering = false;
  let lastSavedAt = 0;
  let playAttempt = 0;
  let pendingPlayId = "";
  let commandedPlaying = false;
  let resumePosition = 0;
  $: current = $videoStore.queue[$videoStore.currentIndex];
  $: if (mounted) sync(current?.id || "", $videoStore.playing);
  $: if (mounted && audio) audio.playbackRate = $videoStore.playbackRate;
  $: if (mounted && audio && activeSeekVersion !== $videoStore.seekVersion) {
    activeSeekVersion = $videoStore.seekVersion;
    if (audio.readyState >= 1) seekTo($videoStore.seekPosition);
    else resumePosition = $videoStore.seekPosition;
  }
  $: if (mounted) updateMedia(current, $videoStore.playing);
  $: if (mounted && audio && activeRetryVersion !== $videoStore.retryVersion) {
    activeRetryVersion = $videoStore.retryVersion;
    retry();
  }
  $: playbackStatus.set({ id: loadedId, position, duration, buffering, error });

  function sync(id: string, playing: boolean) {
    if (!audio) return;
    const changedSource = loadedId !== id;
    if (changedSource) {
      analysis?.setActive(false);
      saveProgress();
      playAttempt++;
      pendingPlayId = "";
      loadedId = id;
      error = "";
      position = 0;
      duration = 0;
      buffering = Boolean(id);
      if (!id) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        return;
      }
      const history = $videoStore.history.find(h => h.video.id === id);
      resumePosition = history && !history.completed ? history.position : 0;
      audio.src = audioUrl(id);
      audio.load();
    }
    // Store updates from time/progress must not restart an ended element before
    // its ended event advances the queue. Only commands or source changes play.
    if (changedSource || commandedPlaying !== playing) {
      commandedPlaying = playing;
      if (playing && !error) void startPlayback();
      else if (!playing) {
        analysis?.setActive(false);
        playAttempt++;
        pendingPlayId = "";
        audio.pause();
      }
    }
  }
  async function startPlayback() {
    if (pendingPlayId === loadedId) return;
    const attempt = ++playAttempt;
    pendingPlayId = loadedId;
    try {
      // Start/resume analysis alongside play; never await it before native play,
      // because browsers require the original user activation for both calls.
      void analysis?.resume();
      await audio.play();
    } catch (cause) {
      if (attempt !== playAttempt || !mounted) return;
      analysis?.setActive(false);
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      error = cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Press Play to start listening. Your browser needs a tap before playing audio."
        : "Audio could not start. Check your connection and try again.";
      videoStore.setPlaying(false);
    } finally {
      if (attempt === playAttempt) pendingPlayId = "";
    }
  }
  function loaded() {
    duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.playbackRate = $videoStore.playbackRate;
    if (resumePosition && duration) seekTo(Math.min(resumePosition, Math.max(0, duration - 1)));
    resumePosition = 0;
    buffering = false;
  }
  function saveProgress() {
    if (loadedId && audio && duration > 0) videoStore.updateProgress(loadedId, audio.currentTime, duration);
  }
  function tick() {
    if (!audio) return;
    position = audio.currentTime || 0;
    duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (Date.now() - lastSavedAt >= 5000) {
      saveProgress();
      lastSavedAt = Date.now();
    }
    updatePosition();
    videoStore.checkSleepTimer();
  }
  function seekTo(value: number) {
    if (!audio || !Number.isFinite(value)) return;
    position = Math.max(0, Math.min(value, duration || value));
    try { audio.currentTime = position; } catch { resumePosition = position; }
    saveProgress();
    updatePosition();
  }
  function ended() {
    analysis?.setActive(false);
    saveProgress();
    videoStore.ended();
  }
  function paused() {
    if (audio.paused || audio.ended) analysis?.setActive(false);
    saveProgress();
    // A pause triggered by loading a different source must not cancel its play request.
    if (audio.ended || !audio.paused || pendingPlayId || audio.readyState === 0 || audio.currentSrc !== audio.src) return;
    if ($videoStore.playing) videoStore.setPlaying(false);
  }
  function failed() {
    analysis?.setActive(false);
    if (!loadedId) return;
    buffering = false;
    error = navigator.onLine
      ? "This audio is unavailable. Retry, skip to the next item, or open it on YouTube."
      : "You are offline. Reconnect, then retry playback.";
    videoStore.setPlaying(false);
  }
  function retry() {
    error = "";
    resumePosition = position;
    audio.load();
    videoStore.setPlaying(true);
    void startPlayback();
  }
  function updateMedia(video: typeof current, playing: boolean) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = video ? (playing ? "playing" : "paused") : "none";
      if (!video) navigator.mediaSession.metadata = null;
      else if (navigator.mediaSession.metadata?.title !== video.title || navigator.mediaSession.metadata?.artist !== video.channelTitle) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: video.title, artist: video.channelTitle,
          album: "AudioTube", artwork: video.thumbnail ? [{ src: video.thumbnail }] : [] });
      }
    } catch { /* Device media controls are optional. */ }
  }
  function updatePosition() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState || !duration) return;
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: audio.playbackRate,
      position: Math.min(position, duration) }); } catch { /* Not available on every browser. */ }
  }
  onMount(() => {
    // Set before any src/load operation so the analyser receives permitted data.
    audio.crossOrigin = "anonymous";
    analysis = connectAudioAnalysis(audio);
    mounted = true;
    const actions: MediaSessionAction[] = [];
    function action(name: MediaSessionAction, handler: MediaSessionActionHandler) {
      if (!("mediaSession" in navigator)) return;
      try { navigator.mediaSession.setActionHandler(name, handler); actions.push(name); } catch { /* Unsupported action. */ }
    }
    action("play", () => { error = ""; videoStore.setPlaying(true); });
    action("pause", () => videoStore.setPlaying(false));
    action("stop", () => { videoStore.setPlaying(false); seekTo(0); });
    action("previoustrack", () => videoStore.previous());
    action("nexttrack", () => videoStore.next());
    action("seekbackward", detail => seekTo(position - (detail.seekOffset || 15)));
    action("seekforward", detail => seekTo(position + (detail.seekOffset || 30)));
    action("seekto", detail => { if (detail.seekTime !== undefined) seekTo(detail.seekTime); });
    const timer = window.setInterval(() => videoStore.checkSleepTimer(), 1000);
    document.addEventListener("visibilitychange", saveProgress);
    window.addEventListener("pagehide", saveProgress);
    return () => {
      saveProgress(); mounted = false; playAttempt++; audio.pause();
      analysis?.destroy(); analysis = null;
      playbackStatus.set({ id: "", position: 0, duration: 0, buffering: false, error: "" });
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", saveProgress);
      window.removeEventListener("pagehide", saveProgress);
      if ("mediaSession" in navigator) {
        for (const name of actions) navigator.mediaSession.setActionHandler(name, null);
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    };
  });
</script>

<audio bind:this={audio} crossorigin="anonymous" preload="metadata" on:loadedmetadata={loaded}
  on:timeupdate={tick} on:ended={ended} on:error={failed} on:pause={paused}
  on:playing={() => { buffering = false; error = ""; analysis?.setActive($videoStore.playing && !audio.paused); if (!$videoStore.playing) audio.pause(); }}
  on:waiting={() => { buffering = true; analysis?.setActive(false); }} on:canplay={() => buffering = false} />

