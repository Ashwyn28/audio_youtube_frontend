<script>
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import CategorySection from "$lib/components/CategorySection.svelte";
  import { videoStore } from "$lib/store";

  // @ts-ignore
  $: searchVideos = $videoStore.search;

  $: console.log(searchVideos);

  const TECH_CHANNELS = [
    "UCBJycsmduvYEL83R_U4JriQ",
    "UCEcrRXW3oEYfUctetZTAWLw",
  ];
</script>

{#if searchVideos.length > 0}
  {#each searchVideos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{:else}
  <div class="grid grid-cols-4 gap-4 content-center h-screen px-[10%]">
    <div class="p-2">
      <CategorySection channels={TECH_CHANNELS} category="tech" />
    </div>
    <div class="p-2">
      <CategorySection channels={TECH_CHANNELS} category="podcast" />
    </div>
    <div class="p-2">
      <CategorySection channels={TECH_CHANNELS} category="science" />
    </div>
    <div class="p-2">
      <CategorySection channels={TECH_CHANNELS} category="music" />
    </div>
  </div>
{/if}

<SearchBar />
