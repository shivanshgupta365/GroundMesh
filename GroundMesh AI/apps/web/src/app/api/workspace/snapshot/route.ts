import { errorResponse, jsonData } from "@/lib/api-response";
import { ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonData(await ensureDemoWorkspace(await workspaceId()));
  } catch (error) {
    return errorResponse(error);
  }
}

