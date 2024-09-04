<script>
    import { onMount } from 'svelte';
  
    export let videoId = '';
    export let videoTitle = '';
    let player;
    let playing = false;
    let updateTimer;
    let currentTime = 0;
    let duration = 0;
  
    onMount(() => {
      loadYouTubeAPI();
    });
  
    function loadYouTubeAPI() {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
  
      if (firstScriptTag) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.body.appendChild(tag);
      }
  
      window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('youtube-video', {
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
          },
        });
      };
    }
  
    function onPlayerReady(event) {
      updateProgress();
    }
  
    function onPlayerStateChange(event) {
      if (event.data == YT.PlayerState.PLAYING) {
        updateTimer = setInterval(updateProgress, 1000);
      } else {
        clearInterval(updateTimer);
      }
    }
  
    function updateProgress() {
      if (!player) return;
      currentTime = player.getCurrentTime();
      duration = player.getDuration();
    }
  
    function formatTime(time) {
      const rounded = Math.round(time);
      const minutes = Math.floor(rounded / 60);
      const seconds = rounded % 60;
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  
    function togglePlayPause() {
      if (!player) return;
      if (playing) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
      playing = !playing;
    }
  </script>
  
  <style>
    iframe {
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
  
    #progress-bar {
      position: absolute;
      background-color: red;
      height: 5px;
      width: 0%;
    }
  </style>
  
  <div class="pb-4">
    <div class="video-container">
      <iframe
        id="youtube-video"
        src="https://www.youtube.com/embed/{videoId}?controls=0&enablejsapi=1"
        style="display: none;"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
    <div class="flex">
      <div class="flex-1">
        <button class="btn btn-neutral" on:click={togglePlayPause}>
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <div class="ml-1 flex-none content-center" id="time-display">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
    <progress class="progress w-full" value={duration > 0 ? (currentTime / duration) * 100 : '0'} max="100"></progress>
    <p>{videoTitle}</p>
    <!-- <div
      id="progress-bar"
      style="width: {duration > 0 ? (currentTime / duration) * 100 + '%' : '0%'}"
    ></div> -->
  </div>
  