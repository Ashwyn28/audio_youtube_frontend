<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Video } from "$lib/types";
  import { videoStore, playbackStatus } from "$lib/store";
  export let videos: Video[] = [];
  const dispatch = createEventDispatcher<{ channel: void }>();
  function time(value: number) {
    const seconds = Math.max(0, Math.floor(value || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function date(value: string) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function toggle(video: Video) {
    if ($playbackStatus.id === video.id && $playbackStatus.error) videoStore.retryPlayback();
    else if ($videoStore.queue[$videoStore.currentIndex]?.id === video.id) videoStore.setPlaying(!$videoStore.playing);
    else videoStore.play(video);
  }
  function seek(video: Video, event: Event) {
    const position = Number((event.currentTarget as HTMLInputElement).value);
    if ($videoStore.queue[$videoStore.currentIndex]?.id !== video.id) videoStore.play(video);
    videoStore.requestSeek(position);
  }
</script>

<div class="video-list">
  {#each videos as video (video.id)}
    {@const history = $videoStore.history.find((entry) => entry.video.id === video.id)}
    {@const selected = $videoStore.queue[$videoStore.currentIndex]?.id === video.id}
    {@const live = $playbackStatus.id === video.id ? $playbackStatus : null}
    {@const duration = live?.duration || history?.duration || video.duration || 0}
    {@const position = live ? live.position : history?.position || 0}
    <article class="video-card" class:current={selected}>
      <div class="card-controls">
        <button class="btn btn-sm btn-neutral card-play" on:click={() => toggle(video)} aria-label={`${selected && $videoStore.playing ? "Pause" : position > 0 && !history?.completed ? "Resume" : "Play"} ${video.title}`}>{selected && $videoStore.playing ? "Pause" : position > 0 && !history?.completed ? "Resume" : "Play"}</button>
        <span class="card-time" aria-label={`${time(position)} elapsed${duration ? ` of ${time(duration)}` : ""}`}>{time(position)} / {duration ? time(duration) : "—:—"}</span>
      </div>
      <input class="card-progress" type="range" min="0" max={duration || 1} step="1" value={position}
        style={`--progress: ${duration ? Math.min(100, position / duration * 100) : 0}%`}
        on:input={(event) => seek(video, event)} disabled={!duration}
        aria-label={`Playback position for ${video.title}`} />
      <button class="video-title" title={video.title} on:click={() => toggle(video)}>{video.title}</button>
      {#if live?.error}<p class="card-error" role="alert">{live.error} <button class="text-button" on:click={() => videoStore.retryPlayback()}>Retry playback</button></p>
      {:else if live?.buffering}<p class="muted" role="status">Loading audio…</p>{/if}
      <div class="card-meta">
        {#if history?.completed}<span class="finished-label">Finished</span>{/if}
        <details class="item-menu">
          <summary aria-label={`Actions for ${video.title}`}>•••</summary>
          <div class="item-actions">
            {#if video.channelId}<button class="channel-link" on:click={() => { dispatch("channel"); void videoStore.showChannel({ id: video.channelId, name: video.channelTitle || "Channel" }); }}>{video.channelTitle || "Channel"}</button>{/if}
            <span class="video-date">{date(video.timestamp)}</span>
            <button on:click={() => videoStore.playNext(video)}>Play next</button>
            <button disabled={$videoStore.queue.some((item) => item.id === video.id)} on:click={() => videoStore.enqueue(video)}>{$videoStore.queue.some((item) => item.id === video.id) ? "In queue" : "Add to queue"}</button>
            <button on:click={() => videoStore.toggleSaved(video)}>{$videoStore.saved.some((item) => item.id === video.id) ? "Remove from saved" : "Save for later"}</button>
            <button on:click={() => videoStore.restart(video)}>Play from start</button>
            <button on:click={() => videoStore.markFinished(video)}>Mark finished</button>
            <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`} target="_blank" rel="noreferrer">Open on YouTube ↗</a>
          </div>
        </details>
      </div>
    </article>
  {/each}
</div>
