<script lang="ts">
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import CategorySection from "$lib/components/CategorySection.svelte";
  import CategoryCarousel from "$lib/components/CategoryCarousel.svelte";
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
  <div class="grid grid-cols-4 gap-4 content-center pt-[15%]">
    <div>
      <CategorySection channels={data.TECH_CHANNELS} category="tech" />
    </div>
    <div>
      <CategorySection channels={data.TECH_CHANNELS} category="podcast" />
    </div>
    <div>
      <CategorySection channels={data.TECH_CHANNELS} category="science" />
    </div>
    <div>
      <CategorySection channels={data.TECH_CHANNELS} category="music" />
    </div>
  </div>
{/if}

<SearchBar />
