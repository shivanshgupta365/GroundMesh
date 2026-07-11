import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { SessionRequiredError } from "./session";

export function jsonData<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function apiError(
  status: number,
  code: string,
  message: string,
  retryable = false,
  details?: unknown,
): NextResponse {
  const body: Record<string, unknown> = {
    error: { code, message, retryable, ...(details === undefined ? {} : { details }) },
    request_id: randomUUID(),
  };
  return NextResponse.json(body, { status });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof SessionRequiredError) {
    return apiError(401, error.code, error.message, false);
  }
  if (error instanceof z.ZodError) {
    return apiError(400, "VALIDATION_ERROR", "The request did not match the API contract.", false, {
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const isNotFound = /not found/i.test(message);
  return apiError(
    isNotFound ? 404 : 500,
    isNotFound ? "NOT_FOUND" : "INTERNAL_ERROR",
    message,
    !isNotFound,
  );
}
