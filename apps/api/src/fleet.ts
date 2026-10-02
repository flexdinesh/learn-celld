import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { nodeId, type NodeId, type Snapshot } from "@lab/contracts";

export const nodes = nodeId.options;
const hosts: Record<NodeId, string> = {
  "node-a": process.env.NODE_A_URL ?? "http://localhost:9876",
  "node-b": process.env.NODE_B_URL ?? "http://localhost:9877",
  "node-c": process.env.NODE_C_URL ?? "http://localhost:9878",
};
const internal: Record<NodeId, string> = {
  "node-a": process.env.NODE_A_INTERNAL ?? "http://localhost:9886",
  "node-b": process.env.NODE_B_INTERNAL ?? "http://localhost:9887",
  "node-c": process.env.NODE_C_INTERNAL ?? "http://localhost:9888",
};
const Bucket = process.env.S3_BUCKET ?? "celld-lab";
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "celldlab",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "celldlab-secret",
  },
  requestHandler: { requestTimeout: 3000, connectionTimeout: 2000 },
  maxAttempts: 1,
});
export const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.cause instanceof Error
      ? `${error.message}: ${error.cause.message}`
      : error.message
    : String(error);

export function cellUrl(
  node: NodeId,
  cell: string,
  operation: string,
  delayMs: number,
): string {
  const url = new URL(`/${operation}`, hosts[node]);
  url.searchParams.set("cell", cell);
  url.searchParams.set("delayMs", String(delayMs));
  return url.toString();
}

export async function inspectNode(
  id: NodeId,
): Promise<Snapshot["nodes"][number]> {
  try {
    const [response, health] = await Promise.all([
      fetch(`${internal[id]}/state`, { signal: AbortSignal.timeout(2500) }),
      fetch(`${hosts[id]}/.well-known/celld/health`, {
        signal: AbortSignal.timeout(2500),
      }),
    ]);
    if (!response.ok)
      throw new Error(`Operator API returned ${response.status}`);
    await health.arrayBuffer();
    return {
      id,
      reachable: true,
      ready: health.ok,
      state: z.record(z.string(), z.unknown()).parse(await response.json()),
    };
  } catch (error) {
    return {
      id,
      reachable: false,
      ready: false,
      state: null,
      error: errorMessage(error),
    };
  }
}

export async function inspectBucket(): Promise<
  Pick<Snapshot, "objects" | "owners" | "bucket">
> {
  try {
    const result = await s3.send(
      new ListObjectsV2Command({ Bucket, MaxKeys: 1000 }),
    );
    const objects = (result.Contents ?? []).flatMap((o) =>
      o.Key
        ? [
            {
              key: o.Key,
              size: o.Size ?? 0,
              modified: o.LastModified?.toISOString() ?? null,
            },
          ]
        : [],
    );
    const owners = await Promise.all(
      objects
        .filter((o) => o.key.endsWith("/own.json"))
        .slice(0, 100)
        .map(async (o) => {
          const result = await s3.send(
            new GetObjectCommand({ Bucket, Key: o.key }),
          );
          const value = z
            .object({ node: z.string(), epoch: z.number() })
            .parse(
              JSON.parse((await result.Body?.transformToString()) ?? "{}"),
            );
          return {
            cellId: o.key.slice("cells/".length, -"/own.json".length),
            ...value,
          };
        }),
    );
    return {
      objects,
      owners,
      bucket: { reachable: true, truncated: result.IsTruncated ?? false },
    };
  } catch (error) {
    return {
      objects: [],
      owners: [],
      bucket: {
        reachable: false,
        truncated: false,
        error: errorMessage(error),
      },
    };
  }
}
