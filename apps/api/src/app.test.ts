import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";

test("health stays available without contacting the fleet", async () => {
  const app = createApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  } finally {
    await app.close();
  }
});

test("reject invalid requests before invoking a cell", async () => {
  const app = createApp();
  try {
    for (const payload of [
      { cell: "../escape", ingress: "node-a", operation: "increment" },
      { cell: "counter", ingress: "other-container", operation: "increment" },
      {
        cell: "counter",
        ingress: "node-a",
        operation: "increment",
        count: 101,
      },
      { cell: "counter", ingress: "node-a", operation: "increment", count: 0 },
      { cell: "counter", ingress: "node-a", operation: "delete" },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/requests",
        payload,
      });
      assert.equal(response.statusCode, 400);
    }
  } finally {
    await app.close();
  }
});

test("Docker control accepts only the three lab node IDs and known actions", async () => {
  const app = createApp();
  try {
    for (const url of ["/api/nodes/minio/kill", "/api/nodes/node-a/remove"]) {
      const response = await app.inject({ method: "POST", url });
      assert.equal(response.statusCode, 400);
    }
  } finally {
    await app.close();
  }
});
