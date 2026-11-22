import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("fictional seats require matching opt-ins and independent consent", async t => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false, server: { middlewareMode: true, hmr: false } });
  t.after(() => server.close());
  const keys = new Map();
  globalThis.window = { localStorage: { getItem: k => keys.get(k), setItem: (k, v) => keys.set(k, v) } };
  t.after(() => { delete globalThis.window; });
  const { createOverlapDemo } = await server.ssrLoadModule("/src/mockOverlap.ts");
  const { parseOverlapState } = await server.ssrLoadModule("/src/types.ts");
  const a = createOverlapDemo("a"), b = createOverlapDemo("b"), spectator = createOverlapDemo();
  const { seoulWeek } = await server.ssrLoadModule("/src/overlapWindow.ts");
  const input = { area: "seongsu", date: seoulWeek()[1],
    slot: "afternoon", interests: ["walking"], adults_confirmed: true };
  assert.equal((await a.getOverlap()).match, null);
  assert.equal(keys.size, 0);
  await assert.rejects(spectator.optInOverlap(input));
  assert.equal((await a.optInOverlap(input)).match, null);
  assert.equal((await b.optInOverlap({ ...input, interests: ["books"] })).match, null);
  const offered = await b.optInOverlap(input);
  const id = offered.match.id;
  assert.equal(offered.match.status, "offered");
  assert.equal(parseOverlapState({ ...offered, match: { ...offered.match, other_name: "leak" } }).match.other_name, null);
  assert.equal(parseOverlapState({ ...offered, preference: { ...input, date: "2000-01-01" } }).match, null);
  const leaked = { label: "Hidden spot", status: "available" };
  assert.equal(parseOverlapState({ ...offered, match: { ...offered.match, meeting_point: leaked } }).match.meeting_point, null);
  await assert.rejects(a.respondOverlap(id, "suggest_spot"));
  const waiting = await a.respondOverlap(id, "yes");
  assert.equal((await a.optInOverlap(input)).match.id, id);
  assert.equal((await a.getOverlap()).match.status, "waiting");
  assert.equal(waiting.match.other_name, null);
  assert.equal(waiting.match.meeting_point, null);
  await assert.rejects(a.respondOverlap(id, "suggest_spot"));
  assert.equal((await b.getOverlap()).match.status, "offered");
  assert.equal((await b.respondOverlap(id, "yes")).match.other_name, "Demo Robin");
  assert.equal((await a.getOverlap()).match.other_name, "Demo Wren");
  const introduced = await a.getOverlap();
  assert.equal(parseOverlapState(introduced).match.meeting_point.status, "available");
  assert.equal(parseOverlapState({ ...introduced, match: { ...introduced.match, meeting_point: { ...leaked, status: "invalid" } } }).match.meeting_point, null);
  assert.equal((await a.respondOverlap(id, "suggest_spot")).match.meeting_point.status, "suggested_by_you");
  assert.equal((await a.respondOverlap(id, "suggest_spot")).match.meeting_point.status, "suggested_by_you");
  assert.equal((await b.getOverlap()).match.meeting_point.status, "suggested_to_you");
  assert.equal((await b.respondOverlap(id, "suggest_spot")).match.meeting_point.status, "agreed");
  assert.equal((await a.getOverlap()).match.meeting_point.status, "agreed");
  const realNow = Date.now;
  try {
    Date.now = () => Date.parse(`${input.date}T18:00:00+09:00`);
    for (const seat of [a, b]) assert.deepEqual(await seat.getOverlap(), { preference: null, match: null });
    await assert.rejects(a.respondOverlap(id, "yes"));
  } finally { Date.now = realNow; }
  await b.withdrawOverlap();
  assert.equal((await a.getOverlap()).match, null);
  const next = await b.optInOverlap(input);
  assert.equal(next.match.status, "offered");
  assert.equal(next.match.meeting_point, null);
  await assert.rejects(a.respondOverlap(id, "yes"));
  await a.reportOverlap(next.match.id, "safety");
  assert.equal((await b.optInOverlap(input)).match, null);
});
