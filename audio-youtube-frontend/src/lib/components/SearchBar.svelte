<script>
  import { search } from "$lib/api/search";
  import { onMount } from "svelte";
  import { videos } from "$lib/store";

  let searchQuery = "";

  const handleSearch = async () => {
    if (searchQuery) {
      const res = await search(searchQuery);
      if (res) {
        videos.set(res);
      }
    }
  };

  onMount(async () => {
    await handleSearch();
  });
</script>

<div class="flex pb-8">
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
