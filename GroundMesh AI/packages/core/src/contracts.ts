import { z } from "zod";

export const CONTRACT_VERSION = "1.0" as const;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const UuidSchema = z.string().uuid();
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const ScoreSchema = z.number().finite().min(0).max(1);
export const NonEmptyStringSchema = z.string().trim().min(1);

export const SOURCE_TYPES = [
  "founder_message",
  "approved_policy",
  "product_roadmap",
  "product_owner_update",
  "sales_crm_note",
  "github_issue",
  "support_macro",
  "human_decision",
  "fixture_seed",
] as const;
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const AUTHORITY_ROLES = [
  "founder_decision",
  "approved_policy",
  "product_owner_update",
  "implementation_evidence",
  "crm_note",
  "support_macro",
  "agent_inference",
] as const;
export const AuthorityRoleSchema = z.enum(AUTHORITY_ROLES);
export type AuthorityRole = z.infer<typeof AuthorityRoleSchema>;

export const MEMORY_TYPES = [
  "fact",
  "decision",
  "policy",
  "commitment",
  "task",
  "risk",
  "question",
  "project_update",
  "customer_context",
  "hypothesis",
  "agent_outcome",
] as const;
export const MemoryTypeSchema = z.enum(MEMORY_TYPES);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MEMORY_STATUSES = [
  "candidate",
  "active",
  "disputed",
  "stale",
  "superseded",
  "rejected",
] as const;
export const MemoryStatusSchema = z.enum(MEMORY_STATUSES);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const EVIDENCE_KINDS = ["explicit", "inferred"] as const;
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const RELATION_TYPES = [
  "supports",
  "contradicts",
  "supersedes",
  "clarifies",
  "applies_to",
  "affects",
  "requested_by",
  "blocked_by",
  "derived_from",
  "used_by_action",
] as const;
export const RelationTypeSchema = z.enum(RELATION_TYPES);
export type RelationType = z.infer<typeof RelationTypeSchema>;

export const CONFLICT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ConflictSeveritySchema = z.enum(CONFLICT_SEVERITIES);
export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;

export const CONFLICT_STATUSES = [
  "open",
  "resolved",
  "needs_review",
  "dismissed",
] as const;
export const ConflictStatusSchema = z.enum(CONFLICT_STATUSES);
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;

export const AGENTS = [
  "orchestrator",
  "maya",
  "rook",
  "vera",
  "context_composer",
  "action_guard",
  "human",
] as const;
export const AgentSchema = z.enum(AGENTS);
export type Agent = z.infer<typeof AgentSchema>;

export const EXECUTION_MODES = [
  "live_antigravity",
  "live_gemini_fallback",
  "cached_demo",
] as const;
export const ExecutionModeSchema = z.enum(EXECUTION_MODES);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "needs_review",
  "failed",
  "cancelled",
] as const;
export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const WORKFLOW_STEPS = [
  "source_received",
  "maya_extraction",
  "related_memory_retrieval",
  "rook_audit",
  "vera_resolution",
  "memory_commit",
  "context_pack_rebuild",
  "completed",
] as const;
export const WorkflowStepSchema = z.enum(WORKFLOW_STEPS);
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const RUN_EVENT_TYPES = [
  "source_received",
  "agent_started",
  "agent_completed",
  "agent_failed",
  "memory_extracted",
  "conflict_detected",
  "evidence_verified",
  "memory_superseded",
  "context_pack_invalidated",
  "context_pack_ready",
  "action_blocked",
  "human_review_required",
  "human_approved",
  "human_review_resolved",
  "retry_scheduled",
  "run_completed",
  "run_failed",
  "run_cancelled",
] as const;
export const RunEventTypeSchema = z.enum(RUN_EVENT_TYPES);
export type RunEventType = z.infer<typeof RunEventTypeSchema>;

export const CONTEXT_PACK_STATUSES = [
  "verified",
  "verified_with_warning",
  "needs_review",
  "expired",
  "invalidated",
] as const;
export const ContextPackStatusSchema = z.enum(CONTEXT_PACK_STATUSES);
export type ContextPackStatus = z.infer<typeof ContextPackStatusSchema>;

export const GUARD_VERDICTS = [
  "ALLOW",
  "ALLOW_WITH_WARNING",
  "REQUIRE_APPROVAL",
  "BLOCK",
] as const;
export const GuardVerdictSchema = z.enum(GUARD_VERDICTS);
export type GuardVerdict = z.infer<typeof GuardVerdictSchema>;

export const REVIEW_SUBJECT_TYPES = [
  "conflict",
  "guard_decision",
  "correction",
] as const;
export const ReviewSubjectTypeSchema = z.enum(REVIEW_SUBJECT_TYPES);
export type ReviewSubjectType = z.infer<typeof ReviewSubjectTypeSchema>;

export const REVIEW_STATUSES = [
  "pending",
  "approved",
  "edited",
  "rejected",
  "more_evidence_requested",
] as const;
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const TRUTH_STATES = ["updating", "needs_attention", "verified"] as const;
export const TruthStateSchema = z.enum(TRUTH_STATES);
export type TruthState = z.infer<typeof TruthStateSchema>;

export const SourceEventSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    source_type: SourceTypeSchema,
    author: NonEmptyStringSchema.nullable(),
    title: NonEmptyStringSchema.nullable(),
    content: NonEmptyStringSchema,
    source_timestamp: IsoDateTimeSchema,
    received_at: IsoDateTimeSchema,
    authority_role: AuthorityRoleSchema,
    linked_entities: z.array(NonEmptyStringSchema),
    metadata: z.record(z.string(), JsonValueSchema),
  })
  .strict();
export type SourceEvent = z.infer<typeof SourceEventSchema>;

export const SourceCitationSchema = z
  .object({
    source_event_id: UuidSchema,
    memory_atom_id: UuidSchema.nullable(),
    label: NonEmptyStringSchema,
    excerpt: NonEmptyStringSchema,
    source_timestamp: IsoDateTimeSchema,
  })
  .strict();
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const EmbeddingMetadataSchema = z
  .object({
    model: NonEmptyStringSchema,
    dimensions: z.number().int().positive(),
  })
  .strict();
export type EmbeddingMetadata = z.infer<typeof EmbeddingMetadataSchema>;

export const MemoryAtomSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    memory_type: MemoryTypeSchema,
    subject: NonEmptyStringSchema,
    predicate: NonEmptyStringSchema,
    object_value: NonEmptyStringSchema,
    claim: NonEmptyStringSchema,
    evidence_kind: EvidenceKindSchema,
    source_event_id: UuidSchema,
    source_timestamp: IsoDateTimeSchema,
    authority_role: AuthorityRoleSchema,
    authority_score: ScoreSchema,
    confidence_score: ScoreSchema,
    freshness_score: ScoreSchema,
    status: MemoryStatusSchema,
    valid_from: IsoDateTimeSchema.nullable(),
    valid_until: IsoDateTimeSchema.nullable(),
    applies_to: z.array(NonEmptyStringSchema),
    entities: z.array(NonEmptyStringSchema),
    created_by_run_id: UuidSchema,
    created_at: IsoDateTimeSchema,
    embedding: EmbeddingMetadataSchema.nullable(),
  })
  .strict();
export type MemoryAtom = z.infer<typeof MemoryAtomSchema>;

export const MemoryEdgeSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    from_memory_id: UuidSchema,
    relation_type: RelationTypeSchema,
    to_memory_id: UuidSchema,
    confidence: ScoreSchema,
    created_by_run_id: UuidSchema,
    created_at: IsoDateTimeSchema,
  })
  .strict()
  .refine((edge) => edge.from_memory_id !== edge.to_memory_id, {
    message: "A memory edge cannot point to itself",
    path: ["to_memory_id"],
  });
export type MemoryEdge = z.infer<typeof MemoryEdgeSchema>;

export const ConflictSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    severity: ConflictSeveritySchema,
    status: ConflictStatusSchema,
    explanation: NonEmptyStringSchema,
    memory_atom_ids: z.array(UuidSchema).min(2),
    affected_agents: z.array(NonEmptyStringSchema),
    created_by_run_id: UuidSchema,
    created_at: IsoDateTimeSchema,
    resolved_at: IsoDateTimeSchema.nullable(),
    resolved_by_memory_id: UuidSchema.nullable(),
  })
  .strict();
export type Conflict = z.infer<typeof ConflictSchema>;

export const ClaimSchema = z
  .object({
    subject: NonEmptyStringSchema,
    predicate: NonEmptyStringSchema,
    value: NonEmptyStringSchema,
    text: NonEmptyStringSchema,
    confidence: ScoreSchema,
  })
  .strict();
export type Claim = z.infer<typeof ClaimSchema>;

export const ClaimPatternSchema = z
  .object({
    subject: NonEmptyStringSchema,
    predicate: NonEmptyStringSchema,
    value: NonEmptyStringSchema,
    match: z.enum(["exact", "contains"]),
  })
  .strict();
export type ClaimPattern = z.infer<typeof ClaimPatternSchema>;

export const VerifiedFactSchema = z
  .object({
    memory_atom_id: UuidSchema,
    claim: NonEmptyStringSchema,
    confidence: ScoreSchema,
    citations: z.array(SourceCitationSchema).min(1),
  })
  .strict();
export type VerifiedFact = z.infer<typeof VerifiedFactSchema>;

export const ApplicablePolicySchema = z
  .object({
    memory_atom_id: UuidSchema,
    policy: NonEmptyStringSchema,
    effect: z.enum(["block", "require_approval"]),
    pattern: ClaimPatternSchema,
    citations: z.array(SourceCitationSchema).min(1),
  })
  .strict();
export type ApplicablePolicy = z.infer<typeof ApplicablePolicySchema>;

export const ContextConflictSchema = z
  .object({
    conflict_id: UuidSchema,
    summary: NonEmptyStringSchema,
    severity: ConflictSeveritySchema,
    status: ConflictStatusSchema,
  })
  .strict();
export type ContextConflict = z.infer<typeof ContextConflictSchema>;

export const BlockedClaimSchema = z
  .object({
    claim: NonEmptyStringSchema,
    reason: NonEmptyStringSchema,
    pattern: ClaimPatternSchema,
    policy_memory_id: UuidSchema,
    citations: z.array(SourceCitationSchema).min(1),
  })
  .strict();
export type BlockedClaim = z.infer<typeof BlockedClaimSchema>;

export const RecommendedActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;

export const ContextScopeSchema = z
  .object({
    customer: NonEmptyStringSchema.nullable(),
    project: NonEmptyStringSchema.nullable(),
    topic: NonEmptyStringSchema.nullable(),
  })
  .strict();
export type ContextScope = z.infer<typeof ContextScopeSchema>;

export const ContextPackSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    status: ContextPackStatusSchema,
    requesting_agent: NonEmptyStringSchema,
    task: NonEmptyStringSchema,
    scope: ContextScopeSchema,
    verified_facts: z.array(VerifiedFactSchema),
    applicable_policies: z.array(ApplicablePolicySchema),
    known_conflicts: z.array(ContextConflictSchema),
    blocked_claims: z.array(BlockedClaimSchema),
    recommended_action: RecommendedActionSchema,
    citations: z.array(SourceCitationSchema).min(1),
    confidence: ScoreSchema,
    created_at: IsoDateTimeSchema,
    expires_at: IsoDateTimeSchema,
    invalidated_at: IsoDateTimeSchema.nullable(),
  })
  .strict()
  .refine((pack) => Date.parse(pack.expires_at) > Date.parse(pack.created_at), {
    message: "Context Pack expiry must be after creation",
    path: ["expires_at"],
  });
export type ContextPack = z.infer<typeof ContextPackSchema>;

export const ProposedActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    content: NonEmptyStringSchema,
    audience: NonEmptyStringSchema,
    impact: z.enum(["low", "medium", "high"]),
    simulated: z.literal(true),
  })
  .strict();
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export const GuardReasonSchema = z
  .object({
    code: z.enum([
      "blocked_claim",
      "blocking_policy",
      "extraction_failed",
      "pack_expired",
      "pack_invalidated",
      "low_confidence",
      "high_severity_conflict",
      "noncritical_ambiguity",
      "moderate_confidence",
      "verified",
    ]),
    message: NonEmptyStringSchema,
    policy_memory_id: UuidSchema.nullable(),
    claim: NonEmptyStringSchema.nullable(),
  })
  .strict();
export type GuardReason = z.infer<typeof GuardReasonSchema>;

export const GuardDecisionSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    context_pack_id: UuidSchema,
    proposed_action: ProposedActionSchema,
    extracted_claims: z.array(ClaimSchema),
    decision: GuardVerdictSchema,
    reasons: z.array(GuardReasonSchema).min(1),
    recommended_action: RecommendedActionSchema.nullable(),
    review_id: UuidSchema.nullable(),
    created_at: IsoDateTimeSchema,
  })
  .strict();
export type GuardDecision = z.infer<typeof GuardDecisionSchema>;

export const HumanReviewSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    subject_type: ReviewSubjectTypeSchema,
    subject_id: UuidSchema,
    status: ReviewStatusSchema,
    reviewer: NonEmptyStringSchema.nullable(),
    proposed_content: NonEmptyStringSchema,
    resolved_content: NonEmptyStringSchema.nullable(),
    rationale: NonEmptyStringSchema.nullable(),
    created_memory_id: UuidSchema.nullable(),
    created_at: IsoDateTimeSchema,
    resolved_at: IsoDateTimeSchema.nullable(),
  })
  .strict();
export type HumanReview = z.infer<typeof HumanReviewSchema>;

const PRIVATE_REASONING_KEYS = new Set([
  "chain_of_thought",
  "chainofthought",
  "internal_prompt",
  "private_reasoning",
  "raw_reasoning",
  "raw_report",
  "reasoning_trace",
]);

export const SafeRunPayloadSchema = z
  .record(z.string(), JsonValueSchema)
  .superRefine((payload, context) => {
    const forbiddenPath = findPrivateReasoningPath(payload);
    if (forbiddenPath !== null) {
      context.addIssue({
        code: "custom",
        message: "Run events cannot contain private reasoning or raw provider reports",
        path: forbiddenPath,
      });
    }
  });
export type SafeRunPayload = z.infer<typeof SafeRunPayloadSchema>;

export const RunEventSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    run_id: UuidSchema,
    sequence: z.number().int().positive(),
    event_type: RunEventTypeSchema,
    occurred_at: IsoDateTimeSchema,
    execution_mode: ExecutionModeSchema,
    agent: AgentSchema,
    safe_summary: NonEmptyStringSchema,
    payload: SafeRunPayloadSchema,
  })
  .strict();
export type RunEvent = z.infer<typeof RunEventSchema>;

export const AgentRunSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    workspace_id: UuidSchema,
    source_event_id: UuidSchema,
    status: RunStatusSchema,
    current_step: WorkflowStepSchema,
    execution_mode: ExecutionModeSchema,
    started_at: IsoDateTimeSchema.nullable(),
    finished_at: IsoDateTimeSchema.nullable(),
    created_at: IsoDateTimeSchema,
    failure_code: NonEmptyStringSchema.nullable(),
    safe_summary: NonEmptyStringSchema,
  })
  .strict();
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const ProviderInteractionSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    id: UuidSchema,
    run_id: UuidSchema,
    agent: AgentSchema,
    provider: NonEmptyStringSchema,
    model: NonEmptyStringSchema,
    interaction_id: NonEmptyStringSchema.nullable(),
    environment_id: NonEmptyStringSchema.nullable(),
    prompt_version: NonEmptyStringSchema,
    attempt: z.number().int().positive(),
    execution_mode: ExecutionModeSchema,
    status: z.enum(["started", "succeeded", "failed", "cancelled"]),
    latency_ms: z.number().int().nonnegative().nullable(),
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
    raw_report_ref: NonEmptyStringSchema.nullable(),
    validated_output: JsonValueSchema.nullable(),
    safe_summary: NonEmptyStringSchema,
    created_at: IsoDateTimeSchema,
  })
  .strict();
export type ProviderInteraction = z.infer<typeof ProviderInteractionSchema>;

export const CandidateMemoryAtomSchema = z
  .object({
    memory_type: MemoryTypeSchema,
    subject: NonEmptyStringSchema,
    predicate: NonEmptyStringSchema,
    object_value: NonEmptyStringSchema,
    claim: NonEmptyStringSchema,
    evidence_kind: EvidenceKindSchema,
    evidence_excerpt: NonEmptyStringSchema,
    confidence_score: ScoreSchema,
    applies_to: z.array(NonEmptyStringSchema),
    entities: z.array(NonEmptyStringSchema),
    valid_from: IsoDateTimeSchema.nullable(),
    valid_until: IsoDateTimeSchema.nullable(),
  })
  .strict();
export type CandidateMemoryAtom = z.infer<typeof CandidateMemoryAtomSchema>;

export const AgentReportEnvelopeSchema = z
  .object({
    schema_version: z.unknown().transform(() => CONTRACT_VERSION),
    run_id: UuidSchema,
    prompt_version: NonEmptyStringSchema,
    source_ids: z.array(UuidSchema).min(1),
    safe_summary: NonEmptyStringSchema,
  })
  .strict();
export type AgentReportEnvelope = z.infer<typeof AgentReportEnvelopeSchema>;

export const MayaReportSchema = AgentReportEnvelopeSchema.extend({
  agent: z.unknown().transform(() => "maya" as const),
  candidates: z.array(CandidateMemoryAtomSchema).min(1),
}).strict();
export type MayaReport = z.infer<typeof MayaReportSchema>;

export const RookConflictCandidateSchema = z
  .object({
    candidate_key: NonEmptyStringSchema,
    memory_atom_ids: z.array(UuidSchema).min(1),
    candidate_claim_indexes: z.array(z.number().int().nonnegative()),
    severity: ConflictSeveritySchema,
    explanation: NonEmptyStringSchema,
    affected_agents: z.array(NonEmptyStringSchema),
    requires_human_review: z.boolean(),
  })
  .strict();
export type RookConflictCandidate = z.infer<typeof RookConflictCandidateSchema>;

export const RookReportSchema = AgentReportEnvelopeSchema.extend({
  agent: z.unknown().transform(() => "rook" as const),
  conflicts: z.array(RookConflictCandidateSchema),
  stale_memory_ids: z.array(UuidSchema),
  related_memory_ids: z.array(UuidSchema),
}).strict();
export type RookReport = z.infer<typeof RookReportSchema>;

export const ResolutionCandidateSchema = z
  .object({
    candidate_id: NonEmptyStringSchema,
    claim: NonEmptyStringSchema,
    authority_score: ScoreSchema,
    freshness_score: ScoreSchema,
    directness_score: ScoreSchema,
    corroboration_score: ScoreSchema,
    resolution_score: ScoreSchema,
    citation_source_ids: z.array(UuidSchema).min(1),
  })
  .strict();
export type ResolutionCandidate = z.infer<typeof ResolutionCandidateSchema>;

export const VeraReportSchema = AgentReportEnvelopeSchema.extend({
  agent: z.unknown().transform(() => "vera" as const),
  outcome: z.enum(["resolved", "needs_review"]),
  winner_candidate_id: NonEmptyStringSchema.nullable(),
  resolution_confidence: ScoreSchema,
  rationale: NonEmptyStringSchema,
  ranked_candidates: z.array(ResolutionCandidateSchema).min(1),
  activate_candidate_indexes: z.array(z.number().int().nonnegative()),
  supersede_memory_ids: z.array(UuidSchema),
  citation_source_ids: z.array(UuidSchema).min(1),
}).strict();
export type VeraReport = z.infer<typeof VeraReportSchema>;

export const CachedWorkflowOutputSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    fixture_hash: z.string().regex(/^[a-f0-9]{64}$/),
    execution_mode: z.literal("cached_demo"),
    maya_report: MayaReportSchema,
    rook_report: RookReportSchema,
    vera_report: VeraReportSchema,
    activated_memories: z.array(MemoryAtomSchema).min(1),
    superseded_memory_ids: z.array(UuidSchema),
    context_pack: ContextPackSchema,
    run_events: z.array(RunEventSchema).min(1),
  })
  .strict()
  .refine(
    (output) => output.run_events.every((event) => event.execution_mode === "cached_demo"),
    {
      message: "Cached workflow events must be labelled cached_demo",
      path: ["run_events"],
    },
  );
export type CachedWorkflowOutput = z.infer<typeof CachedWorkflowOutputSchema>;

export const IngestEventRequestSchema = z
  .object({
    source_type: SourceTypeSchema,
    author: NonEmptyStringSchema.nullable(),
    title: NonEmptyStringSchema.nullable(),
    content: NonEmptyStringSchema,
    source_timestamp: IsoDateTimeSchema,
    linked_entities: z.array(NonEmptyStringSchema),
    metadata: z.record(z.string(), JsonValueSchema),
  })
  .strict();
export type IngestEventRequest = z.infer<typeof IngestEventRequestSchema>;

export const IngestEventAcceptedSchema = z
  .object({
    source_event_id: UuidSchema,
    run_id: UuidSchema,
    status: z.literal("queued"),
  })
  .strict();
export type IngestEventAccepted = z.infer<typeof IngestEventAcceptedSchema>;

export const ContextPackRequestSchema = z
  .object({
    requesting_agent: NonEmptyStringSchema,
    task: NonEmptyStringSchema,
    scope: ContextScopeSchema,
  })
  .strict();
export type ContextPackRequest = z.infer<typeof ContextPackRequestSchema>;

export const ActionCheckRequestSchema = z
  .object({
    context_pack_id: UuidSchema,
    proposed_action: ProposedActionSchema,
  })
  .strict();
export type ActionCheckRequest = z.infer<typeof ActionCheckRequestSchema>;

export const ReviewResolutionRequestSchema = z
  .object({
    decision: z.enum(["approve", "edit", "reject", "request_more_evidence"]),
    content: NonEmptyStringSchema.nullable(),
    rationale: NonEmptyStringSchema,
    reviewer: NonEmptyStringSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.decision === "approve" || value.decision === "edit") && value.content === null) {
      context.addIssue({
        code: "custom",
        message: "Approved and edited reviews require content",
        path: ["content"],
      });
    }
  });
export type ReviewResolutionRequest = z.infer<typeof ReviewResolutionRequestSchema>;

export const ApiErrorSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    retryable: z.boolean(),
    details: JsonValueSchema.optional(),
  })
  .strict();
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiErrorResponseSchema = z
  .object({
    error: ApiErrorSchema,
    request_id: NonEmptyStringSchema,
  })
  .strict();
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const WorkspaceSnapshotSchema = z
  .object({
    schema_version: z.literal(CONTRACT_VERSION),
    workspace_id: UuidSchema,
    truth_state: TruthStateSchema,
    counts: z
      .object({
        active_runs: z.number().int().nonnegative(),
        unresolved_high_conflicts: z.number().int().nonnegative(),
        failed_runs: z.number().int().nonnegative(),
        stale_memories: z.number().int().nonnegative(),
      })
      .strict(),
    sources: z.array(SourceEventSchema),
    memories: z.array(MemoryAtomSchema),
    conflicts: z.array(ConflictSchema),
    context_packs: z.array(ContextPackSchema),
    latest_run: AgentRunSchema.nullable(),
  })
  .strict();
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

function findPrivateReasoningPath(
  value: JsonValue,
  path: Array<string | number> = [],
): Array<string | number> | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nestedPath = findPrivateReasoningPath(item, [...path, index]);
      if (nestedPath !== null) {
        return nestedPath;
      }
    }
    return null;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "_");
      if (PRIVATE_REASONING_KEYS.has(normalizedKey)) {
        return [...path, key];
      }
      const nestedPath = findPrivateReasoningPath(item, [...path, key]);
      if (nestedPath !== null) {
        return nestedPath;
      }
    }
  }

  return null;
}
