<script>
  import Player from "$lib/components/Player.svelte";
  import { search } from "$lib/api/search";
  import { onMount } from "svelte";

  $: videoIds = [];

  const handleSearch = async (q) => {
    const res = await search("mkbhd");
    if (res) {
      videoIds = res.videos;
    }
  };

  onMount(async () => {
    await handleSearch();
  });
</script>

<label class="input input-bordered flex items-center gap-2">
  <input type="text" class="grow" placeholder="Search" />
  <kbd class="kbd kbd-sm">⌘</kbd>
  <kbd class="kbd kbd-sm">K</kbd>
</label>

{#if videoIds}
  {#each videoIds as videoId}
    <Player {videoId} />
  {/each}
{/if}
