import { getStore } from "@groundmesh/runtime";

import { apiError, errorResponse, jsonData } from "@/lib/api-response";
import { dispatchRun, ensureDemoWorkspace, parseIngestBody, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required.", false);
    }
    const result = await (await getStore()).ingestSource(
      id,
      parseIngestBody(await request.json().catch(() => ({}))),
      idempotencyKey,
    );
    await dispatchRun(id, result.run.id);
    return jsonData(result, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

