<script>
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import CategorySection from "$lib/components/CategorySection.svelte";
  import { videoStore } from "$lib/store";

  // @ts-ignore
  $: searchVideos = $videoStore.search;

  const TECH_CHANNELS = [
    'UCBJycsmduvYEL83R_U4JriQ',
    'UCEcrRXW3oEYfUctetZTAWLw'
  ]
</script>

<CategorySection channels={TECH_CHANNELS} category="tech" />

{#if searchVideos}
  {#each searchVideos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{/if}

<SearchBar />
