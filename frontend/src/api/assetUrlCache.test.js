import { test } from "node:test";
import assert from "node:assert/strict";
import { createAssetUrlCache } from "./assetUrlCache.js";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; }, iso: (msFromNow) => new Date(t + msFromNow).toISOString() };
}

test("a fetched URL is reused until 60 s before it expires", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  let calls = 0;
  const fetcher = async () => ({ url: `/u${++calls}`, expiresAt: c.iso(10 * 60_000) });

  assert.equal((await cache.get("k", fetcher)).url, "/u1");
  c.advance(9 * 60_000 - 1_000); // 8:59 in — still 61 s of life left
  assert.equal((await cache.get("k", fetcher)).url, "/u1");
  assert.equal(calls, 1);

  c.advance(2_000); // now inside the 60 s skew
  assert.equal((await cache.get("k", fetcher)).url, "/u2");
  assert.equal(calls, 2);
});

test("concurrent asks for the same asset make exactly one request", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetcher = async () => { calls++; await gate; return { url: "/shared", expiresAt: c.iso(600_000) }; };

  const asks = Array.from({ length: 8 }, () => cache.get("k", fetcher));
  release();
  const results = await Promise.all(asks);

  assert.equal(calls, 1);
  assert.ok(results.every((r) => r.url === "/shared"));
});

test("different keys never share an entry", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  const make = (url) => async () => ({ url, expiresAt: c.iso(600_000) });

  assert.equal((await cache.get("alice|a", make("/alice"))).url, "/alice");
  assert.equal((await cache.get("bob|a", make("/bob"))).url, "/bob");
  assert.equal((await cache.get("alice|a", make("/should-not-be-called"))).url, "/alice");
});

test("a failed request is not remembered and the next ask retries", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  let calls = 0;
  const flaky = async () => {
    if (++calls === 1) throw new Error("403");
    return { url: "/ok", expiresAt: c.iso(600_000) };
  };

  await assert.rejects(cache.get("k", flaky), /403/);
  assert.equal((await cache.get("k", flaky)).url, "/ok");
  assert.equal(calls, 2);
});

test("a fetcher that throws synchronously still rejects cleanly and does not wedge the key", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  await assert.rejects(cache.get("k", () => { throw new Error("boom"); }), /boom/);
  assert.equal((await cache.get("k", async () => ({ url: "/fine", expiresAt: c.iso(600_000) }))).url, "/fine");
});

test("every concurrent caller of a failing request sees the failure, and a later ask retries", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  let calls = 0;
  const fail = async () => { calls++; throw new Error("nope"); };

  const results = await Promise.allSettled([cache.get("k", fail), cache.get("k", fail), cache.get("k", fail)]);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(calls, 1);

  await assert.rejects(cache.get("k", fail));
  assert.equal(calls, 2);
});

test("invalidate forces a new request; clear drops everything", async () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  let calls = 0;
  const fetcher = async () => ({ url: `/u${++calls}`, expiresAt: c.iso(600_000) });

  await cache.get("a", fetcher);
  cache.invalidate("a");
  assert.equal((await cache.get("a", fetcher)).url, "/u2");

  await cache.get("b", fetcher);
  cache.clear();
  assert.equal((await cache.get("a", fetcher)).url, "/u4");
});

test("msUntilRefresh is the time left minus the skew, never negative", () => {
  const c = clock();
  const cache = createAssetUrlCache({ now: c.now });
  assert.equal(cache.msUntilRefresh(c.now() + 10 * 60_000), 9 * 60_000);
  assert.equal(cache.msUntilRefresh(c.now() + 30_000), 0);
  assert.equal(cache.msUntilRefresh(c.now() - 5_000), 0);
});
