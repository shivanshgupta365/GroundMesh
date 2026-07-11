// src/index.ts
import { drainOutbox, processRun } from "@groundmesh/runtime";
import { createServer } from "http";
var port = Number(process.env.PORT ?? 8080);
async function handle(request) {
  const url = new URL(request.url);
  if (url.pathname === "/healthz") return Response.json({ ok: true });
  const sharedSecret = process.env.WORKER_SHARED_SECRET?.trim();
  if (sharedSecret && request.headers.get("x-groundmesh-worker-secret") !== sharedSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (request.method === "POST" && url.pathname === "/tasks/process-run") {
    const body = await request.json().catch(() => ({}));
    if (!body.workspace_id || !body.run_id) {
      return Response.json({ error: "workspace_id and run_id are required" }, { status: 400 });
    }
    await processRun(body.run_id, body.workspace_id);
    return Response.json({ ok: true });
  }
  if (request.method === "POST" && url.pathname === "/tasks/drain") {
    return Response.json({ completed: await drainOutbox() });
  }
  return Response.json({ error: "not found" }, { status: 404 });
}
createServer((incoming, outgoing) => {
  const chunks = [];
  incoming.on("data", (chunk) => chunks.push(chunk));
  incoming.on("end", async () => {
    try {
      const request = new Request(`http://localhost${incoming.url ?? "/"}`, {
        method: incoming.method ?? "GET",
        headers: incoming.headers,
        body: chunks.length ? Buffer.concat(chunks) : null
      });
      const response = await handle(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(500, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : "worker error" }));
    }
  });
}).listen(port);
