import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  cellResultSchema,
  nodeId,
  requestSchema,
  type Trace,
  type Snapshot,
} from "@lab/contracts";
import {
  cellUrl,
  errorMessage,
  inspectBucket,
  inspectNode,
  nodes,
} from "./fleet";
import { controlNode } from "./docker";

export function createApp() {
  const app = Fastify({ logger: true, bodyLimit: 16384 });
  const traces: Trace[] = [];
  let snapshot: Snapshot = {
    at: Date.now(),
    nodes: [],
    objects: [],
    owners: [],
    traces: [],
    bucket: { reachable: false, truncated: false },
  };
  let refreshing: Promise<void> | undefined;
  async function refresh(): Promise<void> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const [fleet, bucket] = await Promise.all([
        Promise.all(nodes.map(inspectNode)),
        inspectBucket(),
      ]);
      snapshot = {
        at: Date.now(),
        nodes: fleet,
        ...bucket,
        traces: [...traces],
      };
    })().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  }
  const timer = setInterval(() => {
    void refresh().catch((error) => app.log.error(error));
  }, 2000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  app.setErrorHandler((error, _request, reply) => {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof Error &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
          ? error.statusCode
          : 500;
    reply.status(status).send({ error: errorMessage(error) });
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/snapshot", async () => {
    await refresh();
    return snapshot;
  });
  app.post("/api/requests", async (request) => {
    const input = requestSchema.parse(request.body);
    const ownerBefore =
      snapshot.owners.find(
        (o) =>
          o.cellId ===
          `LabCell:${traces.find((t) => t.cell === input.cell && t.result)?.result?.id}`,
      )?.node ?? null;
    // Each HTTP request is submitted once. An ambiguous response is never silently retried.
    const results = await Promise.all(
      Array.from({ length: input.count }, async () => {
        const start = performance.now();
        const at = Date.now();
        let failureStatus = 502;
        try {
          const response = await fetch(
            cellUrl(input.ingress, input.cell, input.operation, input.delayMs),
            {
              method: input.operation === "read" ? "GET" : "POST",
              signal: AbortSignal.timeout(25000),
            },
          );
          if (!response.ok) {
            failureStatus = response.status;
            throw new Error(
              `celld ${response.status}: ${(await response.text()).slice(0, 500)}`,
            );
          }
          const result = cellResultSchema.parse(await response.json());
          const trace: Trace = {
            id: randomUUID(),
            at,
            cell: input.cell,
            ingress: input.ingress,
            operation: input.operation,
            durationMs: Math.round(performance.now() - start),
            status: response.status,
            result,
            ownerBefore,
            ownerAfter: null,
          };
          return trace;
        } catch (error) {
          const trace: Trace = {
            id: randomUUID(),
            at,
            cell: input.cell,
            ingress: input.ingress,
            operation: input.operation,
            durationMs: Math.round(performance.now() - start),
            status: failureStatus,
            error: errorMessage(error),
            ownerBefore,
            ownerAfter: null,
          };
          return trace;
        }
      }),
    );
    await refresh();
    for (const trace of results) {
      trace.ownerAfter =
        snapshot.owners.find((o) => o.cellId === `LabCell:${trace.result?.id}`)
          ?.node ?? null;
    }
    traces.unshift(...results);
    traces.splice(200);
    snapshot.traces = [...traces];
    return { traces: results };
  });
  app.post("/api/nodes/:id/:action", async (request) => {
    const params = z
      .object({ id: nodeId, action: z.enum(["stop", "start", "kill"]) })
      .parse(request.params);
    await controlNode(params.id, params.action);
    await refresh();
    return { ok: true };
  });
  app.post("/api/traces/clear", async () => {
    traces.splice(0);
    snapshot.traces = [];
    return { ok: true };
  });
  return app;
}
