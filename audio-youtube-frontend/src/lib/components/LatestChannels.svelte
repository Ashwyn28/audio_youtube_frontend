<script lang="ts">
    import { onMount } from "svelte";
    import Player from "./Player.svelte";
    import { searchChannelLatest } from "$lib/api/search";
    import type { Writable } from "svelte/store";

    export let channels: [string] = [''];
    export let store: Writable<any>;

    onMount(async () => {
        if (channels) {
            const res = await searchChannelLatest(channels);
            if (res) {
                store.set(res);
            }
        }
    });
</script>

<div>
    {#if $store}
        {#each $store as video}
            <Player videoId={video.id} videoTitle={video.title} />
        {/each}
    {/if}
</div>