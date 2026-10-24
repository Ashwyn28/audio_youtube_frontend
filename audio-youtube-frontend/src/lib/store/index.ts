import { writable } from "svelte/store";
import { defaultChannels, defaultsRevision, migrateStarterChannels } from "$lib/data";
import type { Channel, Playback, Video, View, ListeningHistory } from "$lib/types";
import * as api from "$lib/services/search";
import * as playback from "$lib/playback";

interface State extends Playback {
  channels: Channel[];
  saved: Video[];
  history: ListeningHistory[];
  autoplay: boolean;
  playbackRate: number;
  sleepUntil: number | null;
  sleepAfterEpisode: boolean;
  seekPosition: number;
  seekVersion: number;
  retryVersion: number;
  view: View;
  selectedChannel: Channel | null;
  query: string;
  videos: Video[];
  nextPageToken: string | null;
  loading: boolean;
  error: string;
  storageMessage: string;
}
const initial = (): State => ({
  channels: [...defaultChannels],
  saved: [],
  history: [],
  autoplay: true,
  playbackRate: 1,
  sleepUntil: null,
  sleepAfterEpisode: false,
  seekPosition: 0,
  seekVersion: 0,
  retryVersion: 0,
  queue: [],
  currentIndex: -1,
  playing: false,
  view: "feed",
  selectedChannel: null,
  query: "",
  videos: [],
  nextPageToken: null,
  loading: false,
  error: "",
  storageMessage: "",
});
let state = initial();
const { subscribe, set } = writable(state);
// Live media events do not rewrite the persisted library on every time update.
export const playbackStatus = writable({ id: "", position: 0, duration: 0, buffering: false, error: "" });
let hydrated = false;
let storage: Storage | null = null;
let controller: AbortController | null = null;
let generation = 0;
let failedAppend = false;
const key = "audiotube:v1";
function change(update: (state: State) => State) {
  state = update(state);
  if (hydrated && storage) {
    try {
      storage.setItem(
        key,
        JSON.stringify(libraryData()),
      );
    } catch {
      state = {
        ...state,
        storageMessage:
          "Device storage is unavailable. Changes will last for this session.",
      };
      storage = null;
    }
  }
  set(state);
}
function isChannel(value: unknown): value is Channel {
  if (!value || typeof value !== "object") return false;
  const channel = value as Record<string, unknown>;
  return (
    typeof channel.id === "string" &&
    channel.id.length > 0 &&
    typeof channel.name === "string"
  );
}
function libraryData() {
  return { version: 1, defaultsRevision, channels: state.channels, queue: state.queue,
    currentIndex: state.currentIndex, saved: state.saved, history: state.history,
    autoplay: state.autoplay, playbackRate: state.playbackRate };
}
function uniqueVideos(value: unknown): Video[] {
  if (!Array.isArray(value)) return [];
  return [...new Map(value.filter(playback.isVideo).filter(v => v.id.length > 0).map(v => [v.id, v])).values()].slice(0, 100);
}
function readLibrary(raw: string) {
  if (raw.length > 5_000_000) throw new Error("Library file is too large (maximum 5 MB).");
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Choose an AudioTube library JSON file.");
  if (saved.version !== undefined && saved.version !== 1) throw new Error("This library version is not supported.");
  if (!Array.isArray(saved.channels) || !Array.isArray(saved.queue)) throw new Error("This file does not contain an AudioTube library.");
  const channels: Channel[] = [...new Map(saved.channels.filter(isChannel).map((c: Channel) => [c.id, c])).values()] as Channel[];
  const queue = uniqueVideos(saved.queue);
  const index = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
  const history: ListeningHistory[] = Array.isArray(saved.history) ? saved.history.filter((entry: ListeningHistory) =>
    entry && playback.isVideo(entry.video) && Number.isFinite(entry.position) && entry.position >= 0 &&
    Number.isFinite(entry.duration) && entry.duration >= 0 && Number.isFinite(entry.updatedAt) && typeof entry.completed === "boolean"
  ).slice(0, 200) : [];
  return { channels: channels.slice(0, 30), queue,
    currentIndex: queue.length ? Math.min(Math.max(index, 0), queue.length - 1) : -1,
    saved: uniqueVideos(saved.saved), history,
    autoplay: typeof saved.autoplay === "boolean" ? saved.autoplay : true,
    playbackRate: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(saved.playbackRate) ? saved.playbackRate : 1 };
}
async function load(append = false) {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const current = ++generation;
  const { view, query, selectedChannel, channels, nextPageToken } = state;
  failedAppend = append;
  change((s) => ({
    ...s,
    loading: true,
    error: "",
    ...(append ? {} : { videos: [], nextPageToken: null }),
  }));
  try {
    const page =
      view === "feed"
        ? {
            items: channels.length
              ? await api.feed(
                  channels.map((c) => c.id),
                  signal,
                )
              : [],
            nextPageToken: null,
          }
        : view === "search"
          ? await api.search(query, append ? nextPageToken || "" : "", signal)
          : await api.channelLatest(
              selectedChannel!.id,
              append ? nextPageToken || "" : "",
              signal,
            );
    if (current !== generation) return;
    if (!Array.isArray(page.items))
      throw new Error(
        "The API needs updating. Please deploy the latest backend.",
      );
    change((s) => ({
      ...s,
      videos: [
        ...new Map(
          (append ? [...s.videos, ...page.items] : page.items).map((v) => [
            v.id,
            v,
          ]),
        ).values(),
      ],
      nextPageToken: page.nextPageToken,
      loading: false,
    }));
  } catch (error) {
    if (current !== generation) return;
    change((s) => ({
      ...s,
      loading: false,
      error: error instanceof Error ? error.message : "Could not load results.",
    }));
  }
}
export const videoStore = {
  subscribe,
  hydrate() {
    if (hydrated) return;
    hydrated = true;
    try {
      storage = window.localStorage;
      const raw = storage.getItem(key);
      if (raw) {
        const saved = readLibrary(raw);
        const channels = JSON.parse(raw).defaultsRevision === defaultsRevision
          ? saved.channels : migrateStarterChannels(saved.channels);
        change((s) => ({ ...s, ...saved, channels, playing: false }));
      } else {
        const legacy = JSON.parse(storage.getItem("videos") || "null");
        if (Array.isArray(legacy?.channels))
          change((s) => ({
            ...s,
            channels: [
              ...new Map(
                [...defaultChannels, ...migrateStarterChannels(legacy.channels.filter(isChannel))].map(
                  (c) => [c.id, c],
                ),
              ).values(),
            ].slice(0, 30),
          }));
      }
    } catch {
      storage = null;
      change((s) => ({
        ...s,
        storageMessage:
          "Saved data could not be loaded. You can still use AudioTube in this session.",
      }));
    }
  },
  showFeed() {
    change((s) => ({ ...s, view: "feed", selectedChannel: null }));
    return load();
  },
  search(query: string) {
    if (!query.trim()) return;
    change((s) => ({
      ...s,
      view: "search",
      query: query.trim(),
      selectedChannel: null,
    }));
    return load();
  },
  showChannel(channel: Channel) {
    change((s) => ({ ...s, view: "channel", selectedChannel: channel }));
    return load();
  },
  showVideo(video: Video) {
    controller?.abort();
    generation++;
    change(s => ({ ...s, view: "search", query: video.title, selectedChannel: null,
      videos: [video], nextPageToken: null, loading: false, error: "", ...playback.playNow(s, video) }));
  },
  loadMore() {
    if (!state.loading && state.nextPageToken) return load(true);
  },
  retry() {
    return load(failedAppend);
  },
  refresh() {
    return load();
  },
  async addChannel(query: string) {
    if (state.channels.length >= 30)
      throw new Error(
        "You can save up to 30 channels. Remove one before adding another.",
      );
    const channel = await api.findChannel(query.trim());
    if (!state.channels.some((c) => c.id === channel.id)) {
      change((s) => ({ ...s, channels: [...s.channels, channel] }));
      if (state.view === "feed") await load();
    }
    return channel;
  },
  addSavedChannel(channel: Channel) {
    if (!isChannel(channel)) throw new Error("Choose a valid channel.");
    if (state.channels.some(c => c.id === channel.id)) return;
    if (state.channels.length >= 30) throw new Error("You can save up to 30 channels.");
    change(s => ({ ...s, channels: [...s.channels, channel] }));
    if (state.view === "feed") void load();
  },
  removeChannel(id: string) {
    change((s) => ({ ...s, channels: s.channels.filter((c) => c.id !== id) }));
    if (state.view === "feed") void load();
  },
  play(video: Video) {
    change((s) => ({ ...s, ...playback.playNow(s, video) }));
  },
  enqueue(video: Video) {
    change((s) => ({ ...s, ...playback.enqueue(s, video) }));
  },
  next() {
    change((s) => ({ ...s, ...playback.next(s) }));
  },
  previous() {
    change((s) => ({ ...s, ...playback.previous(s) }));
  },
  setPlaying(playing: boolean) {
    change((s) => ({ ...s, playing }));
  },
  retryPlayback() {
    change(s => ({ ...s, playing: true, retryVersion: s.retryVersion + 1 }));
  },
  select(index: number) {
    if (state.queue[index])
      change((s) => ({ ...s, currentIndex: index, playing: true }));
  },
  removeQueued(index: number) {
    change((s) => ({ ...s, ...playback.removeQueued(s, index) }));
  },
  clearUpcoming() {
    change((s) => ({ ...s, queue: s.queue.slice(0, s.currentIndex + 1) }));
  },
  playNext(video: Video) {
    change(s => ({ ...s, ...playback.playNext(s, video) }));
  },
  moveQueued(from: number, to: number) {
    change(s => ({ ...s, ...playback.moveQueued(s, from, to) }));
  },
  moveChannel(from: number, to: number) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || !state.channels[from] || !state.channels[to]) return;
    change(s => {
      const channels = [...s.channels];
      channels.splice(to, 0, channels.splice(from, 1)[0]);
      return { ...s, channels };
    });
  },
  clearQueue() {
    change(s => ({ ...s, queue: [], currentIndex: -1, playing: false }));
  },
  toggleSaved(video: Video) {
    change(s => ({ ...s, saved: s.saved.some(v => v.id === video.id)
      ? s.saved.filter(v => v.id !== video.id) : [video, ...s.saved].slice(0, 100) }));
  },
  updateProgress(id: string, position: number, duration: number) {
    const video = state.queue.find(item => item.id === id);
    if (!video || !Number.isFinite(position) || position < 0 || !Number.isFinite(duration) || duration <= 0) return;
    change(s => ({ ...s, history: [{ video, position: Math.min(position, duration), duration,
      completed: position >= duration - 2, updatedAt: Date.now() }, ...s.history.filter(h => h.video.id !== id)].slice(0, 200) }));
  },
  markFinished(video: Video) {
    const previous = state.history.find(h => h.video.id === video.id);
    const duration = previous?.duration || video.duration || 0;
    change(s => ({ ...s, history: [{ video, position: duration, duration, completed: true,
      updatedAt: Date.now() }, ...s.history.filter(h => h.video.id !== video.id)].slice(0, 200) }));
  },
  clearHistory() { change(s => ({ ...s, history: [] })); },
  requestSeek(position: number) {
    if (!Number.isFinite(position) || position < 0) return;
    change(s => ({ ...s, seekPosition: position, seekVersion: s.seekVersion + 1 }));
  },
  restart(video: Video) {
    change(s => ({ ...s, ...playback.playNow(s, video),
      history: s.history.filter(h => h.video.id !== video.id), seekPosition: 0, seekVersion: s.seekVersion + 1 }));
  },
  ended() {
    const video = state.queue[state.currentIndex];
    if (video) videoStore.markFinished(video);
    const continuePlaying = state.autoplay && !state.sleepAfterEpisode;
    change(s => ({ ...s, ...(continuePlaying ? playback.next(s) : { playing: false }),
      sleepAfterEpisode: false }));
  },
  setAutoplay(autoplay: boolean) { change(s => ({ ...s, autoplay })); },
  setPlaybackRate(playbackRate: number) {
    if ([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(playbackRate)) change(s => ({ ...s, playbackRate }));
  },
  setSleepTimer(minutes: number | "episode" | null) {
    if (typeof minutes === "number" && (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440)) return;
    change(s => ({ ...s, sleepAfterEpisode: minutes === "episode",
      sleepUntil: typeof minutes === "number" ? Date.now() + minutes * 60000 : null }));
  },
  checkSleepTimer() {
    if (state.sleepUntil !== null && Date.now() >= state.sleepUntil) change(s => ({ ...s, playing: false, sleepUntil: null }));
  },
  exportLibrary() { return JSON.stringify(libraryData(), null, 2); },
  importLibrary(raw: string) {
    let saved;
    try { saved = readLibrary(raw); } catch (error) {
      throw new Error(error instanceof SyntaxError ? "This file is not valid JSON." : error instanceof Error ? error.message : "Could not import library.");
    }
    controller?.abort(); generation++;
    change(s => ({ ...s, ...saved, playing: false, sleepUntil: null, sleepAfterEpisode: false,
      seekVersion: s.seekVersion + 1,
      seekPosition: saved.history.find(h => h.video.id === saved.queue[saved.currentIndex]?.id && !h.completed)?.position || 0,
      loading: false, error: "" }));
  },
  clearPersonalData() {
    controller?.abort(); generation++;
    try {
      storage = window.localStorage;
      storage.removeItem("videos");
      hydrated = true;
    } catch { storage = null; }
    change(() => ({ ...initial(), channels: [], storageMessage: storage ? "" : "Device storage could not be cleared. Browser settings can remove AudioTube's saved data." }));
  },

};
