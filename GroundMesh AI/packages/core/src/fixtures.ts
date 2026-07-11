import {
  CachedWorkflowOutputSchema,
  ConflictSchema,
  ContextPackSchema,
  CONTRACT_VERSION,
  GuardDecisionSchema,
  HumanReviewSchema,
  IngestEventRequestSchema,
  MayaReportSchema,
  MemoryAtomSchema,
  RookReportSchema,
  RunEventSchema,
  SourceEventSchema,
  VeraReportSchema,
  type CachedWorkflowOutput,
  type IngestEventRequest,
  type RunEvent,
  type RunEventType,
} from "./contracts";

export const SSO_FIXTURE_IDS = {
  workspace: "10000000-0000-4000-8000-000000000001",
  seedRun: "20000000-0000-4000-8000-000000000001",
  founderRun: "20000000-0000-4000-8000-000000000002",
  sources: {
    roadmap: "30000000-0000-4000-8000-000000000101",
    crm: "30000000-0000-4000-8000-000000000102",
    github: "30000000-0000-4000-8000-000000000103",
    support: "30000000-0000-4000-8000-000000000104",
    founder: "30000000-0000-4000-8000-000000000105",
    humanDecision: "30000000-0000-4000-8000-000000000106",
  },
  memories: {
    roadmap: "40000000-0000-4000-8000-000000000201",
    crm: "40000000-0000-4000-8000-000000000202",
    github: "40000000-0000-4000-8000-000000000203",
    support: "40000000-0000-4000-8000-000000000204",
    founderDecision: "40000000-0000-4000-8000-000000000205",
    founderPolicy: "40000000-0000-4000-8000-000000000206",
    approvedOutcome: "40000000-0000-4000-8000-000000000207",
  },
  conflict: "50000000-0000-4000-8000-000000000301",
  contextPack: "60000000-0000-4000-8000-000000000401",
  guardDecision: "70000000-0000-4000-8000-000000000501",
  review: "80000000-0000-4000-8000-000000000601",
} as const;

export const CANONICAL_SSO_INGEST_REQUEST = IngestEventRequestSchema.parse({
  source_type: "founder_message",
  author: "Founder",
  title: "Enterprise SSO decision",
  content: "Enterprise SSO is delayed. Do not commit a date externally.",
  source_timestamp: "2026-07-11T09:30:00.000Z",
  linked_entities: ["Acme", "Enterprise SSO"],
  metadata: { channel: "leadership", fixture: "canonical_sso_v1" },
});

export const CANONICAL_SSO_FIXTURE_IDENTITY = canonicalizeIngestEvent(
  CANONICAL_SSO_INGEST_REQUEST,
);

export const CANONICAL_SSO_FIXTURE_HASH =
  "6e2180444d7da9dbeee0a6486701f16c1c134059bbd6fd92ecddf79110547bc8" as const;

export const SSO_SEED_SOURCES = SourceEventSchema.array().parse([
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.sources.roadmap,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    source_type: "product_roadmap",
    author: "Priya - Product",
    title: "Enterprise roadmap update",
    content: "Enterprise SSO is planned for Q3, pending final delivery review.",
    source_timestamp: "2026-04-15T08:00:00.000Z",
    received_at: "2026-07-11T08:00:00.000Z",
    authority_role: "product_owner_update",
    linked_entities: ["Enterprise SSO"],
    metadata: { fixture_version: "sso_v1", system: "roadmap" },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.sources.crm,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    source_type: "sales_crm_note",
    author: "Dev - Sales",
    title: "Acme renewal note",
    content: "Acme was told Enterprise SSO may launch next month.",
    source_timestamp: "2026-06-20T10:15:00.000Z",
    received_at: "2026-07-11T08:00:01.000Z",
    authority_role: "crm_note",
    linked_entities: ["Acme", "Enterprise SSO"],
    metadata: { fixture_version: "sso_v1", system: "crm" },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.sources.github,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    source_type: "github_issue",
    author: "Security Engineering",
    title: "SSO security review",
    content: "Enterprise SSO security review remains open; release approval is not complete.",
    source_timestamp: "2026-07-08T14:00:00.000Z",
    received_at: "2026-07-11T08:00:02.000Z",
    authority_role: "implementation_evidence",
    linked_entities: ["Enterprise SSO", "Security review"],
    metadata: { fixture_version: "sso_v1", issue_number: 82, system: "github" },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.sources.support,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    source_type: "support_macro",
    author: "Support Operations",
    title: "Enterprise SSO macro",
    content: "Enterprise SSO is coming soon. Ask your account team for details.",
    source_timestamp: "2026-05-15T09:00:00.000Z",
    received_at: "2026-07-11T08:00:03.000Z",
    authority_role: "support_macro",
    linked_entities: ["Enterprise SSO"],
    metadata: { fixture_version: "sso_v1", system: "support" },
  },
]);

export const CANONICAL_SSO_FOUNDER_SOURCE = SourceEventSchema.parse({
  schema_version: CONTRACT_VERSION,
  id: SSO_FIXTURE_IDS.sources.founder,
  workspace_id: SSO_FIXTURE_IDS.workspace,
  ...CANONICAL_SSO_INGEST_REQUEST,
  received_at: "2026-07-11T09:30:01.000Z",
  authority_role: "founder_decision",
});

export const SSO_SEED_MEMORY_ATOMS = MemoryAtomSchema.array().parse([
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.memories.roadmap,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    memory_type: "project_update",
    subject: "Enterprise SSO",
    predicate: "delivery_window",
    object_value: "Q3",
    claim: "Enterprise SSO is planned for Q3.",
    evidence_kind: "explicit",
    source_event_id: SSO_FIXTURE_IDS.sources.roadmap,
    source_timestamp: "2026-04-15T08:00:00.000Z",
    authority_role: "product_owner_update",
    authority_score: 0.8,
    confidence_score: 0.94,
    freshness_score: 0.7,
    status: "active",
    valid_from: "2026-04-15T08:00:00.000Z",
    valid_until: null,
    applies_to: ["product", "sales", "support"],
    entities: ["Enterprise SSO"],
    created_by_run_id: SSO_FIXTURE_IDS.seedRun,
    created_at: "2026-07-11T08:00:10.000Z",
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.memories.crm,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    memory_type: "commitment",
    subject: "Enterprise SSO",
    predicate: "release_date_commitment",
    object_value: "next month",
    claim: "Acme was told Enterprise SSO may launch next month.",
    evidence_kind: "explicit",
    source_event_id: SSO_FIXTURE_IDS.sources.crm,
    source_timestamp: "2026-06-20T10:15:00.000Z",
    authority_role: "crm_note",
    authority_score: 0.55,
    confidence_score: 0.92,
    freshness_score: 0.77,
    status: "active",
    valid_from: "2026-06-20T10:15:00.000Z",
    valid_until: null,
    applies_to: ["sales", "support", "customer_success"],
    entities: ["Acme", "Enterprise SSO"],
    created_by_run_id: SSO_FIXTURE_IDS.seedRun,
    created_at: "2026-07-11T08:00:11.000Z",
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.memories.github,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    memory_type: "fact",
    subject: "Enterprise SSO security review",
    predicate: "status",
    object_value: "open",
    claim: "Enterprise SSO security review remains open.",
    evidence_kind: "explicit",
    source_event_id: SSO_FIXTURE_IDS.sources.github,
    source_timestamp: "2026-07-08T14:00:00.000Z",
    authority_role: "implementation_evidence",
    authority_score: 0.75,
    confidence_score: 0.98,
    freshness_score: 0.98,
    status: "active",
    valid_from: "2026-07-08T14:00:00.000Z",
    valid_until: null,
    applies_to: ["product", "engineering", "sales", "support"],
    entities: ["Enterprise SSO", "Security review"],
    created_by_run_id: SSO_FIXTURE_IDS.seedRun,
    created_at: "2026-07-11T08:00:12.000Z",
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.memories.support,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    memory_type: "customer_context",
    subject: "Enterprise SSO",
    predicate: "availability_timing",
    object_value: "coming soon",
    claim: "Enterprise SSO is coming soon.",
    evidence_kind: "explicit",
    source_event_id: SSO_FIXTURE_IDS.sources.support,
    source_timestamp: "2026-05-15T09:00:00.000Z",
    authority_role: "support_macro",
    authority_score: 0.45,
    confidence_score: 0.96,
    freshness_score: 0.85,
    status: "active",
    valid_from: "2026-05-15T09:00:00.000Z",
    valid_until: null,
    applies_to: ["support"],
    entities: ["Enterprise SSO"],
    created_by_run_id: SSO_FIXTURE_IDS.seedRun,
    created_at: "2026-07-11T08:00:13.000Z",
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  },
]);

export const CACHED_MAYA_REPORT = MayaReportSchema.parse({
  schema_version: CONTRACT_VERSION,
  run_id: SSO_FIXTURE_IDS.founderRun,
  prompt_version: "maya-sso-v1",
  source_ids: [SSO_FIXTURE_IDS.sources.founder],
  safe_summary: "Maya separated the founder note into a decision and a communication policy.",
  agent: "maya",
  candidates: [
    {
      memory_type: "decision",
      subject: "Enterprise SSO",
      predicate: "delivery_status",
      object_value: "delayed",
      claim: "Enterprise SSO is delayed.",
      evidence_kind: "explicit",
      evidence_excerpt: "Enterprise SSO is delayed.",
      confidence_score: 0.98,
      applies_to: ["product", "sales", "support", "customer_success"],
      entities: ["Enterprise SSO"],
      valid_from: "2026-07-11T09:30:00.000Z",
      valid_until: null,
    },
    {
      memory_type: "policy",
      subject: "Enterprise SSO",
      predicate: "external_release_date_commitment",
      object_value: "prohibited",
      claim: "Do not commit an Enterprise SSO release date externally.",
      evidence_kind: "explicit",
      evidence_excerpt: "Do not commit a date externally.",
      confidence_score: 0.99,
      applies_to: ["sales", "support", "customer_success"],
      entities: ["Enterprise SSO", "Acme"],
      valid_from: "2026-07-11T09:30:00.000Z",
      valid_until: null,
    },
  ],
});

export const CACHED_ROOK_REPORT = RookReportSchema.parse({
  schema_version: CONTRACT_VERSION,
  run_id: SSO_FIXTURE_IDS.founderRun,
  prompt_version: "rook-sso-v1",
  source_ids: [
    SSO_FIXTURE_IDS.sources.founder,
    SSO_FIXTURE_IDS.sources.roadmap,
    SSO_FIXTURE_IDS.sources.crm,
    SSO_FIXTURE_IDS.sources.github,
    SSO_FIXTURE_IDS.sources.support,
  ],
  safe_summary:
    "Rook found that the customer-facing date commitment conflicts with the newer founder decision.",
  agent: "rook",
  conflicts: [
    {
      candidate_key: "enterprise-sso-release-date",
      memory_atom_ids: [
        SSO_FIXTURE_IDS.memories.roadmap,
        SSO_FIXTURE_IDS.memories.crm,
        SSO_FIXTURE_IDS.memories.support,
      ],
      candidate_claim_indexes: [0, 1],
      severity: "high",
      explanation:
        "The next-month customer commitment and older timing language conflict with the no-date founder decision.",
      affected_agents: ["sales", "support", "customer_success"],
      requires_human_review: false,
    },
  ],
  stale_memory_ids: [SSO_FIXTURE_IDS.memories.roadmap, SSO_FIXTURE_IDS.memories.support],
  related_memory_ids: SSO_SEED_MEMORY_ATOMS.map((memory) => memory.id),
});

export const CACHED_VERA_REPORT = VeraReportSchema.parse({
  schema_version: CONTRACT_VERSION,
  run_id: SSO_FIXTURE_IDS.founderRun,
  prompt_version: "vera-sso-v1",
  source_ids: [
    SSO_FIXTURE_IDS.sources.founder,
    SSO_FIXTURE_IDS.sources.crm,
    SSO_FIXTURE_IDS.sources.github,
  ],
  safe_summary:
    "Vera selected the no-date founder decision because it is newer, more authoritative and supported by the open security review.",
  agent: "vera",
  outcome: "resolved",
  winner_candidate_id: "founder-no-date-decision",
  resolution_confidence: 0.94,
  rationale:
    "The founder has decision authority, the instruction is current and direct, and implementation evidence shows security review is still open.",
  ranked_candidates: [
    {
      candidate_id: "founder-no-date-decision",
      claim: "Do not commit an Enterprise SSO release date externally.",
      authority_score: 1,
      freshness_score: 0.96,
      directness_score: 0.9,
      corroboration_score: 0.65,
      resolution_score: 0.94,
      citation_source_ids: [
        SSO_FIXTURE_IDS.sources.founder,
        SSO_FIXTURE_IDS.sources.github,
      ],
    },
    {
      candidate_id: "crm-next-month-commitment",
      claim: "Enterprise SSO may launch next month.",
      authority_score: 0.55,
      freshness_score: 0.65,
      directness_score: 0.85,
      corroboration_score: 0.2,
      resolution_score: 0.585,
      citation_source_ids: [SSO_FIXTURE_IDS.sources.crm],
    },
  ],
  activate_candidate_indexes: [0, 1],
  supersede_memory_ids: [
    SSO_FIXTURE_IDS.memories.roadmap,
    SSO_FIXTURE_IDS.memories.crm,
    SSO_FIXTURE_IDS.memories.support,
  ],
  citation_source_ids: [
    SSO_FIXTURE_IDS.sources.founder,
    SSO_FIXTURE_IDS.sources.crm,
    SSO_FIXTURE_IDS.sources.github,
  ],
});

export const SSO_RESOLVED_MEMORY_ATOMS = MemoryAtomSchema.array().parse([
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.memories.founderDecision,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    memory_type: "decision",
    subject: "Enterprise SSO",
    predicate: "delivery_status",
    object_value: "delayed",
    claim: "Enterprise SSO is delayed.",
    evidence_kind: "explicit",
    source_event_id: SSO_FIXTURE_IDS.sources.founder,
    source_timestamp: "2026-07-11T09:30:00.000Z",
    authority_role: "founder_decision",
    authority_score: 1,
    confidence_score: 0.94,
    freshness_score: 1,
    status: "active",
    valid_from: "2026-07-11T09:30:00.000Z",
    valid_until: null,
    applies_to: ["product", "sales", "support", "customer_success"],
    entities: ["Enterprise SSO"],
    created_by_run_id: SSO_FIXTURE_IDS.founderRun,
    created_at: "2026-07-11T09:30:12.000Z",
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  },
  {
    schema_version: CONTRACT_VERSION,
    id: SSO_FIXTURE_IDS.memories.founderPolicy,
    workspace_id: SSO_FIXTURE_IDS.workspace,
    memory_type: "policy",
    subject: "Enterprise SSO",
    predicate: "external_release_date_commitment",
    object_value: "prohibited",
    claim: "Do not commit an Enterprise SSO release date externally.",
    evidence_kind: "explicit",
    source_event_id: SSO_FIXTURE_IDS.sources.founder,
    source_timestamp: "2026-07-11T09:30:00.000Z",
    authority_role: "founder_decision",
    authority_score: 1,
    confidence_score: 0.96,
    freshness_score: 1,
    status: "active",
    valid_from: "2026-07-11T09:30:00.000Z",
    valid_until: null,
    applies_to: ["sales", "support", "customer_success"],
    entities: ["Enterprise SSO", "Acme"],
    created_by_run_id: SSO_FIXTURE_IDS.founderRun,
    created_at: "2026-07-11T09:30:13.000Z",
    embedding: { model: "gemini-embedding-2", dimensions: 768 },
  },
]);

const founderCitation = {
  source_event_id: SSO_FIXTURE_IDS.sources.founder,
  memory_atom_id: SSO_FIXTURE_IDS.memories.founderPolicy,
  label: "Founder decision",
  excerpt: "Do not commit a date externally.",
  source_timestamp: "2026-07-11T09:30:00.000Z",
} as const;

const githubCitation = {
  source_event_id: SSO_FIXTURE_IDS.sources.github,
  memory_atom_id: SSO_FIXTURE_IDS.memories.github,
  label: "Open security review",
  excerpt: "Enterprise SSO security review remains open.",
  source_timestamp: "2026-07-08T14:00:00.000Z",
} as const;

const crmCitation = {
  source_event_id: SSO_FIXTURE_IDS.sources.crm,
  memory_atom_id: SSO_FIXTURE_IDS.memories.crm,
  label: "Older CRM commitment",
  excerpt: "Acme was told Enterprise SSO may launch next month.",
  source_timestamp: "2026-06-20T10:15:00.000Z",
} as const;

export const SSO_RESOLVED_CONFLICT = ConflictSchema.parse({
  schema_version: CONTRACT_VERSION,
  id: SSO_FIXTURE_IDS.conflict,
  workspace_id: SSO_FIXTURE_IDS.workspace,
  severity: "high",
  status: "resolved",
  explanation:
    "The newer founder decision prohibits the older customer-facing date commitment.",
  memory_atom_ids: [
    SSO_FIXTURE_IDS.memories.crm,
    SSO_FIXTURE_IDS.memories.founderPolicy,
  ],
  affected_agents: ["sales", "support", "customer_success"],
  created_by_run_id: SSO_FIXTURE_IDS.founderRun,
  created_at: "2026-07-11T09:30:09.000Z",
  resolved_at: "2026-07-11T09:30:12.000Z",
  resolved_by_memory_id: SSO_FIXTURE_IDS.memories.founderPolicy,
});

export const CANONICAL_SSO_CONTEXT_PACK = ContextPackSchema.parse({
  schema_version: CONTRACT_VERSION,
  id: SSO_FIXTURE_IDS.contextPack,
  workspace_id: SSO_FIXTURE_IDS.workspace,
  status: "verified",
  requesting_agent: "support_agent",
  task: "reply_to_customer",
  scope: { customer: "Acme", project: "Enterprise SSO", topic: "release date" },
  verified_facts: [
    {
      memory_atom_id: SSO_FIXTURE_IDS.memories.founderDecision,
      claim: "Enterprise SSO remains under development and is delayed.",
      confidence: 0.94,
      citations: [founderCitation, githubCitation],
    },
    {
      memory_atom_id: SSO_FIXTURE_IDS.memories.founderPolicy,
      claim: "No external release date is approved.",
      confidence: 0.96,
      citations: [founderCitation],
    },
  ],
  applicable_policies: [
    {
      memory_atom_id: SSO_FIXTURE_IDS.memories.founderPolicy,
      policy: "Do not communicate an uncommitted Enterprise SSO release date.",
      effect: "block",
      pattern: {
        subject: "Enterprise SSO",
        predicate: "release_date_commitment",
        value: "next month",
        match: "exact",
      },
      citations: [founderCitation],
    },
  ],
  known_conflicts: [
    {
      conflict_id: SSO_FIXTURE_IDS.conflict,
      summary: "An older CRM note suggested a next-month release.",
      severity: "high",
      status: "resolved",
    },
  ],
  blocked_claims: [
    {
      claim: "SSO will launch next month.",
      reason: "No Enterprise SSO release date is approved for external communication.",
      pattern: {
        subject: "Enterprise SSO",
        predicate: "release_date_commitment",
        value: "next month",
        match: "exact",
      },
      policy_memory_id: SSO_FIXTURE_IDS.memories.founderPolicy,
      citations: [founderCitation, crmCitation],
    },
  ],
  recommended_action: {
    type: "reply_without_date",
    message: "SSO is under active development; no confirmed release date is available.",
  },
  citations: [founderCitation, githubCitation, crmCitation],
  confidence: 0.94,
  created_at: "2026-07-11T09:30:15.000Z",
  expires_at: "2026-07-11T10:30:15.000Z",
  invalidated_at: null,
});

export const CANONICAL_UNSAFE_ACTION = {
  type: "customer_reply",
  content: "Enterprise SSO will be available next month.",
  audience: "Acme",
  impact: "high",
  simulated: true,
} as const;

export const CANONICAL_UNSAFE_CLAIM = {
  subject: "Enterprise SSO",
  predicate: "release_date_commitment",
  value: "next month",
  text: "Enterprise SSO will be available next month.",
  confidence: 0.98,
} as const;

export const CACHED_SSO_GUARD_DECISION = GuardDecisionSchema.parse({
  schema_version: CONTRACT_VERSION,
  id: SSO_FIXTURE_IDS.guardDecision,
  workspace_id: SSO_FIXTURE_IDS.workspace,
  context_pack_id: SSO_FIXTURE_IDS.contextPack,
  proposed_action: CANONICAL_UNSAFE_ACTION,
  extracted_claims: [CANONICAL_UNSAFE_CLAIM],
  decision: "BLOCK",
  reasons: [
    {
      code: "blocked_claim",
      message: "No Enterprise SSO release date is approved for external communication.",
      policy_memory_id: SSO_FIXTURE_IDS.memories.founderPolicy,
      claim: CANONICAL_UNSAFE_ACTION.content,
    },
  ],
  recommended_action: CANONICAL_SSO_CONTEXT_PACK.recommended_action,
  review_id: SSO_FIXTURE_IDS.review,
  created_at: "2026-07-11T09:30:19.000Z",
});

export const CACHED_SSO_CORRECTION_REVIEW = HumanReviewSchema.parse({
  schema_version: CONTRACT_VERSION,
  id: SSO_FIXTURE_IDS.review,
  workspace_id: SSO_FIXTURE_IDS.workspace,
  subject_type: "correction",
  subject_id: SSO_FIXTURE_IDS.guardDecision,
  status: "approved",
  reviewer: "Demo reviewer",
  proposed_content: CANONICAL_SSO_CONTEXT_PACK.recommended_action.message,
  resolved_content: CANONICAL_SSO_CONTEXT_PACK.recommended_action.message,
  rationale: "The corrected reply accurately reflects current evidence and avoids an unsupported date.",
  created_memory_id: SSO_FIXTURE_IDS.memories.approvedOutcome,
  created_at: "2026-07-11T09:30:20.000Z",
  resolved_at: "2026-07-11T09:30:24.000Z",
});

const eventSpecs: ReadonlyArray<
  readonly [RunEventType, (typeof import("./contracts"))["AGENTS"][number], string, Record<string, string | number | string[]>]
> = [
  ["source_received", "orchestrator", "Founder SSO decision received.", { source_id: SSO_FIXTURE_IDS.sources.founder }],
  ["agent_started", "maya", "Maya began curating the source.", { agent: "maya" }],
  ["memory_extracted", "maya", "Maya extracted two source-backed Memory Atoms.", { memory_ids: [SSO_FIXTURE_IDS.memories.founderDecision, SSO_FIXTURE_IDS.memories.founderPolicy], count: 2 }],
  ["agent_started", "rook", "Rook began auditing related context.", { agent: "rook" }],
  ["conflict_detected", "rook", "Rook found a high-severity customer commitment conflict.", { conflict_id: SSO_FIXTURE_IDS.conflict, memory_ids: [SSO_FIXTURE_IDS.memories.crm, SSO_FIXTURE_IDS.memories.founderPolicy], severity: "high" }],
  ["agent_started", "vera", "Vera began resolving the evidence.", { agent: "vera" }],
  ["evidence_verified", "vera", "Vera verified the no-date founder decision at 0.94 confidence.", { resolution_id: SSO_FIXTURE_IDS.memories.founderPolicy, confidence: 0.94, citations: [SSO_FIXTURE_IDS.sources.founder, SSO_FIXTURE_IDS.sources.github] }],
  ["memory_superseded", "orchestrator", "Three older timing claims were superseded.", { memory_ids: [SSO_FIXTURE_IDS.memories.roadmap, SSO_FIXTURE_IDS.memories.crm, SSO_FIXTURE_IDS.memories.support], authoritative_memory_id: SSO_FIXTURE_IDS.memories.founderPolicy }],
  ["context_pack_ready", "context_composer", "The support Context Pack was rebuilt.", { context_pack_id: SSO_FIXTURE_IDS.contextPack }],
  ["action_blocked", "action_guard", "The next-month customer promise was blocked.", { guard_decision_id: SSO_FIXTURE_IDS.guardDecision, reason: "No external release date is approved." }],
  ["human_review_resolved", "human", "The corrected reply was approved and written back to memory.", { review_id: SSO_FIXTURE_IDS.review, created_memory_id: SSO_FIXTURE_IDS.memories.approvedOutcome }],
  ["run_completed", "orchestrator", "The verified outcome was saved to organizational memory.", { duration_ms: 26000, summary: "SSO truth updated and unsafe commitment blocked." }],
];

export const CACHED_SSO_RUN_EVENTS: RunEvent[] = eventSpecs.map(
  ([eventType, agent, safeSummary, payload], index) =>
    RunEventSchema.parse({
      schema_version: CONTRACT_VERSION,
      id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      workspace_id: SSO_FIXTURE_IDS.workspace,
      run_id: SSO_FIXTURE_IDS.founderRun,
      sequence: index + 1,
      event_type: eventType,
      occurred_at: new Date(Date.parse("2026-07-11T09:30:01.000Z") + index * 2_000).toISOString(),
      execution_mode: "cached_demo",
      agent,
      safe_summary: safeSummary,
      payload,
    }),
);

export const CACHED_SSO_WORKFLOW_OUTPUT = CachedWorkflowOutputSchema.parse({
  schema_version: CONTRACT_VERSION,
  fixture_hash: CANONICAL_SSO_FIXTURE_HASH,
  execution_mode: "cached_demo",
  maya_report: CACHED_MAYA_REPORT,
  rook_report: CACHED_ROOK_REPORT,
  vera_report: CACHED_VERA_REPORT,
  activated_memories: SSO_RESOLVED_MEMORY_ATOMS,
  superseded_memory_ids: CACHED_VERA_REPORT.supersede_memory_ids,
  context_pack: CANONICAL_SSO_CONTEXT_PACK,
  run_events: CACHED_SSO_RUN_EVENTS,
});

export function canonicalizeIngestEvent(input: IngestEventRequest): string {
  const source = IngestEventRequestSchema.parse(input);
  const normalized = {
    ...source,
    author: source.author?.trim() ?? null,
    title: source.title?.trim() ?? null,
    content: source.content.trim().replace(/\s+/g, " "),
    source_timestamp: new Date(source.source_timestamp).toISOString(),
    linked_entities: [...source.linked_entities]
      .map((entity) => entity.trim())
      .sort((left, right) => left.localeCompare(right, "en")),
  };
  return stableStringify(normalized);
}

export function isCanonicalSsoFixture(input: IngestEventRequest): boolean {
  const parsed = IngestEventRequestSchema.safeParse(input);
  return (
    parsed.success &&
    canonicalizeIngestEvent(parsed.data) === CANONICAL_SSO_FIXTURE_IDENTITY
  );
}

export function getCachedSsoWorkflowOutput(fixtureHash: string): CachedWorkflowOutput | null {
  if (fixtureHash !== CANONICAL_SSO_FIXTURE_HASH) {
    return null;
  }
  return CachedWorkflowOutputSchema.parse(CACHED_SSO_WORKFLOW_OUTPUT);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
