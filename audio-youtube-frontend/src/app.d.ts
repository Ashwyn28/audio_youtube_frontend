interface YouTubePlayer {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  destroy(): void;
}
interface Window {
  YT?: {
    Player: new (
      element: HTMLElement,
      options: {
        width: string;
        height: string;
        playerVars: Record<string, string | number>;
        events: {
          onReady(): void;
          onStateChange(event: { data: number }): void;
          onError(event: { data: number }): void;
          onAutoplayBlocked(): void;
        };
      },
    ) => YouTubePlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
}
