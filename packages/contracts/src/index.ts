import { z } from "zod";

export const nodeId = z.enum(["node-a", "node-b", "node-c"]);
export type NodeId = z.infer<typeof nodeId>;
export const cellName = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const operation = z.enum(["read", "increment", "alarm"]);
export const requestSchema = z.object({
  cell: cellName,
  ingress: nodeId,
  operation,
  count: z.number().int().min(1).max(100).default(1),
  delayMs: z.number().int().min(1000).max(30000).default(5000),
});
export const cellResultSchema = z.object({
  cell: z.string(),
  id: z.string(),
  value: z.number(),
  revision: z.number(),
  bootId: z.string(),
  bootedAt: z.number(),
  alarmAt: z.number().nullable(),
  alarmFires: z.number(),
  lastAlarmAt: z.number().nullable(),
  events: z.array(
    z.object({
      revision: z.number(),
      kind: z.string(),
      at: z.number(),
      value: z.number(),
    }),
  ),
});
export type CellResult = z.infer<typeof cellResultSchema>;
export const traceSchema = z.object({
  id: z.string(),
  at: z.number(),
  cell: z.string(),
  ingress: nodeId,
  operation,
  durationMs: z.number(),
  status: z.number(),
  result: cellResultSchema.optional(),
  error: z.string().optional(),
  ownerBefore: z.string().nullable(),
  ownerAfter: z.string().nullable(),
});
export type Trace = z.infer<typeof traceSchema>;
export const nodeSchema = z.object({
  id: nodeId,
  reachable: z.boolean(),
  ready: z.boolean(),
  error: z.string().optional(),
  state: z.record(z.string(), z.unknown()).nullable(),
});
export const objectSchema = z.object({
  key: z.string(),
  size: z.number(),
  modified: z.string().nullable(),
});
export const ownerSchema = z.object({
  cellId: z.string(),
  node: z.string(),
  epoch: z.number(),
});
export const snapshotSchema = z.object({
  at: z.number(),
  nodes: z.array(nodeSchema),
  objects: z.array(objectSchema),
  owners: z.array(ownerSchema),
  traces: z.array(traceSchema),
  bucket: z.object({
    reachable: z.boolean(),
    truncated: z.boolean(),
    error: z.string().optional(),
  }),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type LabRequest = z.infer<typeof requestSchema>;
export const batchSchema = z.object({ traces: z.array(traceSchema) });
