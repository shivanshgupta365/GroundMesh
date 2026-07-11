import { getStore } from "@groundmesh/runtime";

import { errorResponse, jsonData } from "@/lib/api-response";
import { clientReview, ensureDemoWorkspace, workspaceId } from "@/lib/runtime-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const id = await workspaceId();
    await ensureDemoWorkspace(id);
    const reviews = await (await getStore()).listReviews(id);
    return jsonData(reviews.map(clientReview));
  } catch (error) {
    return errorResponse(error);
  }
}

