<script>
  import Player from "$lib/components/Player.svelte";
  import { search } from "$lib/api/search";
  import { onMount } from "svelte";

  $: videoIds = [];
  let searchQuery = "";

  const handleSearch = async () => {
    if (searchQuery) {
      const res = await search(searchQuery);
      if (res) {
        videoIds = res.videos;
      }
    }
  };

  onMount(async () => {
    await handleSearch();
  });
</script>

<div class="flex">
  <label class="flex-1 input input-bordered flex items-center gap-2">
    <input
      type="text"
      class="grow"
      placeholder="Search"
      bind:value={searchQuery}
    />
    <kbd class="kbd kbd-sm">⌘</kbd>
    <kbd class="kbd kbd-sm">K</kbd>
  </label>
  <button on:click={handleSearch} class="btn btn-neutral">Search</button>
</div>

{#if videoIds}
  {#each videoIds as videoId}
    <Player {videoId} />
  {/each}
{/if}
