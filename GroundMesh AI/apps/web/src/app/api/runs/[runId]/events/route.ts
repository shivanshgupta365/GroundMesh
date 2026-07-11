import { getStore } from "@groundmesh/runtime";

import { clientEvent, ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL = new Set(["completed", "needs_review", "failed", "cancelled"]);

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const id = await workspaceId();
  await ensureDemoWorkspace(id);
  const runId = (await context.params).runId;
  const store = await getStore();
  const encoder = new TextEncoder();
  let after = Number(request.headers.get("Last-Event-ID") ?? new URL(request.url).searchParams.get("after") ?? 0);

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (value: string) => controller.enqueue(encoder.encode(value));
        const timer = setInterval(() => send(`: heartbeat ${Date.now()}\n\n`), 10_000);
        try {
          for (;;) {
            const events = await store.listRunEvents(id, runId, after);
            for (const event of events) {
              after = event.sequence;
              const payload = clientEvent(event);
              send(`id: ${event.sequence}\nevent: ${event.event_type}\ndata: ${JSON.stringify(payload)}\n\n`);
            }
            const run = await store.getRun(id, runId);
            if (!run || TERMINAL.has(run.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
        } finally {
          clearInterval(timer);
          controller.close();
        }
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    },
  );
}

