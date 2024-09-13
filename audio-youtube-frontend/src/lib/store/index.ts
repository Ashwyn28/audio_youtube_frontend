import { writable } from "svelte/store";
import { LocalStorageManager } from "./handlers/localStorage";
import { VideoHandler } from "./handlers/videoHandler";

export function createVideoStore(withPersistentStorage: boolean) {
  const localStorage = new LocalStorageManager("videos");
  const initialState = localStorage.getStorage() || {
    tech: [],
    search: [],
  };

  const { subscribe, set, update } = writable(initialState);
  const videoHandler = new VideoHandler(update);

  if (withPersistentStorage) {
    localStorage.subscribeToChanges(subscribe);
  }

  return {
    subscribe,
    set,
    update,
    fetchVideos: (channels: string[], category: string) =>
      videoHandler.fetchVideos(channels, category),
    searchVideos: (query: string) => videoHandler.searchVideos(query),
    clearVideos: (category: string) => videoHandler.clearVideos(category),
    reset: () => videoHandler.reset(),
  };
}

export const videoStore = createVideoStore(true);
