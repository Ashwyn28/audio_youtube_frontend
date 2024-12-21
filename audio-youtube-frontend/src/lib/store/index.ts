import { writable } from "svelte/store";
import { LocalStorageManager } from "./handlers/localStorage";
import { VideoHandler } from "./handlers/videoHandler";
import type { Category } from "$lib/types";
import { initialState } from "$lib/data";

export function createVideoStore(withPersistentStorage: boolean, persistentStates: string[] = []) {
  const localStorage = new LocalStorageManager("videos",  persistentStates);
  const _initialState = localStorage.getStorage() || initialState; 

  const { subscribe, set, update } = writable(_initialState);
  const videoHandler = new VideoHandler(update);

  if (withPersistentStorage) {
    localStorage.subscribeToChanges(subscribe);
  }

  return {
    subscribe,
    set,
    update,
    searchChannels: (channels: string[], category: string) =>
      videoHandler.searchChannels(channels, category),
    searchVideos: (query: string) => videoHandler.searchVideos(query),
    searchChannel: (channel: string) => videoHandler.searchChannel(channel),
    addChannel: (query: string) => videoHandler.addChannel(query),
    clearVideos: (category: Category) => videoHandler.clearVideos(category),
    reset: () => videoHandler.reset(),
  };
}

export const videoStore = createVideoStore(true, ["channels"]);
