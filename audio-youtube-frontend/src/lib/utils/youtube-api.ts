import { writable } from 'svelte/store';

export const isYouTubeAPIReady = writable(false);

let loading = false;

export function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    isYouTubeAPIReady.set(true);
    return;
  }

  if (loading) return;
  loading = true;

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];

  if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else {
    document.body.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = () => {
    isYouTubeAPIReady.set(true);
  };
}
