import { getStore } from "@groundmesh/runtime";

import { errorResponse, jsonData } from "@/lib/api-response";
import { ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ sourceId: string }> }) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const source = await (await getStore()).getSource(id, (await context.params).sourceId);
    if (!source) throw new Error("Source not found");
    return jsonData(source);
  } catch (error) {
    return errorResponse(error);
  }
}

