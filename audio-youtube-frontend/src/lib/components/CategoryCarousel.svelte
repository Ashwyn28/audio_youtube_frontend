<script lang="ts">
  import { videoStore } from "$lib/store";
  export let channels: { name: string; id: string }[] = [];

  let searchQuery = "";
  $: newChannels = $videoStore.channels || [];
  $: combinedChannels = newChannels.concat(channels)

  const handleSelect = (channel_id: string) => {
    videoStore.searchChannel(channel_id);
  };

  const handleSearch = async () => {
    if (searchQuery) {
      await videoStore.addChannel(searchQuery);
    }
  };

  let showSearch = false;

  // $: if (newChannels) {
  //   for(let i = 0; i < newChannels.length; i++) {
  //     channels.push(newChannels[i])
  //   }
  // }
</script>

<div class="overscroll-x overflow-x-auto py-8">
  <div class="flex space-x-2">
    <button
      class="btn btn-sm btn-outline"
      on:click={() => (showSearch = !showSearch)}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Vertical line -->
        <path
          d="M12 5V19"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Horizontal line -->
        <path
          d="M5 12H19"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    {#each combinedChannels as channel}
      <button
        on:click={() => handleSelect(channel.id)}
        class="btn btn-sm btn-outline">{channel.name}</button
      >
    {/each}
  </div>
</div>

{#if showSearch}
  <div class="text-center flex w-[30%]">
    <label
      class="flex-1 input input-xs input-bordered flex items-center gap-2 mr-2"
    >
      <input
        type="text"
        class="grow"
        placeholder="Add channel"
        bind:value={searchQuery}
      />
    </label>
    <button on:click={handleSearch} class="btn btn-neutral btn-xs">Add</button>
  </div>
{/if}
