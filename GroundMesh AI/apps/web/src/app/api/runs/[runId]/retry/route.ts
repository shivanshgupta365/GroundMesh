import { getStore } from "@groundmesh/runtime";

import { dispatchRun, ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";
import { errorResponse, jsonData } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const runId = (await context.params).runId;
    const run = await (await getStore()).setRunState(id, runId, {
      status: "queued",
      current_step: "source_received",
      safe_summary: "Run retry queued.",
      error_code: null,
      error_message: null,
      completed_at: null,
    });
    await dispatchRun(id, runId);
    return jsonData(run);
  } catch (error) {
    return errorResponse(error);
  }
}

