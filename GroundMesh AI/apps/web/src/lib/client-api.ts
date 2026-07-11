export type ExecutionMode =
  | "live_antigravity"
  | "live_gemini_fallback"
  | "cached_demo";

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "needs_review"
  | "failed"
  | "cancelled";

export type MemoryStatus =
  | "candidate"
  | "active"
  | "disputed"
  | "stale"
  | "superseded"
  | "rejected";

export type GuardVerdict =
  | "ALLOW"
  | "ALLOW_WITH_WARNING"
  | "REQUIRE_APPROVAL"
  | "BLOCK";

export interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  fixtureVersion: string | null;
  truthStatus: "updating" | "needs_attention" | "verified";
  createdAt: string;
  updatedAt: string;
}

export interface SourceRow {
  id: string;
  workspaceId: string;
  type: string;
  externalId: string | null;
  title: string;
  body: string;
  sourceTimestamp: string | null;
  receivedAt: string;
  authorityProfileId: string;
  sourceHash: string;
  metadata: Record<string, unknown>;
}

export interface RunRow {
  id: string;
  workspaceId: string;
  sourceId: string | null;
  kind: string;
  status: RunStatus;
  executionMode: ExecutionMode;
  currentStep: string | null;
  attempt: number;
  cancellationRequested: boolean;
  safeSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface RunEventRow {
  id: string;
  schemaVersion: "1";
  workspaceId: string;
  runId: string;
  sequence: number;
  type: string;
  agent:
    | "orchestrator"
    | "maya"
    | "rook"
    | "vera"
    | "context_composer"
    | "action_guard"
    | "human";
  executionMode: ExecutionMode;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryAtomRow {
  id: string;
  workspaceId: string;
  sourceId: string;
  runId: string | null;
  entityId: string | null;
  kind: string;
  topic: string;
  subject: string;
  predicate: string;
  object: string;
  statement: string;
  status: MemoryStatus;
  authority: number;
  freshness: number;
  directness: number;
  corroboration: number;
  resolutionScore: number;
  confidence: number;
  validFrom: string | null;
  validUntil: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictRow {
  id: string;
  workspaceId: string;
  runId: string | null;
  topic: string;
  leftMemoryId: string;
  rightMemoryId: string;
  winnerMemoryId: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "needs_review" | "dismissed";
  reason: string;
  resolution: string | null;
  scoreGap: number | null;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

export interface ContextPackRow {
  id: string;
  workspaceId: string;
  runId: string | null;
  agent: string;
  purpose: string;
  summary: string;
  confidence: number;
  status: "active" | "verified" | "verified_with_warning" | "needs_review" | "expired" | "invalidated";
  expiresAt: string;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GuardDecisionRow {
  id: string;
  workspaceId: string;
  contextPackId: string;
  runId: string | null;
  verdict: GuardVerdict;
  proposedAction: string;
  canonicalClaim: string | null;
  prohibitedClaim: string | null;
  governingMemoryId: string | null;
  confidence: number;
  explanation: string;
  citations: unknown[];
  executionMode: ExecutionMode;
  simulated: boolean;
  createdAt: string;
  recommendedAction?: string | null;
  reviewId?: string | null;
}

export interface HumanReviewRow {
  id: string;
  workspaceId: string;
  subjectType: "conflict" | "guard_decision" | "correction";
  subjectId: string;
  status:
    | "pending"
    | "approved"
    | "edited"
    | "rejected"
    | "more_evidence_requested";
  requestedBy: RunEventRow["agent"];
  proposedWording: string | null;
  resolvedWording: string | null;
  rationale: string | null;
  resolutionSourceId: string | null;
  resolutionMemoryId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  workspace: WorkspaceRow;
  sources: SourceRow[];
  runs: RunRow[];
  events: RunEventRow[];
  memories: MemoryAtomRow[];
  conflicts: ConflictRow[];
  contextPacks: ContextPackRow[];
  guardDecisions: GuardDecisionRow[];
  reviews: HumanReviewRow[];
  counts: {
    openConflicts: number;
    staleMemories: number;
    pendingReviews: number;
    activeRuns: number;
  };
}

export interface AccessStatus {
  authenticated: boolean;
  workspace_id?: string;
  access_required: boolean;
}

export interface IngestEventInput {
  source_type: string;
  author?: string;
  title?: string;
  content: string;
  source_timestamp: string;
  linked_entities?: string[];
  metadata?: Record<string, unknown>;
}

export class ClientApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(message: string, code = "REQUEST_FAILED", retryable = false, requestId: string | null = null) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrap<T>(value: unknown): T {
  if (isRecord(value) && "data" in value) return value.data as T;
  return value as T;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const outer = isRecord(payload) ? payload : {};
    const error = isRecord(outer.error) ? outer.error : outer;
    throw new ClientApiError(
      typeof error.message === "string" ? error.message : `Request failed (${response.status})`,
      typeof error.code === "string" ? error.code : `HTTP_${response.status}`,
      error.retryable === true,
      typeof outer.request_id === "string" ? outer.request_id : null,
    );
  }

  return unwrap<T>(payload);
}

export function getAccessStatus(): Promise<AccessStatus> {
  return apiRequest<AccessStatus>("/api/session/access");
}

export function requestAccess(code: string): Promise<AccessStatus> {
  return apiRequest<AccessStatus>("/api/session/access", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  return apiRequest<WorkspaceSnapshot>("/api/workspace/snapshot");
}

export function getSource(sourceId: string): Promise<SourceRow> {
  return apiRequest<SourceRow>(`/api/sources/${encodeURIComponent(sourceId)}`);
}

export function ingestEvent(input: IngestEventInput): Promise<{
  source: SourceRow;
  run: RunRow;
  deduplicated?: boolean;
}> {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `gm-${Date.now()}`;
  return apiRequest("/api/events/ingest", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function resetDemo(): Promise<WorkspaceSnapshot | { reset: true }> {
  return apiRequest("/api/demo/reset", { method: "POST", body: "{}" });
}

export function retryRun(runId: string): Promise<RunRow> {
  return apiRequest(`/api/runs/${encodeURIComponent(runId)}/retry`, {
    method: "POST",
    body: "{}",
  });
}

export function cancelRun(runId: string): Promise<RunRow> {
  return apiRequest(`/api/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    body: "{}",
  });
}

export function createContextPack(): Promise<ContextPackRow> {
  return apiRequest("/api/context-packs", {
    method: "POST",
    body: JSON.stringify({
      requesting_agent: "support_agent",
      task: "reply_to_customer",
      scope: {
        customer: "Acme",
        project: "Enterprise SSO",
        topic: "release date",
      },
    }),
  });
}

export async function checkAction(
  contextPackId: string,
  proposedAction: string,
): Promise<GuardDecisionRow> {
  const response = await apiRequest<
    GuardDecisionRow | { guardDecision: GuardDecisionRow } | { decision: GuardDecisionRow }
  >("/api/actions/check", {
    method: "POST",
    body: JSON.stringify({
      context_pack_id: contextPackId,
      proposed_action: proposedAction,
    }),
  });
  if (isRecord(response) && "guardDecision" in response) {
    return response.guardDecision as GuardDecisionRow;
  }
  if (isRecord(response) && "decision" in response && isRecord(response.decision)) {
    return response.decision as unknown as GuardDecisionRow;
  }
  return response as GuardDecisionRow;
}

export function getReviews(): Promise<HumanReviewRow[]> {
  return apiRequest<HumanReviewRow[]>("/api/reviews");
}

export function resolveReview(
  reviewId: string,
  input: {
    decision: "approve" | "edit" | "reject" | "request_more_evidence";
    resolved_content?: string;
    rationale?: string;
  },
): Promise<HumanReviewRow> {
  return apiRequest(`/api/reviews/${encodeURIComponent(reviewId)}/resolve`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function subscribeToRun(
  runId: string,
  callbacks: {
    onEvent: (event: RunEventRow) => void;
    onError?: () => void;
  },
): () => void {
  const stream = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  const handleEvent = (message: MessageEvent<string>) => {
    try {
      callbacks.onEvent(JSON.parse(message.data) as RunEventRow);
    } catch {
      // Heartbeats and malformed provider messages are ignored; persisted replay
      // remains the source of truth and is refreshed at terminal events.
    }
  };

  stream.onmessage = handleEvent;
  for (const eventName of [
    "source_received",
    "agent_started",
    "agent_completed",
    "memory_extracted",
    "conflict_detected",
    "evidence_verified",
    "memory_superseded",
    "context_pack_ready",
    "action_blocked",
    "human_review_required",
    "human_approved",
    "run_completed",
    "run_failed",
    "run_cancelled",
  ]) {
    stream.addEventListener(eventName, handleEvent as EventListener);
  }
  stream.onerror = () => callbacks.onError?.();

  return () => stream.close();
}
