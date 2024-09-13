<script>
  import { onMount } from "svelte";
  import { videoStore } from "$lib/store";

  let searchQuery = "";

  const handleSearch = async () => {
    if (searchQuery) {
      await videoStore.searchVideos(searchQuery);
    }
  };

  onMount(async () => {
    await handleSearch();
  });
</script>

<div class="absolute bottom-0 text-center left-1/2 transform -translate-x-1/2 flex pb-8 w-[80%]">
  <label class="flex-1 input input-bordered flex items-center gap-2 mr-2">
    <input
      type="text"
      class="grow"
      placeholder="Search"
      bind:value={searchQuery}
    />
  </label>
  <button on:click={handleSearch} class="btn btn-neutral">Search</button>
</div>
