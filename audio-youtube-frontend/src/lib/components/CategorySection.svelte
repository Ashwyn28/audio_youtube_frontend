<script lang="ts">
    import CategoryCard from "./CategoryCard.svelte";
    import { videoStore } from "$lib/store";

    export let channels;
    export let category;

    $: videos = $videoStore.tech;

    videoStore.fetchVideos(channels, category);
</script>

{#if videos.length === 0}
    <p>Loading...</p>
{:else}
    <CategoryCard {videos} />
{/if}
