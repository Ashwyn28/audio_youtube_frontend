<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      .video-container {
        position: relative;
        width: 560px;
        height: 315px;
      }

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
      bottom: 0;
      left: 0;
      background-color: red;
      height: 5px;
      width: 0%;
    }
    </style>
  </head>
  <body>
    <div>
      <iframe
        id="youtube-video"
        src="https://www.youtube.com/embed/qf7ws2DF-zk?controls=0&enablejsapi=1"
        style="display: none;"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
    <div class="flex">
      <div class="flex-none">
        <button class="play-pause-btn" onclick="togglePlayPause()">Play</button>
      </div>
      <div class="ml-1 flex-1" id="time-display">00:00 / 00:00</div>
    </div>
    <div id="progress-bar"></div>

    <script>
      let player;
      let playing = false;
      let updateTimer;

      function onYouTubeIframeAPIReady() {
        player = new YT.Player("youtube-video", {
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
          },
        });
      }

      function onPlayerReady(event) {
        updateProgress();
      }

      function onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING) {
          updateTimer = setInterval(updateProgress, 1000); // Update every second
        } else {
          clearInterval(updateTimer);
        }
      }

      function updateProgress() {
        if (!player) return;
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        const percentage = (currentTime / duration) * 100;
        document.getElementById("progress-bar").style.width = `${percentage}%`;
        document.getElementById("time-display").textContent =
          `${formatTime(currentTime)} / ${formatTime(duration)}`;
      }

      function formatTime(time) {
        const rounded = Math.round(time);
        const minutes = Math.floor(rounded / 60);
        const seconds = rounded % 60;
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
      }

      function togglePlayPause() {
        if (!player) return;
        if (playing) {
          player.pauseVideo();
          document.querySelector(".play-pause-btn").textContent = "Play";
        } else {
          player.playVideo();
          document.querySelector(".play-pause-btn").textContent = "Pause";
        }
        playing = !playing;
      }

      // Load the IFrame Player API code asynchronously.
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    </script>
  </body>
</html>
