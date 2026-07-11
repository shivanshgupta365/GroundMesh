import { getStore } from "@groundmesh/runtime";

import { errorResponse, jsonData } from "@/lib/api-response";
import { ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const run = await (await getStore()).requestRunCancellation(id, (await context.params).runId);
    return jsonData(run);
  } catch (error) {
    return errorResponse(error);
  }
}

