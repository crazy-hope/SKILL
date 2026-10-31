import test from "node:test";
import assert from "node:assert/strict";
import { makeTask, canGenerate, batchCandidates, generateRequest } from "../src/workbench.js";
test("image-only creation is allowed but loading, missing service and invalid duration are blocked", () => {
  const t = makeTask(1, () => {});
  const c = { ready: true };
  assert.equal(canGenerate(t, c), false);
  t.image = "data:image/png";
  assert.equal(canGenerate(t, c), true);
  t.imageLoading = true;
  assert.equal(canGenerate(t, c), false);
  t.imageLoading = false;
  t.input.duration = null;
  assert.equal(canGenerate(t, c), false);
  t.input.duration = 5;
  assert.equal(canGenerate(t, { ready: false }), false);
});
test("duplicate preserves input and image but owns an independent lifecycle", async () => {
  const a = makeTask(1, () => {});
  a.image = "image";
  a.input.details.action = "向左";
  await a.generation.run(async () => ({ result: {} }));
  const b = makeTask(2, () => {}, a);
  b.input.details.action = "向右";
  assert.equal(a.input.details.action, "向左");
  assert.equal(b.image, "image");
  assert.equal(b.generation.record, null);
});
test("batch skips completed and failed entries, includes edited and empty-idea entries", async () => {
  const tasks = [1, 2, 3].map((id) => makeTask(id, () => {}));
  tasks.forEach((t) => (t.image = "image"));
  await tasks[0].generation.run(async () => ({ result: {} }));
  await tasks[1].generation.run(async () => {
    throw Error("bad");
  });
  assert.deepEqual(
    batchCandidates(tasks, { ready: true }).map((t) => t.id),
    [3],
  );
  tasks[0].generation.changed();
  assert.deepEqual(
    batchCandidates(tasks, { ready: true }).map((t) => t.id),
    [1, 3],
  );
});


test("cancel during upload cleans up the eventual job without polling or generating again", async t => {
  const submitted = Promise.withResolvers();
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push([url, options.method]);
    if (url === "/api/generate-jobs") return submitted.promise;
    return Response.json({ cancelled: true });
  });
  const controller = new AbortController();
  const running = generateRequest({ idea: "A" }, controller.signal);
  controller.abort();
  submitted.resolve(Response.json({ id: "test-job" }));
  await assert.rejects(running, { name: "AbortError" });
  assert.deepEqual(calls, [["/api/generate-jobs", "POST"], ["/api/generate-jobs/test-job", "DELETE"]]);
});

test("failed job reports its error and is released without automatic retry", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push([url, options.method]);
    return Response.json(url === "/api/generate-jobs" ? { id: "test-job" }
      : options.method === "DELETE" ? { cancelled: true }
      : { status: "failed", error: { message: "模拟限流" } });
  });
  await assert.rejects(generateRequest({}, new AbortController().signal), /模拟限流/);
  assert.deepEqual(calls.map(x => x[1]), ["POST", "POST", "DELETE"]);
});
