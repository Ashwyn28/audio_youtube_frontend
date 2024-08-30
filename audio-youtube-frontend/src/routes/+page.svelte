<script>
    import Player from "$lib/components/Player.svelte"
    import { search } from "$lib/api/search";
    import { onMount } from "svelte";

    $: videoIds = []

    const handleSearch = async (q) => {
        const res = await search("mkbhd");
        if (res) {
            videoIds = res.videos
        }
    }

    onMount(async () => {
        await handleSearch()
    })
</script>

{#if videoIds}
    {#each videoIds as videoId}
        <Player {videoId}/>
    {/each}
{/if}