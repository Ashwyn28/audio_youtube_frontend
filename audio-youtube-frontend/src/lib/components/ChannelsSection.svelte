<!-- <script lang="ts">
    import LatestChannels from "./LatestChannels.svelte";
    import { videoStore } from "$lib/store";
  import { onMount } from "svelte";

    export type: string = ''
    let store;

    if (type == 'tech') {
       store = $videoStore.techVideos; 
    }

    onMount(async () => {
        store.fetchVideos();
    });
</script>

<LatestChannels videos=/> -->