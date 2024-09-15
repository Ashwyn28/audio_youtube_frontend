<script lang="ts">
  import { videoStore } from "$lib/store";
  export let channels: { name: string; id: string; }[] = [];

  const handleSelect = (category: string) => {
    videoStore.searchChannel(category) 
  }
</script>

<div class="overscroll-x overflow-x-auto py-8">
  <div class="flex space-x-2">
    {#each channels as channel}
      <button on:click={() => handleSelect(channel.id)} class="btn btn-sm btn-outline">{channel.name}</button>
    {/each}
  </div>
</div>
