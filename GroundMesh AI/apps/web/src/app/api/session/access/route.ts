import { z } from "zod";

import { apiError, errorResponse, jsonData } from "@/lib/api-response";
import {
  accessCodeMatches,
  accessCodeRequired,
  createSession,
  readSession,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AccessRequestSchema = z.object({ code: z.string().optional().default("") }).strict();

export async function GET() {
  try {
    let session = await readSession();
    if (!session && !accessCodeRequired()) {
      session = await createSession();
    }
    return jsonData({
      authenticated: session !== null,
      ...(session ? { workspace_id: session.workspaceId } : {}),
      access_required: accessCodeRequired(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = AccessRequestSchema.parse(await request.json().catch(() => ({})));
    if (!accessCodeMatches(input.code)) {
      return apiError(401, "INVALID_ACCESS_CODE", "That access code is not valid.", false);
    }
    const session = (await readSession()) ?? (await createSession());
    return jsonData({
      authenticated: true,
      workspace_id: session.workspaceId,
      access_required: accessCodeRequired(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
