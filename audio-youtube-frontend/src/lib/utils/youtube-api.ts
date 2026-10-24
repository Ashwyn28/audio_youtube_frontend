let pending: Promise<void> | null = null;
export function loadYouTubeAPI(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 15000);
    function fail() {
      window.clearTimeout(timer);
      tag.remove();
      pending = null;
      reject(
        new Error(
          "The YouTube player could not load. Check your connection and try again.",
        ),
      );
    }
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      resolve();
    };
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = fail;
    document.head.appendChild(tag);
  });
  return pending;
}
