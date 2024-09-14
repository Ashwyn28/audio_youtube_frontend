<script lang="ts">
    export let categories: string[] = [];
  </script>
  
  <div class="overflow-x-auto py-2">
    <div class="flex space-x-2">
      {#each categories as category}
        <button class="btn btn-sm btn-outline">{category}</button>
      {/each}
    </div>
  </div>
  