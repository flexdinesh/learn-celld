import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import {
  batchSchema,
  snapshotSchema,
  nodeId,
  type CellResult,
  type NodeId,
  type LabRequest,
} from "../packages/contracts/src/index.ts";

const base = process.env.LAB_URL ?? "http://localhost:5173";
const prefix = `test-${Date.now()}`;
async function api(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(
    response.ok,
    true,
    `${path} returned ${response.status}: ${response.ok ? "" : await response.text()}`,
  );
  return response.json();
}
async function send(
  cell: string,
  ingress: NodeId,
  operation: LabRequest["operation"],
  count = 1,
  delayMs = 5000,
): Promise<CellResult[]> {
  const results = batchSchema.parse(
    await api("/api/requests", { cell, ingress, operation, count, delayMs }),
  ).traces;
  assert.equal(results.length, count);
  return results.map((trace) => {
    assert.equal(trace.status, 200, trace.error);
    assert.ok(trace.result);
    return trace.result;
  });
}
async function read(
  cell: string,
  ingress: NodeId = "node-b",
): Promise<CellResult> {
  const result = (await send(cell, ingress, "read"))[0];
  assert.ok(result);
  return result;
}
async function readAfterFailure(
  cell: string,
  ingress: NodeId,
): Promise<CellResult> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const trace = batchSchema.parse(
      await api("/api/requests", { cell, ingress, operation: "read" }),
    ).traces[0];
    assert.ok(trace);
    if (trace.result) return trace.result;
    assert.ok([502, 503, 504].includes(trace.status), trace.error);
    console.log(`Transient recovery read: ${trace.status} ${trace.error}`);
    await setTimeout(2000);
  }
  throw new Error(
    "Cell did not recover within 60 seconds while its owner stayed stopped",
  );
}
console.log("Checking live fleet + MinIO");
const initial = snapshotSchema.parse(await api("/api/snapshot"));
assert.equal(initial.nodes.filter((n) => n.ready).length, 3);
assert.equal(initial.bucket.reachable, true);

console.log("100 concurrent writers across all three ingress nodes");
const counter = `${prefix}-shared`;
const baseline = await read(counter, "node-a");
const writes = (
  await Promise.all(
    nodeId.options.map((id, i) =>
      send(counter, id, "increment", i === 0 ? 34 : 33),
    ),
  )
).flat();
assert.equal(new Set(writes.map((r) => r.revision)).size, 100);
const final = await read(counter);
assert.equal(final.value, baseline.value + 100);
assert.equal(final.revision, baseline.revision + 100);
assert.equal(final.events.length, 20);
const observed = snapshotSchema.parse(await api("/api/snapshot"));
assert.ok(
  observed.owners.find((o) => o.cellId === `LabCell:${final.id}` && o.node),
);

console.log("Independent databases for different names");
const other = `${prefix}-other`;
assert.equal((await read(other)).value, 0);
await send(other, "node-c", "increment");
assert.equal((await read(other)).value, 1);
assert.equal((await read(counter)).value, 100);

console.log("Alarm rescheduling replaces a pending installation");
const alarm = `${prefix}-alarm`;
await send(alarm, "node-a", "alarm", 1, 1000);
await send(alarm, "node-b", "alarm", 1, 5000);
await setTimeout(2000);
assert.equal((await read(alarm)).value, 0, "Old alarm fired after replacement");
await setTimeout(4000);
const alarmResult = await read(alarm);
assert.equal(alarmResult.value, 10);
assert.equal(alarmResult.alarmFires, 1);
assert.equal(alarmResult.alarmAt, null);

console.log("Idle eviction reconstructs runtime and preserves SQLite");
const idle = `${prefix}-idle`;
const beforeIdle = (await send(idle, "node-c", "increment"))[0];
assert.ok(beforeIdle);
await setTimeout(27000);
const afterIdle = await read(idle);
assert.equal(afterIdle.value, 1);
assert.notEqual(afterIdle.bootId, beforeIdle.bootId);

console.log("Crash owner; recover acknowledged value through a survivor");
const durable = `${prefix}-durable`;
const beforeCrash = (await send(durable, "node-a", "increment"))[0];
assert.ok(beforeCrash);
const beforeSnapshot = snapshotSchema.parse(await api("/api/snapshot"));
const owner = beforeSnapshot.owners.find(
  (o) => o.cellId === `LabCell:${beforeCrash.id}`,
);
assert.ok(owner);
const crashed = nodeId.parse(owner.node);
const survivor = nodeId.options.find((id) => id !== crashed);
assert.ok(survivor);
try {
  await api(`/api/nodes/${crashed}/kill`, {});
  await setTimeout(12000);
  const recovered = await readAfterFailure(durable, survivor);
  assert.equal(recovered.value, beforeCrash.value);
  assert.equal(recovered.revision, beforeCrash.revision);
  assert.notEqual(recovered.bootId, beforeCrash.bootId);
  const afterSnapshot = snapshotSchema.parse(await api("/api/snapshot"));
  const newOwner = afterSnapshot.owners.find((o) => o.cellId === owner.cellId);
  assert.ok(newOwner);
  assert.notEqual(newOwner.node, crashed);
  assert.ok(newOwner.epoch > owner.epoch);
} finally {
  await api(`/api/nodes/${crashed}/start`, {});
}

console.log("Graceful stop hands off acknowledged state");
for (let i = 0; i < 20; i++) {
  const current = snapshotSchema.parse(await api("/api/snapshot"));
  if (current.nodes.every((n) => n.ready)) break;
  await setTimeout(1000);
}
const graceful = `${prefix}-graceful`;
const beforeStop = (await send(graceful, "node-c", "increment"))[0];
assert.ok(beforeStop);
const stopSnapshot = snapshotSchema.parse(await api("/api/snapshot"));
const stopOwner = stopSnapshot.owners.find(
  (o) => o.cellId === `LabCell:${beforeStop.id}`,
);
assert.ok(stopOwner);
const stopped = nodeId.parse(stopOwner.node);
const healthy = nodeId.options.find((id) => id !== stopped);
assert.ok(healthy);
try {
  await api(`/api/nodes/${stopped}/stop`, {});
  assert.equal((await read(graceful, healthy)).value, beforeStop.value);
} finally {
  await api(`/api/nodes/${stopped}/start`, {});
}
console.log(
  "PASS: routing, concurrency, isolation, alarms, eviction, crash recovery, graceful handoff",
);
