import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function harness(fetch, base = "http://localhost:8000///") {
  const context = {
    exports: {},
    require: (name) => {
      assert.equal(name, "$env/dynamic/public");
      return { env: { PUBLIC_API_BASE_URL: base } };
    },
    fetch,
    URLSearchParams,
    Error,
  };
  const source = fs.readFileSync(
    new URL("../src/lib/services/search.ts", import.meta.url),
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
  return context.exports;
}
test("search encodes query and page token and requests a paginated response", async () => {
  let requested;
  const api = harness(async (url, options) => {
    requested = { url, options };
    return { ok: true, json: async () => ({ items: [], nextPageToken: null }) };
  });
  const signal = new AbortController().signal;
  await api.search("a & b?", "next+page", signal);
  const url = new URL(requested.url);
  assert.equal(url.pathname, "/videos/search");
  assert.equal(url.searchParams.get("query"), "a & b?");
  assert.equal(url.searchParams.get("page_token"), "next+page");
  assert.equal(url.searchParams.get("paginated"), "true");
  assert.equal(requested.options.signal, signal);
});
test("feed posts the saved channel IDs as JSON", async () => {
  let requested;
  const api = harness(async (url, options) => {
    requested = { url, options };
    return { ok: true, json: async () => [] };
  });
  await api.feed(["one", "two"]);
  assert.equal(requested.url, "http://localhost:8000/channels/latest");
  assert.equal(requested.options.method, "POST");
  assert.equal(requested.options.body, '["one","two"]');
});
test("channel requests encode the ID in the path", async () => {
  let requested;
  const api = harness(async (url) => {
    requested = url;
    return { ok: true, json: async () => ({ items: [], nextPageToken: null }) };
  });
  await api.channelLatest("channel/id");
  assert.equal(new URL(requested).pathname, "/channels/channel%2Fid/latest");
});
for (const status of [403, 429])
  test(`quota error ${status} produces an actionable message`, async () => {
    const api = harness(async () => ({ ok: false, status }));
    await assert.rejects(() => api.search("test"), /limiting requests/);
  });
test("channel not found and network failure are distinguished", async () => {
  await assert.rejects(
    () =>
      harness(async () => ({ ok: false, status: 404 })).findChannel("missing"),
    /No matching channel/,
  );
  await assert.rejects(
    () =>
      harness(async () => {
        throw new Error("network");
      }).search("test"),
    /Check your connection/,
  );
});
test("aborted requests preserve their cancellation error", async () => {
  const error = new Error("cancelled");
  error.name = "AbortError";
  const api = harness(async () => {
    throw error;
  });
  await assert.rejects(
    () => api.search("test"),
    (received) => received === error,
  );
});

test("channel discovery requests selectable results and preserves cancellation", async () => {
  let requested;
  const channels = [{ id: "one", name: "One" }, { id: "two", name: "Two" }];
  const api = harness(async (url, options) => {
    requested = { url, options };
    return { ok: true, json: async () => ({ items: channels, nextPageToken: null }) };
  });
  const signal = new AbortController().signal;
  const results = await api.searchChannels("science & technology", signal);
  const url = new URL(requested.url);
  assert.equal(url.pathname, "/channels/search");
  assert.equal(url.searchParams.get("query"), "science & technology");
  assert.equal(url.searchParams.get("paginated"), "true");
  assert.equal(requested.options.signal, signal);
  assert.deepEqual(results, channels);
});

for (const type of ["video", "channel"])
  test(`pasted links preserve their URL and resolve a ${type}`, async () => {
    let requested;
    const source = "https://www.youtube.com/watch?v=example&list=playlist#chapter";
    const resolved = { type, [type]: { id: "example" } };
    const api = harness(async (url) => {
      requested = url;
      return { ok: true, json: async () => resolved };
    });
    assert.deepEqual(await api.resolveLink(source), resolved);
    const url = new URL(requested);
    assert.equal(url.pathname, "/resolve");
    assert.equal(url.searchParams.get("url"), source);
  });

test("native audio uses the configured API and encodes the video ID", () => {
  const api = harness(async () => { throw new Error("audio URL must not fetch"); }, "https://audio.example/api///");
  assert.equal(api.audioUrl("video/id?query"), "https://audio.example/api/audio/video%2Fid%3Fquery");
});
