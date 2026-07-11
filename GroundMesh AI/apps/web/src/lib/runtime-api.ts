import {
  ContextPackRequestSchema,
  IngestEventRequestSchema,
  ProposedActionSchema,
  ReviewResolutionRequestSchema,
  type GuardDecision,
  type HumanReview,
  type RunEvent,
} from "@groundmesh/core";
import {
  buildGuardDecision,
  composeContextPack,
  getStore,
  processRun,
  type GuardDecisionRow,
  type HumanReviewRow,
  type RunEventRow,
  type SourceRow,
} from "@groundmesh/runtime";

import { requireSession } from "./session";

export async function workspaceId(): Promise<string> {
  return (await requireSession()).workspaceId;
}

export async function ensureDemoWorkspace(id: string) {
  const store = await getStore();
  const existing = await store.getWorkspace(id);
  if (!existing) return store.resetWorkspace(id, { seed: true, name: "GroundMesh Demo" });
  return store.getSnapshot(id);
}

export async function dispatchRun(workspaceIdValue: string, runId: string): Promise<void> {
  const workerUrl = process.env.WORKER_URL?.trim();
  if (workerUrl) {
    await fetch(new URL("/tasks/process-run", workerUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WORKER_SHARED_SECRET
          ? { "x-groundmesh-worker-secret": process.env.WORKER_SHARED_SECRET }
          : {}),
      },
      body: JSON.stringify({ workspace_id: workspaceIdValue, run_id: runId }),
    }).catch(() => undefined);
    return;
  }
  setTimeout(() => {
    void processRun(runId, workspaceIdValue).catch(() => undefined);
  }, 0);
}

export function parseIngestBody(value: unknown) {
  return IngestEventRequestSchema.parse({
    source_type: (value as { source_type?: unknown }).source_type,
    author: (value as { author?: unknown }).author ?? null,
    title: (value as { title?: unknown }).title ?? null,
    content: (value as { content?: unknown }).content,
    source_timestamp: (value as { source_timestamp?: unknown }).source_timestamp ?? new Date().toISOString(),
    linked_entities: (value as { linked_entities?: unknown }).linked_entities ?? [],
    metadata: (value as { metadata?: unknown }).metadata ?? {},
  });
}

export function parseContextPackBody(value: unknown) {
  return ContextPackRequestSchema.parse(value);
}

export function parseActionCheckBody(value: unknown) {
  const record = value as { context_pack_id?: unknown; proposed_action?: unknown };
  const proposed =
    typeof record.proposed_action === "string"
      ? {
          type: "customer_reply",
          content: record.proposed_action,
          audience: "Acme",
          impact: "high",
          simulated: true,
        }
      : record.proposed_action;
  return {
    contextPackId: String(record.context_pack_id),
    proposedAction: ProposedActionSchema.parse(proposed),
  };
}

export function parseReviewResolutionBody(value: unknown) {
  const record = value as { decision?: unknown; resolved_content?: unknown; content?: unknown; rationale?: unknown; reviewer?: unknown };
  return ReviewResolutionRequestSchema.parse({
    decision: record.decision,
    content: record.content ?? record.resolved_content ?? null,
    rationale: record.rationale ?? "Resolved through Human Review.",
    reviewer: record.reviewer ?? "Demo reviewer",
  });
}

export function clientEvent(event: RunEvent | RunEventRow) {
  const record = event as unknown as Record<string, unknown>;
  const eventType = record.event_type ?? record.eventType ?? record.type;
  const occurredAt = record.occurred_at ?? record.occurredAt ?? record.createdAt;
  return {
    ...record,
    schemaVersion: record.schema_version ?? record.schemaVersion ?? "1",
    workspaceId: record.workspace_id ?? record.workspaceId,
    runId: record.run_id ?? record.runId,
    type: eventType,
    eventType,
    occurredAt,
    createdAt: occurredAt,
    safeSummary: record.safe_summary ?? record.safeSummary ?? "",
    executionMode: record.execution_mode ?? record.executionMode,
  };
}

export function clientGuardDecision(decision: GuardDecision | GuardDecisionRow) {
  const record = decision as unknown as Record<string, unknown>;
  const verdict = record.decision ?? record.verdict;
  const proposedAction = record.proposed_action as { content?: string } | undefined;
  const extractedClaims = Array.isArray(record.extracted_claims)
    ? (record.extracted_claims as Array<{ text?: string }>)
    : [];
  const reasons = Array.isArray(record.reasons)
    ? (record.reasons as Array<Record<string, unknown>>)
    : [];
  const recommendedAction = record.recommended_action as { message?: string } | undefined;
  return {
    ...record,
    workspaceId: record.workspace_id ?? record.workspaceId,
    contextPackId: record.context_pack_id ?? record.contextPackId,
    verdict,
    proposedAction:
      typeof record.proposedAction === "string"
        ? record.proposedAction
        : proposedAction?.content ?? record.proposedAction ?? "",
    canonicalClaim:
      record.canonicalClaim ?? extractedClaims[0]?.text ?? null,
    prohibitedClaim:
      record.prohibitedClaim ??
      reasons.find((reason) => typeof reason.claim === "string")?.claim ??
      null,
    governingMemoryId:
      record.governingMemoryId ??
      reasons.find((reason) => typeof reason.policy_memory_id === "string")?.policy_memory_id ??
      null,
    explanation:
      record.explanation ?? reasons.map((reason) => String(reason.message ?? "")).join(" ") ?? "",
    citations: record.citations ?? [],
    executionMode: record.execution_mode ?? record.executionMode ?? "live_antigravity",
    simulated: true,
    createdAt: record.created_at ?? record.createdAt,
    recommendedAction:
      typeof record.recommendedAction === "string"
        ? record.recommendedAction
        : recommendedAction?.message ?? null,
    reviewId: record.review_id ?? record.reviewId ?? null,
  };
}

export function clientReview(review: HumanReview | HumanReviewRow) {
  const record = review as unknown as Record<string, unknown>;
  return {
    ...record,
    workspaceId: record.workspace_id ?? record.workspaceId,
    subjectType: record.subject_type ?? record.subjectType,
    subjectId: record.subject_id ?? record.subjectId,
    requestedBy: record.requestedBy ?? "action_guard",
    proposedWording: record.proposed_content ?? record.proposedWording,
    resolvedWording: record.resolved_content ?? record.resolvedWording,
    resolutionMemoryId: record.created_memory_id ?? record.resolutionMemoryId,
    createdAt: record.created_at ?? record.createdAt,
    resolvedAt: record.resolved_at ?? record.resolvedAt,
    updatedAt: record.updatedAt ?? record.resolved_at ?? record.created_at,
  };
}

export function clientSource(source: SourceRow) {
  return source;
}

export async function composePackForWorkspace(workspaceIdValue: string, body: unknown) {
  const store = await getStore();
  const request = parseContextPackBody(body);
  const pack = composeContextPack({
    workspaceId: workspaceIdValue,
    request,
    memories: await store.listMemoryAtoms(workspaceIdValue, { limit: 250 }),
    sources: await store.listSources(workspaceIdValue, 250),
    conflicts: await store.listConflicts(workspaceIdValue),
  });
  return store.createContextPack(workspaceIdValue, pack);
}

export async function checkActionForWorkspace(workspaceIdValue: string, body: unknown) {
  const store = await getStore();
  const input = parseActionCheckBody(body);
  const pack = await store.getContextPack(workspaceIdValue, input.contextPackId);
  if (!pack) throw new Error(`Context Pack ${input.contextPackId} was not found`);
  const result = buildGuardDecision({
    workspaceId: workspaceIdValue,
    contextPack: pack,
    proposedAction: input.proposedAction,
  });
  const decision = await store.createGuardDecision(workspaceIdValue, result.decision);
  await store.appendRunEvent(workspaceIdValue, pack.id, {
    event_type: decision.decision === "BLOCK" ? "action_blocked" : "human_review_required",
    agent: "action_guard",
    execution_mode: "live_antigravity",
    safe_summary:
      decision.decision === "BLOCK"
        ? "Action Guard blocked the simulated customer action."
        : "Action Guard requires human approval.",
    payload: { guard_decision_id: decision.id, verdict: decision.decision },
  }).catch(() => undefined);
  return clientGuardDecision(decision);
}
