<script>
  import Player from "$lib/components/Player.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import { videos } from "$lib/store";
</script>

<SearchBar />

{#if $videos}
  {#each $videos as video}
    <Player videoId={video.id} videoTitle={video.title} />
  {/each}
{/if}
