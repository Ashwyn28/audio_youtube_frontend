<script lang="ts">
  // Fallback player used when the API has audio streaming turned off.
  // Plays through a hidden YouTube embed and keeps the same store contract
  // as AudioPlayback, so the cards, queue and settings work unchanged.
  import { onMount } from "svelte";
  import { videoStore, playbackStatus } from "$lib/store";
  import { loadYouTubeAPI } from "$lib/utils/youtube-api";

  const PLAYING = 1, PAUSED = 2, BUFFERING = 3, ENDED = 0, CUED = 5;

  let host: HTMLDivElement;
  let player: YouTubePlayer | null = null;
  let ready = false;
  let mounted = false;
  let loadedId = "";
  let activeSeekVersion = 0;
  let activeRetryVersion = 0;
  let position = 0;
  let duration = 0;
  let error = "";
  let buffering = false;
  let lastSavedAt = 0;
  let resumePosition = 0;
  let commandedPlaying = false;

  $: current = $videoStore.queue[$videoStore.currentIndex];
  $: if (ready) sync(current?.id || "", $videoStore.playing);
  $: if (ready && player) player.setPlaybackRate($videoStore.playbackRate);
  $: if (ready && activeSeekVersion !== $videoStore.seekVersion) {
    activeSeekVersion = $videoStore.seekVersion;
    seekTo($videoStore.seekPosition);
  }
  $: if (ready && activeRetryVersion !== $videoStore.retryVersion) {
    activeRetryVersion = $videoStore.retryVersion;
    retry();
  }
  $: if (mounted) updateMedia(current, $videoStore.playing);
  $: playbackStatus.set({ id: loadedId, position, duration, buffering, error });

  function sync(id: string, playing: boolean) {
    if (!player) return;
    if (loadedId !== id) {
      saveProgress();
      loadedId = id;
      error = "";
      position = 0;
      duration = 0;
      if (!id) { player.pauseVideo(); buffering = false; return; }
      const history = $videoStore.history.find(h => h.video.id === id);
      resumePosition = history && !history.completed ? history.position : 0;
      buffering = true;
      commandedPlaying = playing;
      if (playing) player.loadVideoById(id);
      else player.cueVideoById(id);
      return;
    }
    // Only act on play/pause commands, not on unrelated store updates.
    if (!id || commandedPlaying === playing) return;
    commandedPlaying = playing;
    if (playing) player.playVideo();
    else player.pauseVideo();
  }
  function stateChange(state: number) {
    if (!player) return;
    if (state === PLAYING) {
      buffering = false;
      error = "";
      duration = player.getDuration() || duration;
      if (resumePosition && duration) {
        player.seekTo(Math.min(resumePosition, Math.max(0, duration - 1)), true);
        resumePosition = 0;
      }
      commandedPlaying = true;
      if (!$videoStore.playing) videoStore.setPlaying(true);
    } else if (state === BUFFERING) buffering = true;
    else if (state === PAUSED) {
      buffering = false;
      saveProgress();
      commandedPlaying = false;
      if ($videoStore.playing) videoStore.setPlaying(false);
    } else if (state === CUED) buffering = false;
    else if (state === ENDED) {
      saveProgress();
      videoStore.ended();
    }
  }
  function failed() {
    buffering = false;
    error = navigator.onLine
      ? "This video can't be played here. Retry, skip to the next item, or open it on YouTube."
      : "You are offline. Reconnect, then retry playback.";
    videoStore.setPlaying(false);
  }
  function retry() {
    if (!player || !loadedId) return;
    error = "";
    resumePosition = position;
    commandedPlaying = true;
    player.loadVideoById(loadedId);
  }
  function saveProgress() {
    if (loadedId && duration > 0) videoStore.updateProgress(loadedId, position, duration);
  }
  function tick() {
    if (!player || !ready || !loadedId) return;
    position = player.getCurrentTime() || 0;
    duration = player.getDuration() || duration;
    if (Date.now() - lastSavedAt >= 5000) { saveProgress(); lastSavedAt = Date.now(); }
    updatePosition();
    videoStore.checkSleepTimer();
  }
  function seekTo(value: number) {
    if (!player || !Number.isFinite(value)) return;
    position = Math.max(0, Math.min(value, duration || value));
    player.seekTo(position, true);
    saveProgress();
    updatePosition();
  }
  function updateMedia(video: typeof current, playing: boolean) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = video ? (playing ? "playing" : "paused") : "none";
      if (!video) navigator.mediaSession.metadata = null;
      else if (navigator.mediaSession.metadata?.title !== video.title) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: video.title, artist: video.channelTitle,
          album: "AudioTube", artwork: video.thumbnail ? [{ src: video.thumbnail }] : [] });
      }
    } catch { /* Device media controls are optional. */ }
  }
  function updatePosition() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState || !duration) return;
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: $videoStore.playbackRate,
      position: Math.min(position, duration) }); } catch { /* Not available on every browser. */ }
  }
  onMount(() => {
    mounted = true;
    const target = document.createElement("div");
    host.appendChild(target);
    loadYouTubeAPI().then(() => {
      if (!mounted || !window.YT) return;
      player = new window.YT.Player(target, {
        width: "200", height: "200",
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady() { ready = true; },
          onStateChange(event) { stateChange(event.data); },
          onError() { failed(); },
          onAutoplayBlocked() {
            error = "Press Play to start listening. Your browser needs a tap before playing audio.";
            videoStore.setPlaying(false);
          },
        },
      });
    }).catch(cause => { error = cause instanceof Error ? cause.message : "The YouTube player could not load."; });

    const actions: MediaSessionAction[] = [];
    function action(name: MediaSessionAction, handler: MediaSessionActionHandler) {
      if (!("mediaSession" in navigator)) return;
      try { navigator.mediaSession.setActionHandler(name, handler); actions.push(name); } catch { /* Unsupported action. */ }
    }
    action("play", () => videoStore.setPlaying(true));
    action("pause", () => videoStore.setPlaying(false));
    action("previoustrack", () => videoStore.previous());
    action("nexttrack", () => videoStore.next());
    action("seekbackward", detail => seekTo(position - (detail.seekOffset || 15)));
    action("seekforward", detail => seekTo(position + (detail.seekOffset || 30)));
    action("seekto", detail => { if (detail.seekTime !== undefined) seekTo(detail.seekTime); });
    const timer = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", saveProgress);
    window.addEventListener("pagehide", saveProgress);
    return () => {
      saveProgress(); mounted = false; ready = false;
      player?.destroy(); player = null;
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

<div class="youtube-host" bind:this={host} aria-hidden="true"></div>

<style>
  /* Kept rendered (not display:none) so browsers allow playback. */
  .youtube-host { position: fixed; width: 1px; height: 1px; left: -9999px; top: 0; overflow: hidden; pointer-events: none; }
</style>
