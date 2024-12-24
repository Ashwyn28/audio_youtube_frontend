<script lang="ts">
    import Player from "./Player.svelte";
    import { videoStore } from "$lib/store";

    export let channels;
    const category = "feed"
    $: videos = $videoStore.feed || []

    videoStore.searchChannels(channels, category)
</script>

{#if videos.length === 0}
    <p>Loading...</p>
{:else}
    {#if videos}
        {#each videos as video}
            <Player videoId={video.id} videoTitle={video.title} />
        {/each}
    {/if}
{/if}