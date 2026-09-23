import { test } from "node:test";
import assert from "node:assert/strict";
import { createAssetUrlBatcher, AssetUnavailableError } from "./assetUrlBatcher.js";

const tick = () => new Promise((r) => setTimeout(r, 15));
const ok = (id) => ({ assetId: id, available: true, url: `/u/${id}`, expiresAt: "2030-01-01T00:00:00Z" });
const no = (id) => ({ assetId: id, available: false, url: null, expiresAt: null });

test("asks made in the same moment become one request, and each caller gets its own answer", async () => {
  const calls = [];
  const batcher = createAssetUrlBatcher({ fetchBatch: async (token, slug, ids) => { calls.push({ token, slug, ids }); return { items: ids.map(ok) }; } });

  const [a, b, c] = await Promise.all([batcher.request("t", "ws", "A"), batcher.request("t", "ws", "B"), batcher.request("t", "ws", "C")]);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].ids, ["A", "B", "C"]);
  assert.equal(a.url, "/u/A"); assert.equal(b.url, "/u/B"); assert.equal(c.url, "/u/C");
});

test("the same asset asked for twice is sent once and both callers are answered", async () => {
  const calls = [];
  const batcher = createAssetUrlBatcher({ fetchBatch: async (_t, _s, ids) => { calls.push(ids); return { items: ids.map(ok) }; } });

  const [first, second] = await Promise.all([batcher.request("t", "ws", "A"), batcher.request("t", "ws", "A")]);

  assert.deepEqual(calls, [["A"]]);
  assert.equal(first.url, second.url);
});

test("more than 50 assets are split into requests of at most 50", async () => {
  const sizes = [];
  const batcher = createAssetUrlBatcher({ fetchBatch: async (_t, _s, ids) => { sizes.push(ids.length); return { items: ids.map(ok) }; } });
  const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);

  const results = await Promise.all(ids.map((id) => batcher.request("t", "ws", id)));

  assert.deepEqual(sizes.sort((a, b) => b - a), [50, 50, 20]);
  assert.equal(results.length, 120);
  assert.equal(results[119].url, "/u/id119");
});

test("an unavailable asset rejects only its own callers, with the same error whatever the reason", async () => {
  const batcher = createAssetUrlBatcher({ fetchBatch: async (_t, _s, ids) => ({ items: ids.map((id) => (id === "B" ? no(id) : ok(id))) }) });

  const results = await Promise.allSettled([batcher.request("t", "ws", "A"), batcher.request("t", "ws", "B"), batcher.request("t", "ws", "C")]);

  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[2].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.ok(results[1].reason instanceof AssetUnavailableError);
  assert.equal(results[1].reason.status, 404);
});

test("an id the server left out of its answer is treated as unavailable", async () => {
  const batcher = createAssetUrlBatcher({ fetchBatch: async () => ({ items: [] }) });
  await assert.rejects(batcher.request("t", "ws", "A"), AssetUnavailableError);
});

test("a failed request rejects every caller in that request with the failure", async () => {
  const batcher = createAssetUrlBatcher({ fetchBatch: async () => { throw new Error("network down"); } });

  const results = await Promise.allSettled([batcher.request("t", "ws", "A"), batcher.request("t", "ws", "B")]);

  assert.ok(results.every((r) => r.status === "rejected" && /network down/.test(r.reason.message)));
});

test("different users or workspaces are never mixed in one request", async () => {
  const calls = [];
  const batcher = createAssetUrlBatcher({ fetchBatch: async (token, slug, ids) => { calls.push(`${token}|${slug}|${ids.join(",")}`); return { items: ids.map(ok) }; } });

  await Promise.all([batcher.request("alice", "ws1", "A"), batcher.request("bob", "ws1", "B"), batcher.request("alice", "ws2", "C")]);

  assert.deepEqual(calls.sort(), ["alice|ws1|A", "alice|ws2|C", "bob|ws1|B"]);
});

test("asks made after a flush start a new request", async () => {
  const calls = [];
  const batcher = createAssetUrlBatcher({ fetchBatch: async (_t, _s, ids) => { calls.push(ids); return { items: ids.map(ok) }; } });

  await batcher.request("t", "ws", "A");
  await tick();
  await batcher.request("t", "ws", "B");

  assert.deepEqual(calls, [["A"], ["B"]]);
});
