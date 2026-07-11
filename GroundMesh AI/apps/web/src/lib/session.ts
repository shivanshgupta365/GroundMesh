import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const COOKIE_NAME = "groundmesh_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

interface SessionPayload {
  sessionId: string;
  workspaceId: string;
  expiresAt: number;
}

export interface GroundMeshSession {
  sessionId: string;
  workspaceId: string;
  expiresAt: Date;
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production");
  }
  return "groundmesh-local-session-secret-change-before-deploy";
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function serializeSession(payload: SessionPayload): string {
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function parseSession(value: string | undefined): GroundMeshSession | null {
  if (!value) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra || !constantTimeEqual(signature, sign(encoded))) {
    return null;
  }

  try {
    const payload = JSON.parse(decode(encoded)) as Partial<SessionPayload>;
    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.workspaceId !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return {
      sessionId: payload.sessionId,
      workspaceId: payload.workspaceId,
      expiresAt: new Date(payload.expiresAt),
    };
  } catch {
    return null;
  }
}

export function accessCodeRequired(): boolean {
  return Boolean(process.env.GROUND_MESH_ACCESS_CODE?.trim());
}

export function accessCodeMatches(candidate: string): boolean {
  const expected = process.env.GROUND_MESH_ACCESS_CODE?.trim();
  if (!expected) return true;
  return constantTimeEqual(candidate, expected);
}

export async function readSession(): Promise<GroundMeshSession | null> {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function createSession(): Promise<GroundMeshSession> {
  const now = Date.now();
  const payload: SessionPayload = {
    sessionId: randomUUID(),
    workspaceId: randomUUID(),
    expiresAt: now + SESSION_TTL_SECONDS * 1_000,
  };
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, serializeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return {
    sessionId: payload.sessionId,
    workspaceId: payload.workspaceId,
    expiresAt: new Date(payload.expiresAt),
  };
}

export async function requireSession(): Promise<GroundMeshSession> {
  const session = await readSession();
  if (!session) {
    throw new SessionRequiredError();
  }
  return session;
}

export class SessionRequiredError extends Error {
  readonly code = "SESSION_REQUIRED";

  constructor() {
    super("A valid GroundMesh session is required.");
    this.name = "SessionRequiredError";
  }
}
