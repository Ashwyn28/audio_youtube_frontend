<script lang="ts">
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import CategoryCarousel from "$lib/components/CategoryCarousel.svelte";
  import Feed from "$lib/components/Feed.svelte";
  import { videoStore } from "$lib/store";
  import { data } from "$lib/data";
  import type { Video } from "$lib/types";

  let searchVideos: Video[];
  let channelVideos: Video[];

  $: searchVideos = $videoStore.search;
  $: channelVideos = $videoStore.channelLatest;
</script>

<CategoryCarousel channels={data.channels} />

{#if searchVideos.length > 0}
  {#each searchVideos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{:else if channelVideos.length > 0}
  {#each channelVideos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{:else}
  <div class="grid md:grid-cols-4 grid-cols-1 gap-2 content-center pt-[5%]">
    <Feed channels={data.FEED_CHANNELS} />
  </div>
{/if}

<SearchBar />
