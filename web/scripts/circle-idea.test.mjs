import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Exercise the same TypeScript modules as the demo without a backend or browser.
test("circle ideas follow the active demo circle and its saved memories", async (t) => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false, server: { middlewareMode: true, hmr: false } });
  t.after(() => server.close());
  globalThis.window = { setTimeout };
  t.after(() => { delete globalThis.window; });
  const { createMockApi } = await server.ssrLoadModule("/src/mockApi.ts");
  const { parseCircleIdea } = await server.ssrLoadModule("/src/types.ts");
  const demo = createMockApi({});
  const response = await demo.getCircleIdea();
  assert.deepEqual(parseCircleIdea(response), response);
  assert.equal(response.idea.person.id, "per_maya");
  assert.equal(response.idea.group.person.id, "con_jun");
  assert.match(response.idea.group.reason, /architecture/);
  assert.match(response.idea.reason, /Film photography/);
  assert.notEqual(response.idea.activity, response.idea.group.activity);
  assert.deepEqual(parseCircleIdea({ idea: { topic: "photography" } }), { idea: null });
  await demo.deletePerson("per_maya");
  const { idea } = await demo.getCircleIdea();
  assert.equal(idea.person.id, "con_jun");
  assert.equal(idea.group, null);
  for (const memory of await demo.listMemories()) await demo.deleteMemory(memory.memory_id);
  assert.deepEqual(await demo.getCircleIdea(), { idea: null });
});
