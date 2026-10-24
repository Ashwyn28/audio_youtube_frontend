import test from "node:test";
import assert from "node:assert/strict";
import * as playback from "../src/lib/playback.ts";
const video = (id) => ({
  id,
  title: id,
  timestamp: "",
  channelId: "",
  channelTitle: "",
  thumbnail: "",
});
const empty = () => ({ queue: [], currentIndex: -1, playing: false });

test("play now inserts after the current item and preserves the upcoming queue", () => {
  let state = playback.playNow(empty(), video("first"));
  state = playback.enqueue(state, video("later"));
  state = playback.playNow(state, video("now"));
  assert.deepEqual(
    state.queue.map((v) => v.id),
    ["first", "now", "later"],
  );
  assert.equal(state.currentIndex, 1);
  assert.equal(state.playing, true);
});
test("enqueue deduplicates and does not start playback", () => {
  let state = playback.enqueue(empty(), video("first"));
  state = playback.enqueue(state, video("first"));
  assert.equal(state.queue.length, 1);
  assert.equal(state.playing, false);
  assert.equal(state.currentIndex, 0);
});
test("selecting an existing item avoids duplicates", () => {
  let state = playback.enqueue(empty(), video("one"));
  state = playback.enqueue(state, video("two"));
  state = playback.playNow(state, video("two"));
  assert.equal(state.currentIndex, 1);
  assert.equal(state.queue.length, 2);
});
test("next advances and the final track stops instead of looping", () => {
  let state = playback.playNow(empty(), video("one"));
  state = playback.enqueue(state, video("two"));
  state = playback.next(state);
  assert.equal(state.currentIndex, 1);
  assert.equal(state.playing, true);
  state = playback.next(state);
  assert.equal(state.currentIndex, 1);
  assert.equal(state.playing, false);
  assert.equal(playback.previous(state).currentIndex, 0);
});
test("removing queue entries preserves the playing item", () => {
  const state = {
    queue: [video("one"), video("two"), video("three")],
    currentIndex: 1,
    playing: true,
  };
  assert.deepEqual(playback.removeQueued(state, 1), state);
  const changed = playback.removeQueued(state, 0);
  assert.equal(changed.queue[changed.currentIndex].id, "two");
  assert.deepEqual(playback.removeQueued(state, 99), state);
});
test("queue size stays bounded when playing a new item", () => {
  const state = {
    queue: Array.from({ length: 100 }, (_, i) => video(String(i))),
    currentIndex: 10,
    playing: true,
  };
  const changed = playback.playNow(state, video("new"));
  assert.equal(changed.queue.length, 100);
  assert.equal(changed.queue[changed.currentIndex].id, "new");
});

test("previous keeps an empty queue unselected", () => {
  assert.equal(playback.previous(empty()).currentIndex, -1);
});
test("enqueue recycles oldest played history at capacity", () => {
  const state = {
    queue: Array.from({ length: 100 }, (_, i) => video(String(i))),
    currentIndex: 40,
    playing: true,
  };
  const changed = playback.enqueue(state, video("new"));
  assert.equal(changed.queue.length, 100);
  assert.equal(changed.queue[changed.currentIndex].id, "40");
  assert.equal(changed.queue.at(-1).id, "new");
});

test("play next moves an existing item directly after current without starting playback", () => {
  const state = { queue: [video("one"), video("two"), video("three")], currentIndex: 0, playing: false };
  const changed = playback.playNext(state, video("three"));
  assert.deepEqual(changed.queue.map(v => v.id), ["one", "three", "two"]);
  assert.equal(changed.playing, false);
  assert.equal(changed.currentIndex, 0);
});
test("moving queue entries keeps the same current video selected", () => {
  const state = { queue: [video("one"), video("two"), video("three")], currentIndex: 1, playing: true };
  const changed = playback.moveQueued(state, 0, 2);
  assert.deepEqual(changed.queue.map(v => v.id), ["two", "three", "one"]);
  assert.equal(changed.queue[changed.currentIndex].id, "two");
  assert.equal(changed.playing, true);
  assert.deepEqual(playback.moveQueued(state, -1, 0), state);
});

test("play next at capacity preserves a current item at the end of the queue", () => {
  const state = { queue: Array.from({ length: 100 }, (_, i) => video(String(i))), currentIndex: 99, playing: true };
  const changed = playback.playNext(state, video("new"));
  assert.equal(changed.queue.length, 100);
  assert.equal(changed.queue[changed.currentIndex].id, "99");
  assert.equal(changed.queue[changed.currentIndex + 1].id, "new");
});
