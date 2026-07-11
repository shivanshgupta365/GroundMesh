import { getStore } from "@groundmesh/runtime";

import { errorResponse, jsonData } from "@/lib/api-response";
import { clientReview, ensureDemoWorkspace, parseReviewResolutionBody, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ reviewId: string }> }) {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const review = await (await getStore()).resolveReview(
      id,
      (await context.params).reviewId,
      parseReviewResolutionBody(await request.json().catch(() => ({}))),
    );
    return jsonData(clientReview(review));
  } catch (error) {
    return errorResponse(error);
  }
}

