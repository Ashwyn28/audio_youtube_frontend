export interface Video {
  id: string;
  title: string;
  timestamp: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  duration?: number;
}
export interface Channel {
  id: string;
  name: string;
}
export interface VideoPage {
  items: Video[];
  nextPageToken: string | null;
}
export interface Playback {
  queue: Video[];
  currentIndex: number;
  playing: boolean;
}
export type View = "feed" | "search" | "channel";

export interface ListeningHistory {
  video: Video;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}
