import type { Writable } from "svelte/store";
import {
  search,
  searchChannelsLatest,
  searchChannelLatest,
  addChannel,  
} from "$lib/services/search";
import type { Category } from "$lib/types";

export class VideoHandler {
  private update: Writable<any>["update"];

  constructor(update: Writable<any>["update"]) {
    this.update = update;
  }

  async searchChannels(channels: string[], category: string): Promise<void> {
    const res = await searchChannelsLatest(channels);
    if (res) {
      this.update((state) => {
        state[category] = res;
        return state;
      });
    }
  }

  async searchVideos(query: string): Promise<void> {
    const res = await search(query);
    if (res) {
      this.update((state) => {
        state.search = res;
        return state;
      });
    }
  }

  async searchChannel(channel: string): Promise<void> {
    const res = await searchChannelLatest(channel);
    if (res) {
      this.update((state) => {
        state.channelLatest = res;
        return state;
      });
    }
  }

  async addChannel(q: string): Promise<void> {
    const res = await addChannel(q);
    if (res) {
      this.update((state) => {
        state.channels.push(res);
        return state;
      });
    }
  }

  clearVideos(category: Category): void {
    this.update((state) => {
      state[category] = [];
      return state;
    });
  }

  reset(): void {
    this.update(() => ({
      tech: [],
      search: [],
    }));
  }
}
