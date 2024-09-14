<script>
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import CategorySection from "$lib/components/CategorySection.svelte";
  import CategoryCarousel from "$lib/components/CategoryCarousel.svelte";
  import { videoStore } from "$lib/store";

  // @ts-ignore
  $: searchVideos = $videoStore.search;


  const TECH_CHANNELS = [
    "UCBJycsmduvYEL83R_U4JriQ",
    "UCEcrRXW3oEYfUctetZTAWLw",
  ];

  const categories = [
    "test 1",
    "test 2",
  ]
</script>

<CategoryCarousel {categories} />

{#if searchVideos.length > 0}
  {#each searchVideos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{:else}
  <div class="grid grid-cols-4 gap-4 content-center pt-[15%]">
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
