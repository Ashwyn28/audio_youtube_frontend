<script>
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import { videoStore } from "$lib/store";

  $: searchVideos = $videoStore.tech;
</script>

<SearchBar />

{#if searchVideos}
  {#each searchVideos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{/if}
