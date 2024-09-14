<script lang="ts">
  export let categories: string[] = [];

  const handleSelect = () => {
    
  }
</script>

<div class="overscroll-x overflow-x-auto py-8">
  <div class="flex space-x-2">
    {#each categories as category}
      <button on:click={handleSelect} class="btn btn-sm btn-outline">{category}</button>
    {/each}
  </div>
</div>
