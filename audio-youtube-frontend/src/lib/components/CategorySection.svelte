<script lang="ts">
  import CategoryCard from "./CategoryCard.svelte";
  import { videoStore } from "$lib/store";

  export let channels;
  export let category;

  $: videos = $videoStore[category] || []; 

  videoStore.searchChannels(channels, category);
</script>

{#if videos.length === 0}
  <p>Loading...</p>
{:else}
  <div class="p-4 border-solid border rounded-xl">
    <div class="text-lg font-bold py-4 capitalize">{category}</div>
    <CategoryCard {videos} />
  </div>
{/if}
