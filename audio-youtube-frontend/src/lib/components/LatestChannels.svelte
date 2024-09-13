<script>
    import Player from "./Player.svelte";
    export let videos;
</script>

<div>
    {#if videos}
        {#each videos as video}
            <Player videoId={video.id} videoTitle={video.title} />
        {/each}
    {/if}
</div>