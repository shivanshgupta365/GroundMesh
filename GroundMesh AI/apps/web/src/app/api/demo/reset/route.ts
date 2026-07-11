import { getStore } from "@groundmesh/runtime";

import { errorResponse, jsonData } from "@/lib/api-response";
import { workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonData(await (await getStore()).resetWorkspace(await workspaceId(), { seed: true, name: "GroundMesh Demo" }));
  } catch (error) {
    return errorResponse(error);
  }
}
