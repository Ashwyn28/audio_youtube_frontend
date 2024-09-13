import type { Writable } from "svelte/store";

// types.ts
export interface Video {
    id: string;
    title: string;
    url: string;
  }
  
  export type Category = 'tech' | 'search';
  
  export interface VideoStore {
    subscribe: Writable<{ [key in Category]: Video[] }>['subscribe'];
    set: Writable<{ [key in Category]: Video[] }>['set'];
    update: Writable<{ [key in Category]: Video[] }>['update'];
    fetchVideos: (channels: string[], category?: Category) => Promise<void>;
    searchVideos: (query: string) => Promise<void>;
    clearVideos: (category: Category) => void;
    reset: () => void;
  }
  