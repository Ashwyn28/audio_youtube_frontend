<script lang="ts">
  import { onMount } from "svelte";
  import { videoStore, playbackStatus } from "$lib/store";
  import { searchChannels, resolveLink } from "$lib/services/search";
  import type { Channel } from "$lib/types";
  import AudioPlayback from "$lib/components/AudioPlayback.svelte";
  import VideoList from "$lib/components/VideoList.svelte";
  import BrandMark from "$lib/components/BrandMark.svelte";

  type Panel = "" | "channels" | "queue" | "saved" | "history" | "settings";
  let panel: Panel = "";
  let query = "";
  let channelQuery = "";
  let channelResults: Channel[] = [];
  let channelLoading = false;
  let channelsSearched = false;
  let resolving = false;
  let notice = "";
  let localError = "";
  let channelController: AbortController | null = null;
  let importInput: HTMLInputElement;
  let sleepChoice = "off";
  $: current = $videoStore.queue[$videoStore.currentIndex];
  $: upcoming = $videoStore.queue.slice($videoStore.currentIndex + 1);
  $: historyVideos = [...$videoStore.history].sort((a, b) => b.updatedAt - a.updatedAt).map((entry) => entry.video);
  $: visibleVideos = panel === "saved" ? $videoStore.saved : panel === "history" ? historyVideos : panel ? [] : $videoStore.videos;
  $: if (!$videoStore.sleepUntil && !$videoStore.sleepAfterEpisode) sleepChoice = "off";

  function sleepChanged() {
    videoStore.setSleepTimer(sleepChoice === "off" ? null : sleepChoice === "episode" ? "episode" : Number(sleepChoice));
  }

  onMount(() => {
    videoStore.hydrate();
    void videoStore.showFeed();
    return () => channelController?.abort();
  });

  function togglePanel(next: Panel) {
    panel = panel === next ? "" : next;
    localError = "";
    notice = "";
  }
  async function submitSearch() {
    if (resolving) return;
    localError = "";
    notice = "";
    const value = query.trim();
    if (!value) { await videoStore.showFeed(); return; }
    panel = "";
    if (/^https?:\/\//i.test(value)) {
      resolving = true;
      try {
        const result = await resolveLink(value);
        if (result.type === "channel" && result.channel) await videoStore.showChannel(result.channel);
        else if (result.type === "video" && result.video) videoStore.showVideo(result.video);
        else throw new Error("This link did not return a playable video or channel.");
      } catch (error) { localError = error instanceof Error ? error.message : "Could not open this link."; }
      finally { resolving = false; }
    } else if (value.length > 200) localError = "Keep your search to 200 characters or fewer.";
    else await videoStore.search(value);
  }
  async function findChannels() {
    channelController?.abort();
    channelController = new AbortController();
    const signal = channelController.signal;
    if (!channelQuery.trim()) { channelResults = []; return; }
    channelLoading = true;
    channelsSearched = false;
    channelResults = [];
    localError = "";
    try {
      const results = await searchChannels(channelQuery.trim(), signal);
      if (!signal.aborted) { channelResults = results; channelsSearched = true; }
    } catch (error) { if (!signal.aborted) localError = error instanceof Error ? error.message : "Could not find channels."; }
    finally { if (!signal.aborted) channelLoading = false; }
  }
  function saveChannel(channel: Channel) {
    try { videoStore.addSavedChannel(channel); notice = `${channel.name} saved.`; }
    catch (error) { localError = error instanceof Error ? error.message : "Could not save channel."; }
  }
  function exportLibrary() {
    const blob = new Blob([videoStore.exportLibrary()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audiotube-library.json";
    link.click();
    URL.revokeObjectURL(url);
    notice = "Library exported.";
  }
  async function importLibrary(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    localError = "";
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose a library file smaller than 5 MB.");
      videoStore.importLibrary(await file.text());
      notice = "Library imported. Playback is paused.";
      await videoStore.showFeed();
    } catch (error) { localError = error instanceof Error ? error.message : "Could not import this library."; }
    finally { input.value = ""; }
  }
  function clearData() {
    if (!window.confirm("Clear your saved channels, queue, saved items, history, and preferences on this device?")) return;
    videoStore.clearPersonalData();
    notice = "Your data has been cleared on this device.";
    void videoStore.showFeed();
  }
</script>

<svelte:head>
  <title>AudioTube</title>
  <meta name="description" content="Your channels, your queue, your next listen." />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to content</a>
<div class="app-shell">
  <header class="app-header">
    <a href="/" class="brand" on:click|preventDefault={() => { panel = ""; query = ""; void videoStore.showFeed(); }} aria-label="AudioTube home">
      <BrandMark />
      <span>AudioTube</span>
    </a>
    <nav class="utility-nav" aria-label="Your library">
      <button class:active={panel === "queue"} aria-expanded={panel === "queue"} on:click={() => togglePanel("queue")}>Queue{upcoming.length ? ` (${upcoming.length})` : ""}</button>
      <button class:active={panel === "saved"} aria-expanded={panel === "saved"} on:click={() => togglePanel("saved")}>Saved</button>
      <button class:active={panel === "history"} aria-expanded={panel === "history"} on:click={() => togglePanel("history")}>History</button>
      <button class:active={panel === "settings"} aria-expanded={panel === "settings"} on:click={() => togglePanel("settings")}>Settings</button>
    </nav>
  </header>

  <main id="main-content" class="workspace">
    <nav class="channel-nav" aria-label="Saved channels">
      <button class="btn btn-sm btn-outline channel-pill add-channel" aria-label="Add or manage channels" aria-expanded={panel === "channels"} on:click={() => togglePanel("channels")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
      {#each $videoStore.channels as channel (channel.id)}
        <button class="btn btn-sm btn-outline channel-pill" class:active={!panel && $videoStore.view === "channel" && $videoStore.selectedChannel?.id === channel.id} on:click={() => { panel = ""; void videoStore.showChannel(channel); }}>{channel.name}</button>
      {/each}
      {#if $videoStore.view !== "feed" || panel}
        <button class="text-button all-channels" on:click={() => { panel = ""; query = ""; void videoStore.showFeed(); }}>All channels</button>
      {/if}
    </nav>

    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
    {#if $videoStore.storageMessage}<p class="notice" role="status">{$videoStore.storageMessage}</p>{/if}
    {#if localError}<p class="error-box" role="alert">{localError}</p>{/if}

    {#if panel === "channels"}
      <section class="library-panel" aria-labelledby="channels-heading">
        <div class="panel-heading"><h1 id="channels-heading">Your channels</h1><span class="muted">{$videoStore.channels.length}/30</span></div>
        <form class="channel-form" on:submit|preventDefault={findChannels}>
          <label for="channel-search">Find a channel to add</label>
          <div class="input-action"><input id="channel-search" bind:value={channelQuery} maxlength="200" placeholder="Channel name" required /><button class="primary-button" disabled={channelLoading || !channelQuery.trim()}>{channelLoading ? "Searching…" : "Find channels"}</button></div>
        </form>
        {#if channelResults.length}<ul class="plain-list channel-results">{#each channelResults as channel (channel.id)}<li><span>{channel.name}</span><button class="secondary-button" disabled={$videoStore.channels.some((item) => item.id === channel.id)} on:click={() => saveChannel(channel)}>{$videoStore.channels.some((item) => item.id === channel.id) ? "Saved" : "Add channel"}</button></li>{/each}</ul>{/if}
        {#if channelsSearched && !channelResults.length}<p class="muted small" role="status">No channels found. Try another name.</p>{/if}
        <ul class="plain-list saved-channel-list">{#each $videoStore.channels as channel, i (channel.id)}<li><button class="list-title" on:click={() => { panel = ""; void videoStore.showChannel(channel); }}>{channel.name}</button><div class="row-actions"><button aria-label={`Move ${channel.name} earlier`} disabled={i === 0} on:click={() => videoStore.moveChannel(i, i - 1)}>↑</button><button aria-label={`Move ${channel.name} later`} disabled={i === $videoStore.channels.length - 1} on:click={() => videoStore.moveChannel(i, i + 1)}>↓</button><button aria-label={`Remove ${channel.name}`} on:click={() => videoStore.removeChannel(channel.id)}>Remove</button></div></li>{/each}</ul>
        {#if !$videoStore.channels.length}<p class="empty-state">Add your first channel to build a feed.</p>{/if}
      </section>
    {:else if panel === "queue"}
      <section class="library-panel" aria-labelledby="queue-heading">
        <div class="panel-heading"><h1 id="queue-heading">Queue</h1><button class="text-button" disabled={!$videoStore.queue.length} on:click={() => videoStore.clearQueue()}>Clear queue</button></div>
        <label class="preference"><input type="checkbox" checked={$videoStore.autoplay} on:change={(event) => videoStore.setAutoplay(event.currentTarget.checked)} /> Automatically play the next item</label>
        <ol class="plain-list queue-list">{#each $videoStore.queue as video, i}<li class:current={i === $videoStore.currentIndex}><button class="list-title" on:click={() => videoStore.select(i)}>{i === $videoStore.currentIndex ? "Now playing · " : ""}{video.title}<small>{video.channelTitle}</small></button><div class="row-actions"><button aria-label={`Move ${video.title} earlier`} disabled={i <= $videoStore.currentIndex + 1} on:click={() => videoStore.moveQueued(i, i - 1)}>↑</button><button aria-label={`Move ${video.title} later`} disabled={i <= $videoStore.currentIndex || i === $videoStore.queue.length - 1} on:click={() => videoStore.moveQueued(i, i + 1)}>↓</button><button aria-label={`Remove ${video.title} from queue`} disabled={i === $videoStore.currentIndex} on:click={() => videoStore.removeQueued(i)}>Remove</button></div></li>{/each}</ol>
        {#if !$videoStore.queue.length}<p class="empty-state">Your queue is empty. Open an item’s menu to add a listen.</p>{/if}
      </section>
    {:else if panel === "saved"}
      <section aria-labelledby="saved-heading"><div class="panel-heading"><h1 id="saved-heading">Saved for later</h1><span class="muted">{$videoStore.saved.length} items</span></div><VideoList videos={$videoStore.saved} on:channel={() => panel = ""} />{#if !$videoStore.saved.length}<p class="empty-state">Save something from an item’s menu to find it here.</p>{/if}</section>
    {:else if panel === "history"}
      <section aria-labelledby="history-heading"><div class="panel-heading"><h1 id="history-heading">Listening history</h1><button class="text-button" disabled={!historyVideos.length} on:click={() => videoStore.clearHistory()}>Clear history</button></div><VideoList videos={historyVideos} on:channel={() => panel = ""} />{#if !historyVideos.length}<p class="empty-state">Your listening history will appear here.</p>{/if}</section>
    {:else if panel === "settings"}
      <section class="library-panel" aria-labelledby="settings-heading">
        <div class="panel-heading"><h1 id="settings-heading">Settings</h1></div>
        <div class="settings-actions">
          <label>Speed <select aria-label="Playback speed" value={$videoStore.playbackRate} on:change={(event) => videoStore.setPlaybackRate(Number(event.currentTarget.value))}>
            {#each [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as rate}<option value={rate}>{rate}×</option>{/each}
          </select></label>
          <label>Sleep timer <select aria-label="Sleep timer" bind:value={sleepChoice} on:change={sleepChanged}>
            <option value="off">Off</option><option value="15">15 minutes</option><option value="30">30 minutes</option>
            <option value="60">60 minutes</option><option value="episode">End of episode</option>
          </select></label>
        </div>
        {#if $videoStore.sleepUntil}<p class="muted small" role="status">Playback stops at {new Date($videoStore.sleepUntil).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}.</p>{/if}
        <p class="muted small">Your channels, queue, saved items, and progress stay on this device.</p>
        <div class="settings-actions"><button class="secondary-button" on:click={exportLibrary}>Export library</button><button class="secondary-button" on:click={() => importInput.click()}>Import library</button><input class="sr-only" type="file" accept="application/json,.json" bind:this={importInput} on:change={importLibrary} /><button class="text-button danger" on:click={clearData}>Clear personal data</button></div>
        <p class="muted small">Import replaces the library on this device. Export a copy first if you want to keep it.</p>
      </section>
    {:else}
      <section class="feed-section" aria-label={$videoStore.view === "search" ? "Search results" : "Latest uploads"}>
        <div class="feed-toolbar"><h1 class:sr-only={$videoStore.view === "feed"}>{$videoStore.view === "search" ? `Results for “${$videoStore.query}”` : $videoStore.view === "channel" ? $videoStore.selectedChannel?.name : "Latest uploads"}</h1><button class="text-button" disabled={$videoStore.loading} on:click={() => videoStore.refresh()}>Refresh</button>{#if $videoStore.view === "channel" && $videoStore.selectedChannel && !$videoStore.channels.some((item) => item.id === $videoStore.selectedChannel?.id)}<button class="text-button" on:click={() => $videoStore.selectedChannel && saveChannel($videoStore.selectedChannel)}>Save channel</button>{/if}</div>
        {#if $videoStore.error}<div class="error-box" role="alert"><p>{$videoStore.error}</p><button class="text-button" on:click={() => videoStore.retry()}>Try again</button></div>{/if}
        <VideoList videos={$videoStore.videos} on:channel={() => panel = ""} />
        {#if $videoStore.loading}<p class="status-text" role="status">Loading…</p>{:else if !$videoStore.error && !$videoStore.videos.length}<p class="empty-state">{$videoStore.view === "feed" && !$videoStore.channels.length ? "Add a channel with + to get started." : "No results yet. Try another search or refresh."}</p>{/if}
        {#if $videoStore.nextPageToken}<div class="load-more"><button class="secondary-button" disabled={$videoStore.loading} on:click={() => videoStore.loadMore()}>Load more</button></div>{/if}
      </section>
    {/if}

    {#if current && $playbackStatus.error && !visibleVideos.some(video => video.id === current.id)}
      <p class="error-box" role="alert">{current.title}: {$playbackStatus.error} <button class="text-button" on:click={() => videoStore.retryPlayback()}>Retry playback</button></p>
    {/if}
    <AudioPlayback />
  </main>

  <form class="search-form" role="search" on:submit|preventDefault={submitSearch}>
    <label class="sr-only" for="video-search">Search videos or paste a YouTube link</label>
    <input id="video-search" placeholder="Search" bind:value={query} maxlength="2000" />
    {#if query}<button type="button" class="clear-search" aria-label="Clear search and return to feed" on:click={() => { query = ""; panel = ""; void videoStore.showFeed(); }}>×</button>{/if}
    <button class="btn btn-neutral" disabled={resolving}>{resolving ? "Opening…" : "Search"}</button>
  </form>
</div>
