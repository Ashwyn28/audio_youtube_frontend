<script lang="ts">
  import { onMount } from "svelte";
  import { isYouTubeAPIReady, loadYouTubeAPI } from "$lib/utils/youtube-api";

  export let videoId = "";
  export let videoTitle = "";

  let player: YT.Player;
  let playerElementId =
    "youtube-player-" + Math.random().toString(36).substr(2, 9);
  let playerReady = false;
  let playing = false;
  let updateTimer: number;
  $: currentTime = 0;
  $: duration = 0;
  let durationCheckTimer: number;

  declare global {
    interface Window {
      YT: any;
    }
  }

  onMount(() => {
    loadYouTubeAPI();

    const unsubscribe = isYouTubeAPIReady.subscribe((ready) => {
      if (ready) {
        initializePlayer();
      }
    });

    return () => {
      clearInterval(updateTimer);
      clearInterval(durationCheckTimer);
      if (player) {
        player.destroy();
      }
      unsubscribe();
    };
  });

  function initializePlayer(): void {
    player = new window.YT.Player(playerElementId, {
      videoId: videoId,
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  }

  function onPlayerReady(event: YT.PlayerEvent): void {
    playerReady = true;
  }

  $: if (playerReady && videoId) {
    player.cueVideoById(videoId);
    currentTime = 0;
    duration = 0;
    startDurationCheck();
  }

  function onPlayerStateChange(event: YT.OnStateChangeEvent): void {
    if (event.data === window.YT.PlayerState.PLAYING) {
      clearInterval(updateTimer);
      updateTimer = setInterval(updateProgress, 1000);
      playing = true;
    } else {
      clearInterval(updateTimer);
      playing = false;
    }
  }

  function updateProgress(): void {
    if (!player) return;
    currentTime = player.getCurrentTime();
  }

  function formatTime(time: number): string {
    const rounded = Math.round(time);
    const minutes = Math.floor(rounded / 60);
    const seconds = rounded % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  function togglePlayPause(): void {
    if (!player || !playerReady) return;
    if (playing) {
      player.pauseVideo();
      playing = false;
    } else {
      player.playVideo();
      playing = true;
    }
  }

  function handleSeekTo(event: any): void {
    if (!player || !playerReady) return;
    const progressBar = event.target;
    const newTime = (event.offsetX / progressBar.offsetWidth) * duration;
    player.seekTo(newTime, true);
  }

  function startDurationCheck(): void {
    clearInterval(durationCheckTimer);
    durationCheckTimer = setInterval(() => {
      const newDuration = player.getDuration();
      if (newDuration && newDuration > 0) {
        duration = newDuration;
        clearInterval(durationCheckTimer);
      }
    }, 500);
  }
</script>

<div class="pb-4">
  <div class="video-container hidden">
    <div id={playerElementId}></div>
  </div>
  <div class="flex">
    <div class="flex-1">
      <button class="btn btn-sm btn-neutral" on:click={togglePlayPause}>
        {playing ? "Pause" : "Play"}
      </button>
    </div>
    <div class="ml-1 flex-none content-center" id="time-display">
      {formatTime(currentTime)} / {formatTime(duration)}
    </div>
  </div>
  <progress
    class="progress w-full"
    on:click={handleSeekTo}
    value={duration > 0 ? (currentTime / duration) * 100 : 0}
    max="100"
  ></progress>
  <p>{videoTitle}</p>
</div>

<style>
  iframe,
  .video-container > div {
    width: 100%;
    height: 100%;
  }

  .play-pause-btn {
    background-color: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
  }
</style>
