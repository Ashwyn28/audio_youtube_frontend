<script lang="ts">
  import CategoryCard from "./CategoryCard.svelte";
  import { videoStore } from "$lib/store";

  export let channels;
  export let category;

  // $: videos = $videoStore.tech;

  // videoStore.fetchVideos(channels, category);
  let videos = [
    {
      id: "8Ip8VOuI5Ho",
      title: "test 1",
    },
    {
      id: "8IaBF-5T-6U",
      title: "test 2",
    },
    {
      id: "WKhZQwWz6wU",
      title: "test 3",
    },
  ];
</script>

{#if videos.length === 0}
  <p>Loading...</p>
{:else}
  <CategoryCard {videos} />
{/if}
