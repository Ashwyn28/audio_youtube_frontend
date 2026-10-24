import type { Playback, Video } from "./types";

export function playNow(state: Playback, video: Video): Playback {
  const existing = state.queue.findIndex((item) => item.id === video.id);
  if (existing >= 0) return { ...state, currentIndex: existing, playing: true };
  const queue = [...state.queue];
  let currentIndex = state.currentIndex + 1;
  if (queue.length >= 100) {
    if (state.currentIndex > 0) {
      queue.shift();
      currentIndex--;
    } else queue.pop();
  }
  queue.splice(currentIndex, 0, video);
  return { queue, currentIndex, playing: true };
}
export function enqueue(state: Playback, video: Video): Playback {
  if (state.queue.some((item) => item.id === video.id)) return state;
  if (state.queue.length >= 100 && state.currentIndex <= 0) return state;
  const trimHistory = state.queue.length >= 100;
  return {
    ...state,
    queue: [...(trimHistory ? state.queue.slice(1) : state.queue), video],
    currentIndex: Math.max(0, state.currentIndex - (trimHistory ? 1 : 0)),
  };
}
export function next(state: Playback): Playback {
  if (state.currentIndex + 1 >= state.queue.length)
    return { ...state, playing: false };
  return { ...state, currentIndex: state.currentIndex + 1 };
}
export function previous(state: Playback): Playback {
  if (state.currentIndex <= 0) return state;
  return { ...state, currentIndex: state.currentIndex - 1 };
}
export function removeQueued(state: Playback, index: number): Playback {
  if (index === state.currentIndex || index < 0 || index >= state.queue.length)
    return state;
  return {
    ...state,
    queue: state.queue.filter((_, i) => i !== index),
    currentIndex: state.currentIndex - (index < state.currentIndex ? 1 : 0),
  };
}
export function isVideo(value: unknown): value is Video {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return [
    "id",
    "title",
    "timestamp",
    "channelId",
    "channelTitle",
    "thumbnail",
  ].every((key) => typeof item[key] === "string");
}

export function playNext(state: Playback, video: Video): Playback {
  if (state.queue[state.currentIndex]?.id === video.id) return state;
  const queue = state.queue.filter((item) => item.id !== video.id);
  const currentId = state.queue[state.currentIndex]?.id;
  let currentIndex = currentId ? queue.findIndex((item) => item.id === currentId) : -1;
  if (queue.length >= 100) {
    if (currentIndex > 0) { queue.shift(); currentIndex--; }
    else queue.pop();
  }
  queue.splice(currentIndex + 1, 0, video);
  return { ...state, queue, currentIndex: Math.max(0, currentIndex) };
}
export function moveQueued(state: Playback, from: number, to: number): Playback {
  if (!Number.isInteger(from) || !Number.isInteger(to) || !state.queue[from] || !state.queue[to]) return state;
  const currentId = state.queue[state.currentIndex]?.id;
  const queue = [...state.queue];
  queue.splice(to, 0, queue.splice(from, 1)[0]);
  return { ...state, queue, currentIndex: currentId ? queue.findIndex((item) => item.id === currentId) : -1 };
}
