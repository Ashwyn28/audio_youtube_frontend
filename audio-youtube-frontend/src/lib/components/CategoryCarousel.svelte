<script lang="ts">
  import { videoStore } from "$lib/store";
  export let categories: string[] = [];

  const handleSelect = (category: string) => {
    console.log(category)
    videoStore.searchChannel(category) 
  }
</script>

<div class="overscroll-x overflow-x-auto py-8">
  <div class="flex space-x-2">
    {#each categories as category}
      <button on:click={() => handleSelect(category)} class="btn btn-sm btn-outline">{category}</button>
    {/each}
  </div>
</div>
