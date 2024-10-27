<script>
  import "../app.css";
</script>

<div class="relative min-h-screen">
  <div class="flex justify-start p-5">
    <img src="/audio-youtube-icon-light.svg" class="block dark:hidden" alt="Audio YouTube Icon" />
    <img src="/audio-youtube-icon-dark.svg" class="hidden dark:block" alt="Audio YouTube Icon" />
    <h1 class="text-lg font-bold content-center px-2">AudioTube</h1>
  </div>
  <div class="p-[7%] md:pb-[7%] pb-[25%]">
    <slot />
  </div>
</div>
