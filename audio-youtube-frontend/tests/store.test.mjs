import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { writable } from "svelte/store";
import * as playback from "../src/lib/playback.ts";
import * as channelDefaults from "../src/lib/data.ts";
const video = (id) => ({
  id,
  title: id,
  timestamp: "",
  channelId: "",
  channelTitle: "",
  thumbnail: "",
});
const channel = { id: "one", name: "One" };
const plain = (value) => JSON.parse(JSON.stringify(value));
function harness(saved = {}, overrides = {}) {
  const data = new Map(Object.entries(saved));
  const api = {
    feed: async () => [],
    search: async () => ({ items: [], nextPageToken: null }),
    channelLatest: async () => ({ items: [], nextPageToken: null }),
    findChannel: async () => channel,
    ...overrides,
  };
  const imports = {
    "svelte/store": { writable },
    "$lib/data": { ...channelDefaults, defaultChannels: [channel] },
    "$lib/services/search": api,
    "$lib/playback": playback,
  };
  const context = {
    exports: {},
    require: (name) => imports[name],
    AbortController,
    Map,
    Error,
    window: {
      localStorage: {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
        removeItem: (key) => data.delete(key),
      },
    },
  };
  const source = fs.readFileSync(
    new URL("../src/lib/store/index.ts", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    context,
  );
  const store = context.exports.videoStore;
  let state;
  store.subscribe((value) => (state = value));
  return { store, data, state: () => state };
}
test("saved channels and queue restore without autoplay", () => {
  const h = harness({
    "audiotube:v1": JSON.stringify({
      channels: [],
      queue: [video("saved")],
      currentIndex: 40,
      playing: true,
    }),
  });
  h.store.hydrate();
  assert.equal(h.state().channels.length, 0);
  assert.equal(h.state().currentIndex, 0);
  assert.equal(h.state().queue[0].id, "saved");
  assert.equal(h.state().playing, false);
});
const starterChannels = [
  { id: "UCBJycsmduvYEL83R_U4JriQ", name: "MKBHD" },
  { id: "UCEcrRXW3oEYfUctetZTAWLw", name: "WAVEFORM PDCST" },
  { id: "UCSHZKyawb77ixDdsGog4iWA", name: "LEX FRIDMAN PDCST" },
];
test("starter defaults upgrade once while preserving added channels, queue and progress", () => {
  const queued = video("unfinished");
  const history = [{ video: queued, position: 12, duration: 60, completed: false, updatedAt: 1 }];
  const h = harness({ "audiotube:v1": JSON.stringify({
    channels: [...starterChannels, { id: "custom", name: "My channel" }],
    queue: [queued], currentIndex: 0, history,
  }) });
  h.store.hydrate();
  assert.deepEqual(plain(h.state().channels), [...channelDefaults.defaultChannels, { id: "custom", name: "My channel" }]);
  assert.equal(h.state().queue[0].id, queued.id);
  assert.deepEqual(plain(h.state().history), history);
  assert.equal(h.state().playing, false);
  assert.equal(JSON.parse(h.data.get("audiotube:v1")).defaultsRevision, channelDefaults.defaultsRevision);
});
test("deliberately customized channels are not replaced by a default upgrade", () => {
  const channels = [starterChannels[0], { id: "custom", name: "My channel" }];
  const h = harness({ "audiotube:v1": JSON.stringify({ channels, queue: [] }) });
  h.store.hydrate();
  assert.deepEqual(plain(h.state().channels), channels);
});
test("upgrading a full channel list keeps every user-added channel", () => {
  const custom = Array.from({ length: 27 }, (_, index) => ({ id: `custom-${index}`, name: `Custom ${index}` }));
  const result = channelDefaults.migrateStarterChannels([...starterChannels, ...custom]);
  assert.equal(result.length, 30);
  assert.deepEqual(result.slice(0, 3), channelDefaults.defaultChannels.slice(0, 3));
  assert.deepEqual(result.slice(3), custom);
});
test("later manual selection of the old channels is not migrated again", () => {
  const h = harness({ "audiotube:v1": JSON.stringify({
    defaultsRevision: channelDefaults.defaultsRevision, channels: starterChannels, queue: [],
  }) });
  h.store.hydrate();
  assert.deepEqual(plain(h.state().channels), starterChannels);
});
test("legacy starter channels upgrade without duplicating new defaults", () => {
  const h = harness({ videos: JSON.stringify({ channels: [...starterChannels, channelDefaults.defaultChannels[0]] }) });
  h.store.hydrate();
  const ids = h.state().channels.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.filter(id => id === channelDefaults.defaultChannels[0].id).length, 1);
  assert.equal(ids.some(id => starterChannels.some(c => c.id === id)), false);
});
test("corrupt saved data falls back safely", () => {
  const h = harness({ "audiotube:v1": "{broken" });
  h.store.hydrate();
  assert.equal(h.state().channels[0].id, "one");
  assert.match(h.state().storageMessage, /could not be loaded/);
});
test("older saved channels migrate and duplicates are removed", () => {
  const h = harness({
    videos: JSON.stringify({ channels: [channel, { id: "two", name: "Two" }] }),
  });
  h.store.hydrate();
  assert.deepEqual(plain(h.state().channels.map((c) => c.id)), ["one", "two"]);
});
test("switching views ignores an older slow response", async () => {
  let resolveSearch;
  const h = harness(
    {},
    {
      search: () => new Promise((resolve) => (resolveSearch = resolve)),
      channelLatest: async () => ({
        items: [video("channel-video")],
        nextPageToken: null,
      }),
    },
  );
  const pending = h.store.search("slow");
  await h.store.showChannel(channel);
  resolveSearch({ items: [video("stale-search")], nextPageToken: null });
  await pending;
  assert.equal(h.state().view, "channel");
  assert.equal(h.state().videos[0].id, "channel-video");
});
test("load more can retry without losing earlier results or duplicating videos", async () => {
  let failed = false;
  const h = harness(
    {},
    {
      search: async (query, token) => {
        if (!token)
          return { items: [video("first")], nextPageToken: "page-two" };
        if (!failed) {
          failed = true;
          throw new Error("temporary failure");
        }
        return {
          items: [video("first"), video("second")],
          nextPageToken: null,
        };
      },
    },
  );
  await h.store.search("query");
  await h.store.loadMore();
  assert.match(h.state().error, /temporary/);
  assert.equal(h.state().videos.length, 1);
  await h.store.retry();
  assert.deepEqual(plain(h.state().videos.map((v) => v.id)), [
    "first",
    "second",
  ]);
  assert.equal(h.state().error, "");
});
test("channel removal updates the feed and persists across reloads", async () => {
  const h = harness();
  h.store.hydrate();
  h.store.removeChannel("one");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.state().videos.length, 0);
  const reloaded = harness(Object.fromEntries(h.data));
  reloaded.store.hydrate();
  assert.equal(reloaded.state().channels.length, 0);
});
test("adding a duplicate channel does not duplicate subscriptions", async () => {
  const h = harness();
  await h.store.addChannel("one");
  assert.equal(h.state().channels.length, 1);
});
test("clearing upcoming preserves current playback and queue history", () => {
  const h = harness();
  h.store.play(video("first"));
  h.store.enqueue(video("next"));
  h.store.clearUpcoming();
  assert.equal(h.state().queue.length, 1);
  assert.equal(h.state().queue[0].id, "first");
  assert.equal(h.state().playing, true);
});

test("saved items, progress, preferences and channels survive library export/import paused", () => {
  const h = harness();
  h.store.play(video("episode"));
  h.store.enqueue(video("next"));
  h.store.toggleSaved(video("later"));
  h.store.updateProgress("episode", 42, 100);
  h.store.setAutoplay(false);
  h.store.setPlaybackRate(1.5);
  const restored = harness();
  restored.store.importLibrary(h.store.exportLibrary());
  assert.equal(restored.state().saved[0].id, "later");
  assert.equal(restored.state().history[0].position, 42);
  assert.equal(restored.state().history[0].completed, false);
  assert.equal(restored.state().playbackRate, 1.5);
  assert.equal(restored.state().autoplay, false);
  assert.equal(restored.state().playing, false);
  assert.equal(restored.state().queue.length, 2);
});
test("invalid import leaves the existing library intact", () => {
  const h = harness();
  h.store.toggleSaved(video("keep"));
  assert.throws(() => h.store.importLibrary("not json"), /valid JSON/);
  assert.throws(() => h.store.importLibrary('{"version":2,"channels":[],"queue":[]}'), /not supported/);
  assert.throws(() => h.store.importLibrary('{}'), /AudioTube library/);
  assert.equal(h.state().saved[0].id, "keep");
});
test("episode completion respects autoplay and end-of-episode sleep", () => {
  const h = harness();
  h.store.play(video("one"));
  h.store.enqueue(video("two"));
  h.store.setSleepTimer("episode");
  h.store.ended();
  assert.equal(h.state().playing, false);
  assert.equal(h.state().currentIndex, 0);
  assert.equal(h.state().history[0].completed, true);
  assert.equal(h.state().sleepAfterEpisode, false);
  h.store.setPlaying(true);
  h.store.ended();
  assert.equal(h.state().currentIndex, 1);
  assert.equal(h.state().playing, true);
  h.store.setAutoplay(false);
  h.store.ended();
  assert.equal(h.state().playing, false);
});
test("invalid progress and rate updates are ignored", () => {
  const h = harness();
  h.store.play(video("one"));
  h.store.updateProgress("one", Number.NaN, 100);
  h.store.updateProgress("other", 10, 100);
  h.store.updateProgress("one", 10, Number.POSITIVE_INFINITY);
  h.store.setPlaybackRate(0);
  assert.equal(h.state().history.length, 0);
  assert.equal(h.state().playbackRate, 1);
  h.store.updateProgress("one", 150, 100);
  assert.equal(h.state().history[0].position, 100);
  assert.equal(h.state().history[0].completed, true);
});
test("clear personal data removes all channels, saved items, queue, progress and timers", () => {
  const h = harness();
  h.store.hydrate();
  h.store.play(video("one"));
  h.store.toggleSaved(video("one"));
  h.store.updateProgress("one", 10, 100);
  h.store.setSleepTimer(15);
  h.store.clearPersonalData();
  for (const field of ["channels", "queue", "saved", "history"]) assert.equal(h.state()[field].length, 0);
  assert.equal(h.state().playing, false);
  assert.equal(h.state().sleepUntil, null);
  const reloaded = harness(Object.fromEntries(h.data));
  reloaded.store.hydrate();
  assert.equal(reloaded.state().channels.length, 0);
  assert.equal(reloaded.state().saved.length, 0);
});
test("restarting an episode resets its remembered position and explicitly seeks to zero", () => {
  const h = harness();
  const item = video("one");
  h.store.play(item);
  h.store.updateProgress("one", 60, 100);
  h.store.restart(item);
  assert.equal(h.state().history.length, 0);
  assert.equal(h.state().seekPosition, 0);
  assert.equal(h.state().seekVersion, 1);
  assert.equal(h.state().playing, true);
});
test("channel reorder and adding an explicitly chosen result preserve unique channels", () => {
  const h = harness();
  h.store.addSavedChannel({ id: "two", name: "Two" });
  h.store.addSavedChannel({ id: "two", name: "Two" });
  h.store.moveChannel(1, 0);
  assert.deepEqual(plain(h.state().channels.map(c => c.id)), ["two", "one"]);
});

test("clearing personal data replaces corrupt storage with a valid empty library", () => {
  const h = harness({ "audiotube:v1": "{broken" });
  h.store.hydrate();
  h.store.clearPersonalData();
  const reloaded = harness(Object.fromEntries(h.data));
  reloaded.store.hydrate();
  assert.equal(reloaded.state().channels.length, 0);
  assert.equal(reloaded.state().storageMessage, "");
});


test("clear personal data also removes the legacy channels record", () => {
  const h = harness({ videos: JSON.stringify({ channels: [channel] }) });
  h.store.hydrate();
  h.store.clearPersonalData();
  assert.equal(h.data.has("videos"), false);
});
