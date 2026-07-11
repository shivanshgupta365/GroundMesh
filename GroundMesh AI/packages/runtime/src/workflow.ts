import { createHash, randomUUID } from "node:crypto";

import {
  CANONICAL_SSO_FIXTURE_HASH,
  IngestEventRequestSchema,
  MayaReportSchema,
  RookReportSchema,
  VeraReportSchema,
  authorityScoreFor,
  isCanonicalSsoFixture,
  type Agent,
  type Conflict,
  type ContextPackRequest,
  type ExecutionMode,
  type IngestEventRequest,
  type MayaReport,
  type MemoryAtom,
  type RookReport,
  type SourceEvent,
  type VeraReport,
} from "@groundmesh/core";

import { composeContextPack } from "./composer";
import { scopeCachedWorkflow } from "./fixture-scope";
import { embedText, runSpecialist, type ProviderResult, type SpecialistRole } from "./providers";
import { getStore, type GroundMeshStore } from "./store";

const LIVE_RUN_DEADLINE_MS = 150_000;

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourcePrompt(source: SourceEvent, related: MemoryAtom[] = []): string {
  return [
    `Run id evidence source: ${source.id}`,
    `Source type: ${source.source_type}`,
    `Authority role: ${source.authority_role}`,
    `Server received at: ${source.received_at}`,
    `Untrusted source timestamp: ${source.source_timestamp}`,
    "Source content:",
    source.content,
    "",
    "Related active memories:",
    related.map((memory) => `- ${memory.id}: ${memory.claim}`).join("\n") || "- none",
  ].join("\n");
}

function modeFromResults(results: ProviderResult<unknown>[]): ExecutionMode {
  if (results.some((result) => result.executionMode === "live_antigravity")) return "live_antigravity";
  if (results.some((result) => result.executionMode === "live_gemini_fallback")) return "live_gemini_fallback";
  return "cached_demo";
}

function candidateToMemory(input: {
  workspaceId: string;
  runId: string;
  source: SourceEvent;
  report: MayaReport;
}): MemoryAtom[] {
  const now = new Date().toISOString();
  return input.report.candidates.map((candidate) => ({
    schema_version: "1.0",
    id: randomUUID(),
    workspace_id: input.workspaceId,
    memory_type: candidate.memory_type,
    subject: candidate.subject,
    predicate: candidate.predicate,
    object_value: candidate.object_value,
    claim: candidate.claim,
    evidence_kind: candidate.evidence_kind,
    source_event_id: input.source.id,
    source_timestamp: input.source.source_timestamp,
    authority_role: input.source.authority_role,
    authority_score: authorityScoreFor(input.source.authority_role),
    confidence_score: candidate.confidence_score,
    freshness_score: 1,
    status: "candidate",
    valid_from: candidate.valid_from,
    valid_until: candidate.valid_until,
    applies_to: candidate.applies_to,
    entities: candidate.entities,
    created_by_run_id: input.runId,
    created_at: now,
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  }));
}

function conflictsFromRook(input: {
  workspaceId: string;
  runId: string;
  report: RookReport;
  fallbackMemoryIds: string[];
}): Conflict[] {
  return input.report.conflicts
    .filter((candidate) => candidate.memory_atom_ids.length + candidate.candidate_claim_indexes.length >= 2)
    .map((candidate) => ({
      schema_version: "1.0",
      id: randomUUID(),
      workspace_id: input.workspaceId,
      severity: candidate.severity,
      status: candidate.requires_human_review ? "needs_review" : "open",
      explanation: candidate.explanation,
      memory_atom_ids:
        candidate.memory_atom_ids.length >= 2 ? candidate.memory_atom_ids : input.fallbackMemoryIds.slice(0, 2),
      affected_agents: candidate.affected_agents,
      created_by_run_id: input.runId,
      created_at: new Date().toISOString(),
      resolved_at: null,
      resolved_by_memory_id: null,
    }));
}

async function recordProvider<T>(
  store: GroundMeshStore,
  workspaceId: string,
  runId: string,
  role: SpecialistRole,
  prompt: string,
  result: ProviderResult<T>,
): Promise<void> {
  const interactionId = await store.createProviderInteraction({
    workspaceId,
    runId,
    agent: role as Agent,
    provider: result.provider,
    model: result.model,
    promptVersion: `${role}-sso-v1`,
    executionMode: result.executionMode,
    status: "started",
    requestSummary: { prompt_hash: hash(prompt) },
    safeSummary: `${role} provider interaction recorded.`,
  });
  await store.completeProviderInteraction(interactionId, {
    status: "succeeded",
    providerInteractionId: result.interactionId ?? null,
    environmentId: result.environmentId ?? null,
    responseSummary: {
      latency_ms: result.latencyMs,
      repair_attempted: result.repairAttempted,
      safe_summary: "Validated specialist output persisted.",
    },
  });
  await store.recordModelUsage({
    workspaceId,
    runId,
    providerInteractionId: interactionId,
    model: result.model,
    qualityMetricsEligible: result.executionMode !== "cached_demo",
  });
}

async function runCachedCanonical(store: GroundMeshStore, workspaceId: string, runId: string, source: SourceEvent) {
  const output = scopeCachedWorkflow(workspaceId, source.id, runId, source.received_at);
  await store.setRunState(workspaceId, runId, {
    status: "running",
    current_step: "maya_extraction",
    execution_mode: "cached_demo",
    started_at: new Date().toISOString(),
    safe_summary: "Using labelled cached canonical workflow output.",
  });
  for (const event of output.run_events.filter((event) => event.sequence > 1)) {
    await store.appendRunEvent(workspaceId, runId, {
      event_type: event.event_type,
      agent: event.agent,
      execution_mode: "cached_demo",
      safe_summary: event.safe_summary,
      payload: event.payload,
      occurred_at: event.occurred_at,
    });
  }
  await store.upsertRunStep(workspaceId, runId, {
    step: "maya_extraction",
    agent: "maya",
    status: "completed",
    prompt_version: output.maya_report.prompt_version,
    validated_output: output.maya_report,
    safe_summary: output.maya_report.safe_summary,
    completed_at: new Date().toISOString(),
  });
  await store.upsertRunStep(workspaceId, runId, {
    step: "rook_audit",
    agent: "rook",
    status: "completed",
    prompt_version: output.rook_report.prompt_version,
    validated_output: output.rook_report,
    safe_summary: output.rook_report.safe_summary,
    completed_at: new Date().toISOString(),
  });
  await store.upsertRunStep(workspaceId, runId, {
    step: "vera_resolution",
    agent: "vera",
    status: "completed",
    prompt_version: output.vera_report.prompt_version,
    validated_output: output.vera_report,
    safe_summary: output.vera_report.safe_summary,
    completed_at: new Date().toISOString(),
  });
  await store.insertMemoryAtoms(workspaceId, output.activated_memories);
  await store.transitionMemoryStatuses(
    workspaceId,
    output.superseded_memory_ids.map((memoryId) => ({
      memoryId,
      toStatus: "superseded",
      reason: "Superseded by founder decision.",
      changedBy: "vera",
      runId,
      supersededByMemoryId: output.activated_memories.at(-1)?.id,
    })),
  );
  const conflict = output.context_pack.known_conflicts[0];
  if (conflict) {
    await store.createConflict(workspaceId, {
      schema_version: "1.0",
      id: conflict.conflict_id,
      workspace_id: workspaceId,
      severity: conflict.severity,
      status: conflict.status,
      explanation: conflict.summary,
      memory_atom_ids: [
        output.context_pack.blocked_claims[0]?.policy_memory_id ?? output.activated_memories[0]!.id,
        output.activated_memories[0]!.id,
      ],
      affected_agents: ["sales", "support", "customer_success"],
      created_by_run_id: runId,
      created_at: output.context_pack.created_at,
      resolved_at: output.context_pack.created_at,
      resolved_by_memory_id: output.context_pack.blocked_claims[0]?.policy_memory_id ?? null,
    });
  }
  await store.createContextPack(workspaceId, output.context_pack);
  await store.setRunState(workspaceId, runId, {
    status: "completed",
    current_step: "completed",
    execution_mode: "cached_demo",
    completed_at: new Date().toISOString(),
    safe_summary: "Cached canonical workflow completed. Live-quality metrics exclude this run.",
  });
}

async function runLiveOrFallback(store: GroundMeshStore, workspaceId: string, runId: string, source: SourceEvent) {
  const cached = isCanonicalSsoFixture(IngestEventRequestSchema.parse({
    source_type: source.source_type,
    author: source.author,
    title: source.title,
    content: source.content,
    source_timestamp: source.source_timestamp,
    linked_entities: source.linked_entities,
    metadata: source.metadata,
  } as IngestEventRequest))
    ? scopeCachedWorkflow(workspaceId, source.id, runId, source.received_at)
    : null;

  await store.setRunState(workspaceId, runId, {
    status: "running",
    current_step: "maya_extraction",
    started_at: new Date().toISOString(),
    safe_summary: "Maya extraction started.",
  });
  await store.appendRunEvent(workspaceId, runId, {
    event_type: "agent_started",
    agent: "maya",
    safe_summary: "Maya began extracting source-backed memories.",
    payload: { agent: "maya" },
  });

  const relatedBefore = await store.findRelatedMemories(workspaceId, {
    entities: source.linked_entities,
    topic: source.title ?? source.source_type,
    limit: 40,
  });
  const mayaPrompt = sourcePrompt(source, relatedBefore);
  const maya = await runSpecialist<MayaReport>({
    role: "maya",
    prompt: mayaPrompt,
    schema: MayaReportSchema,
    runId,
    timeoutMs: 45_000,
    ...(cached ? { cachedOutput: cached.maya_report } : {}),
  });
  await recordProvider(store, workspaceId, runId, "maya", mayaPrompt, maya);
  await store.upsertRunStep(workspaceId, runId, {
    step: "maya_extraction",
    agent: "maya",
    status: "completed",
    prompt_version: maya.output.prompt_version,
    validated_output: maya.output,
    raw_report: { redacted: true, provider: maya.provider },
    safe_summary: maya.output.safe_summary,
    completed_at: new Date().toISOString(),
  });

  const candidateMemories = candidateToMemory({ workspaceId, runId, source, report: maya.output });
  const embedded = await Promise.all(
    candidateMemories.map(async (memory) => {
      const embedding = await embedText(memory.claim);
      return {
        ...memory,
        embedding: { model: embedding.model, dimensions: embedding.dimension },
        embedding_values: embedding.values,
      };
    }),
  );
  const inserted = await store.insertMemoryAtoms(workspaceId, embedded);
  await store.appendRunEvent(workspaceId, runId, {
    event_type: "memory_extracted",
    agent: "maya",
    execution_mode: maya.executionMode,
    safe_summary: `Maya extracted ${inserted.length} Memory Atoms.`,
    payload: { memory_ids: inserted.map((memory) => memory.id), count: inserted.length },
  });

  await store.setRunState(workspaceId, runId, {
    current_step: "related_memory_retrieval",
    execution_mode: maya.executionMode,
    safe_summary: "Related memory retrieval completed.",
  });
  const related = await store.findRelatedMemories(workspaceId, {
    entities: [...new Set(inserted.flatMap((memory) => memory.entities))],
    topic: inserted[0]?.subject ?? source.title ?? source.source_type,
    limit: 50,
  });

  await store.setRunState(workspaceId, runId, {
    current_step: "rook_audit",
    safe_summary: "Rook audit started.",
  });
  await store.appendRunEvent(workspaceId, runId, {
    event_type: "agent_started",
    agent: "rook",
    execution_mode: maya.executionMode,
    safe_summary: "Rook began conflict and freshness audit.",
    payload: { agent: "rook" },
  });
  const rookPrompt = sourcePrompt(source, [...related, ...inserted]);
  const rook = await runSpecialist<RookReport>({
    role: "rook",
    prompt: rookPrompt,
    schema: RookReportSchema,
    runId,
    timeoutMs: 45_000,
    ...(cached ? { cachedOutput: cached.rook_report } : {}),
  });
  await recordProvider(store, workspaceId, runId, "rook", rookPrompt, rook);
  await store.upsertRunStep(workspaceId, runId, {
    step: "rook_audit",
    agent: "rook",
    status: "completed",
    prompt_version: rook.output.prompt_version,
    validated_output: rook.output,
    raw_report: { redacted: true, provider: rook.provider },
    safe_summary: rook.output.safe_summary,
    completed_at: new Date().toISOString(),
  });
  const conflicts = conflictsFromRook({
    workspaceId,
    runId,
    report: rook.output,
    fallbackMemoryIds: [...related, ...inserted].map((memory) => memory.id),
  });
  for (const conflict of conflicts) {
    await store.createConflict(workspaceId, conflict);
    await store.appendRunEvent(workspaceId, runId, {
      event_type: "conflict_detected",
      agent: "rook",
      execution_mode: rook.executionMode,
      safe_summary: conflict.explanation,
      payload: { conflict_id: conflict.id, severity: conflict.severity, memory_ids: conflict.memory_atom_ids },
    });
  }

  await store.setRunState(workspaceId, runId, {
    current_step: "vera_resolution",
    safe_summary: "Vera resolution started.",
  });
  await store.appendRunEvent(workspaceId, runId, {
    event_type: "agent_started",
    agent: "vera",
    execution_mode: rook.executionMode,
    safe_summary: "Vera began evidence resolution.",
    payload: { agent: "vera" },
  });
  const veraPrompt = sourcePrompt(source, [...related, ...inserted]);
  const vera = await runSpecialist<VeraReport>({
    role: "vera",
    prompt: veraPrompt,
    schema: VeraReportSchema,
    runId,
    timeoutMs: 45_000,
    ...(cached ? { cachedOutput: cached.vera_report } : {}),
  });
  await recordProvider(store, workspaceId, runId, "vera", veraPrompt, vera);
  await store.upsertRunStep(workspaceId, runId, {
    step: "vera_resolution",
    agent: "vera",
    status: "completed",
    prompt_version: vera.output.prompt_version,
    validated_output: vera.output,
    raw_report: { redacted: true, provider: vera.provider },
    safe_summary: vera.output.safe_summary,
    completed_at: new Date().toISOString(),
  });
  const mode = modeFromResults([maya, rook, vera]);
  await store.setRunState(workspaceId, runId, { execution_mode: mode });
  await store.transitionMemoryStatuses(
    workspaceId,
    inserted.map((memory) => ({
      memoryId: memory.id,
      toStatus: vera.output.outcome === "resolved" ? "active" : "disputed",
      reason: vera.output.rationale,
      changedBy: "vera",
      runId,
    })),
  );
  if (vera.output.supersede_memory_ids.length) {
    await store.transitionMemoryStatuses(
      workspaceId,
      vera.output.supersede_memory_ids.map((memoryId) => ({
        memoryId,
        toStatus: "superseded",
        reason: "Superseded during Vera evidence resolution.",
        changedBy: "vera",
        runId,
        supersededByMemoryId: inserted.at(-1)?.id,
      })),
    );
    await store.appendRunEvent(workspaceId, runId, {
      event_type: "memory_superseded",
      agent: "vera",
      execution_mode: mode,
      safe_summary: `${vera.output.supersede_memory_ids.length} older memories were superseded.`,
      payload: { memory_ids: vera.output.supersede_memory_ids },
    });
  }
  await store.appendRunEvent(workspaceId, runId, {
    event_type: "evidence_verified",
    agent: "vera",
    execution_mode: mode,
    safe_summary: vera.output.safe_summary,
    payload: { outcome: vera.output.outcome, confidence: vera.output.resolution_confidence },
  });

  const packRequest: ContextPackRequest = {
    requesting_agent: "support_agent",
    task: "reply_to_customer",
    scope: { customer: "Acme", project: "Enterprise SSO", topic: "release date" },
  };
  const pack = composeContextPack({
    workspaceId,
    request: packRequest,
    memories: await store.listMemoryAtoms(workspaceId, { limit: 200 }),
    sources: await store.listSources(workspaceId, 200),
    conflicts: await store.listConflicts(workspaceId),
  });
  await store.createContextPack(workspaceId, pack);
  await store.appendRunEvent(workspaceId, runId, {
    event_type: "context_pack_ready",
    agent: "context_composer",
    execution_mode: mode,
    safe_summary: "Context Pack rebuilt from updated memory.",
    payload: { context_pack_id: pack.id, status: pack.status },
  });
  await store.setRunState(workspaceId, runId, {
    status: vera.output.outcome === "needs_review" ? "needs_review" : "completed",
    current_step: "completed",
    execution_mode: mode,
    completed_at: new Date().toISOString(),
    safe_summary:
      vera.output.outcome === "needs_review"
        ? "Workflow needs human review before activation."
        : "Workflow completed and shared memory was updated.",
  });
  await store.appendRunEvent(workspaceId, runId, {
    event_type: vera.output.outcome === "needs_review" ? "human_review_required" : "run_completed",
    agent: "orchestrator",
    execution_mode: mode,
    safe_summary:
      vera.output.outcome === "needs_review"
        ? "Human review required for unresolved ambiguity."
        : "Run completed.",
    payload: { run_id: runId },
  });
}

export async function processRun(runId: string, workspaceId: string): Promise<void> {
  const store = await getStore();
  const run = await store.getRun(workspaceId, runId);
  if (!run) throw new Error(`Run ${runId} was not found`);
  const source = await store.getSource(workspaceId, run.source_event_id);
  if (!source) throw new Error(`Source ${run.source_event_id} was not found`);
  const started = Date.now();
  try {
    const canonicalInput = IngestEventRequestSchema.parse({
      source_type: source.source_type,
      author: source.author,
      title: source.title,
      content: source.content,
      source_timestamp: source.source_timestamp,
      linked_entities: source.linked_entities,
      metadata: source.metadata,
    });
    if (!process.env.GEMINI_API_KEY?.trim() && isCanonicalSsoFixture(canonicalInput)) {
      await runCachedCanonical(store, workspaceId, runId, source);
      return;
    }
    await runLiveOrFallback(store, workspaceId, runId, source);
    if (Date.now() - started > LIVE_RUN_DEADLINE_MS) {
      throw new Error("Live workflow exceeded deadline.");
    }
  } catch (error) {
    const canonical = isCanonicalSsoFixture({
      source_type: source.source_type,
      author: source.author,
      title: source.title,
      content: source.content,
      source_timestamp: source.source_timestamp,
      linked_entities: source.linked_entities,
      metadata: source.metadata,
    });
    if (canonical) {
      await runCachedCanonical(store, workspaceId, runId, source);
      return;
    }
    await store.setRunState(workspaceId, runId, {
      status: "needs_review",
      current_step: "completed",
      safe_summary: "Workflow retained source but needs review because live providers failed and no cached fallback is allowed.",
      error_code: "PROVIDER_UNAVAILABLE",
      error_message: safeError(error),
      completed_at: new Date().toISOString(),
    });
    await store.appendRunEvent(workspaceId, runId, {
      event_type: "run_failed",
      agent: "orchestrator",
      safe_summary: "Run needs review; no arbitrary cached fallback was used.",
      payload: { retryable: true, fixture_hash: canonical ? CANONICAL_SSO_FIXTURE_HASH : null },
    });
  }
}

export async function drainOutbox(limit = 10): Promise<number> {
  const store = await getStore();
  const jobs = await store.claimOutboxJobs(limit);
  let completed = 0;
  for (const job of jobs) {
    try {
      const payload = job.payload as { run_id?: string; workspace_id?: string } | string | undefined;
      const parsed = typeof payload === "string" ? JSON.parse(payload) as { run_id?: string; workspace_id?: string } : payload;
      if (!parsed?.run_id || !parsed.workspace_id) throw new Error("Outbox job payload is missing run_id/workspace_id");
      await processRun(parsed.run_id, parsed.workspace_id);
      await store.completeOutboxJob(String(job.id));
      completed += 1;
    } catch (error) {
      await store.completeOutboxJob(String(job.id), safeError(error));
    }
  }
  return completed;
}
