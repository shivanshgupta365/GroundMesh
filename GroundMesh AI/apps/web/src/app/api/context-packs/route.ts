import { errorResponse, jsonData } from "@/lib/api-response";
import { composePackForWorkspace, ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    return jsonData(await composePackForWorkspace(id, await request.json().catch(() => ({}))));
  } catch (error) {
    return errorResponse(error);
  }
}

