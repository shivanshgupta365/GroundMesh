import { getStore } from "@groundmesh/runtime";

import { errorResponse, jsonData } from "@/lib/api-response";
import { ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const run = await (await getStore()).getRun(id, (await context.params).runId);
    if (!run) throw new Error("Run not found");
    return jsonData(run);
  } catch (error) {
    return errorResponse(error);
  }
}

