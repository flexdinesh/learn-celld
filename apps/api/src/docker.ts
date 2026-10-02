import http from "node:http";
import { z } from "zod";
import type { NodeId } from "@lab/contracts";

function dockerRequest(path: string, method = "GET"): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath: process.env.DOCKER_SOCKET ?? "/var/run/docker.sock",
        path,
        method,
        timeout: 35000,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode ?? 500) >= 400)
            reject(new Error(`Docker ${response.statusCode}: ${body}`));
          else resolve(body);
        });
      },
    );
    request.on("timeout", () =>
      request.destroy(new Error("Docker request timed out")),
    );
    request.on("error", reject);
    request.end();
  });
}

export async function controlNode(
  id: NodeId,
  action: "stop" | "start" | "kill",
): Promise<void> {
  const name = `celld-lab-${id}`;
  const inspect = z
    .object({
      Config: z.object({ Labels: z.record(z.string(), z.string()).nullable() }),
    })
    .parse(JSON.parse(await dockerRequest(`/containers/${name}/json`)));
  if (inspect.Config.Labels?.["dev.celld.lab"] !== "true")
    throw new Error("Container is not owned by this lab");
  const query =
    action === "stop" ? "?t=30" : action === "kill" ? "?signal=SIGKILL" : "";
  await dockerRequest(`/containers/${name}/${action}${query}`, "POST");
}
