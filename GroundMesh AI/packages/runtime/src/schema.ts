export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const SCHEMA_VERSION = "202607110001";

export const AUTHORITY_DEFAULTS = {
  founder_decision: 1,
  approved_policy: 0.9,
  product_owner_update: 0.8,
  implementation_evidence: 0.75,
  crm_note: 0.55,
  support_macro: 0.45,
  agent_inference: 0.25,
} as const;

export type AuthorityProfileCode = keyof typeof AUTHORITY_DEFAULTS;
type StoredExecutionMode = "live_antigravity" | "live_gemini_fallback" | "cached_demo";
export type AgentName =
  | "orchestrator"
  | "maya"
  | "rook"
  | "vera"
  | "context_composer"
  | "action_guard"
  | "human";
export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "needs_review"
  | "failed"
  | "cancelled";
export type WorkflowStepName =
  | "source_received"
  | "maya_extraction"
  | "related_memory_retrieval"
  | "rook_audit"
  | "vera_resolution"
  | "memory_commit"
  | "context_pack_rebuild"
  | "completed";
export type StepStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type MemoryStatus = "candidate" | "active" | "disputed" | "stale" | "superseded" | "rejected";
export type ConflictSeverity = "low" | "medium" | "high" | "critical";
export type ConflictStatus = "open" | "resolved" | "needs_review" | "dismissed";
export type ContextPackStatus =
  | "verified"
  | "verified_with_warning"
  | "needs_review"
  | "expired"
  | "invalidated";
export type GuardVerdict = "ALLOW" | "ALLOW_WITH_WARNING" | "REQUIRE_APPROVAL" | "BLOCK";
export type ReviewSubjectType = "conflict" | "guard_decision" | "correction";
export type ReviewStatus = "pending" | "approved" | "edited" | "rejected" | "more_evidence_requested";
export type TruthStatus = "updating" | "needs_attention" | "verified";

export interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  fixtureVersion: string | null;
  truthStatus: TruthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourceRow {
  id: string;
  workspaceId: string;
  type: string;
  externalId: string | null;
  author: string | null;
  title: string;
  body: string;
  sourceTimestamp: string | null;
  receivedAt: string;
  authorityProfileId: string;
  sourceHash: string;
  linkedEntities: string[];
  metadata: JsonObject;
}

export interface RunRow {
  id: string;
  workspaceId: string;
  sourceId: string | null;
  kind: string;
  status: RunStatus;
  executionMode: StoredExecutionMode;
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

export interface WorkflowStepRow {
  id: string;
  workspaceId: string;
  runId: string;
  step: WorkflowStepName | string;
  agent: AgentName;
  status: StepStatus;
  attempt: number;
  providerInteractionId: string | null;
  environmentId: string | null;
  promptVersion: string | null;
  rawReport: JsonValue | null;
  validatedOutput: JsonValue | null;
  safeSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunEventRow {
  id: string;
  schemaVersion: "1";
  workspaceId: string;
  runId: string;
  sequence: number;
  type: string;
  agent: AgentName;
  executionMode: StoredExecutionMode;
  safeSummary: string;
  payload: JsonObject;
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
  evidenceKind: "explicit" | "inferred";
  sourceTimestamp: string;
  authorityRole: AuthorityProfileCode;
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
  embedding: number[] | null;
  appliesTo: string[];
  entities: string[];
  metadata: JsonObject;
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
  severity: ConflictSeverity;
  status: ConflictStatus;
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
  status: ContextPackStatus;
  expiresAt: string;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  metadata: JsonObject;
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
  citations: JsonValue[];
  executionMode: StoredExecutionMode;
  simulated: boolean;
  createdAt: string;
}

export interface HumanReviewRow {
  id: string;
  workspaceId: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  status: ReviewStatus;
  requestedBy: AgentName;
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

/** Portable schema used by PGlite and as a safe bootstrap for plain Postgres. */
export const LOCAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS groundmesh_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  fixture_version text,
  truth_status text NOT NULL DEFAULT 'verified' CHECK (truth_status IN ('updating','needs_attention','verified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS browser_sessions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fixture_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version text NOT NULL,
  fixture_hash text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, version)
);

CREATE TABLE IF NOT EXISTS authority_profiles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  authority numeric(5,4) NOT NULL CHECK (authority >= 0 AND authority <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code),
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  external_id text,
  author text,
  title text NOT NULL,
  body text NOT NULL,
  source_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  authority_profile_id text NOT NULL,
  source_hash text NOT NULL,
  linked_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, source_hash),
  FOREIGN KEY (workspace_id, authority_profile_id)
    REFERENCES authority_profiles(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id text,
  kind text NOT NULL DEFAULT 'ingestion',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','needs_review','failed','cancelled')),
  execution_mode text NOT NULL DEFAULT 'live_antigravity' CHECK (execution_mode IN ('live_antigravity','live_gemini_fallback','cached_demo')),
  current_step text,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  cancellation_requested boolean NOT NULL DEFAULT false,
  safe_summary text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES sources(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS provider_interactions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  agent text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  provider_interaction_id text,
  environment_id text,
  prompt_version text,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  execution_mode text NOT NULL CHECK (execution_mode IN ('live_antigravity','live_gemini_fallback','cached_demo')),
  status text NOT NULL,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb,
  raw_report jsonb,
  latency_ms integer,
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  step text NOT NULL,
  agent text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  provider_interaction_id text REFERENCES provider_interactions(id) ON DELETE SET NULL,
  environment_id text,
  prompt_version text,
  raw_report jsonb,
  validated_output jsonb,
  safe_summary text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, step, attempt),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS run_events (
  id text PRIMARY KEY,
  schema_version text NOT NULL DEFAULT '1',
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL,
  agent text NOT NULL,
  execution_mode text NOT NULL CHECK (execution_mode IN ('live_antigravity','live_gemini_fallback','cached_demo')),
  safe_summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, sequence),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS outbox_jobs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  job_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_usage (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text,
  provider_interaction_id text REFERENCES provider_interactions(id) ON DELETE SET NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cached_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  quality_metrics_eligible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  canonical_name text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, type, canonical_name)
);

CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS workflows (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS memory_atoms (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  run_id text,
  entity_id text,
  kind text NOT NULL,
  topic text NOT NULL,
  subject text NOT NULL,
  predicate text NOT NULL,
  object text NOT NULL,
  statement text NOT NULL,
  evidence_kind text NOT NULL DEFAULT 'explicit' CHECK (evidence_kind IN ('explicit','inferred')),
  source_timestamp timestamptz NOT NULL,
  authority_role text NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','active','disputed','stale','superseded','rejected')),
  authority numeric(5,4) NOT NULL CHECK (authority >= 0 AND authority <= 1),
  freshness numeric(5,4) NOT NULL CHECK (freshness >= 0 AND freshness <= 1),
  directness numeric(5,4) NOT NULL CHECK (directness >= 0 AND directness <= 1),
  corroboration numeric(5,4) NOT NULL CHECK (corroboration >= 0 AND corroboration <= 1),
  resolution_score numeric(5,4) NOT NULL CHECK (resolution_score >= 0 AND resolution_score <= 1),
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  valid_from timestamptz,
  valid_until timestamptz,
  embedding_model text,
  embedding_dimension integer,
  embedding jsonb,
  applies_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, source_id) REFERENCES sources(workspace_id, id),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id, entity_id) REFERENCES entities(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_memory_id text NOT NULL,
  to_memory_id text NOT NULL,
  relation text NOT NULL CHECK (relation IN ('supersedes','supports','contradicts','clarifies','derived_from')),
  run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, from_memory_id, to_memory_id, relation),
  FOREIGN KEY (workspace_id, from_memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, to_memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS memory_status_history (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  run_id text,
  reason text NOT NULL,
  changed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS memory_entities (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, memory_id, entity_id),
  FOREIGN KEY (workspace_id, memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, entity_id) REFERENCES entities(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_agents (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id text NOT NULL,
  agent_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, memory_id, agent_id),
  FOREIGN KEY (workspace_id, memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, agent_id) REFERENCES agents(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_workflows (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_id text NOT NULL,
  workflow_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, memory_id, workflow_id),
  FOREIGN KEY (workspace_id, memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, workflow_id) REFERENCES workflows(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conflicts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text,
  topic text NOT NULL,
  left_memory_id text NOT NULL,
  right_memory_id text NOT NULL,
  winner_memory_id text,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','needs_review','dismissed')),
  reason text NOT NULL,
  resolution text,
  score_gap numeric(5,4),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id, left_memory_id) REFERENCES memory_atoms(workspace_id, id),
  FOREIGN KEY (workspace_id, right_memory_id) REFERENCES memory_atoms(workspace_id, id),
  FOREIGN KEY (workspace_id, winner_memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS context_packs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id text,
  requesting_agent text NOT NULL,
  task text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified','verified_with_warning','needs_review','expired','invalidated')),
  expires_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  invalidation_reason text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS context_pack_memories (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  context_pack_id text NOT NULL,
  memory_id text NOT NULL,
  rank integer NOT NULL DEFAULT 0,
  relevance numeric(5,4) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, context_pack_id, memory_id),
  FOREIGN KEY (workspace_id, context_pack_id) REFERENCES context_packs(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_pack_agents (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  context_pack_id text NOT NULL,
  agent_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, context_pack_id, agent_id),
  FOREIGN KEY (workspace_id, context_pack_id) REFERENCES context_packs(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, agent_id) REFERENCES agents(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guard_decisions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  context_pack_id text NOT NULL,
  run_id text,
  verdict text NOT NULL CHECK (verdict IN ('ALLOW','ALLOW_WITH_WARNING','REQUIRE_APPROVAL','BLOCK')),
  proposed_action jsonb NOT NULL,
  canonical_claim text,
  prohibited_claim text,
  governing_memory_id text,
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explanation text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_mode text NOT NULL CHECK (execution_mode IN ('live_antigravity','live_gemini_fallback','cached_demo')),
  simulated boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, context_pack_id) REFERENCES context_packs(workspace_id, id),
  FOREIGN KEY (workspace_id, run_id) REFERENCES runs(workspace_id, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id, governing_memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS guard_decision_memories (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  guard_decision_id text NOT NULL,
  memory_id text NOT NULL,
  role text NOT NULL DEFAULT 'evidence',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, guard_decision_id, memory_id),
  FOREIGN KEY (workspace_id, guard_decision_id) REFERENCES guard_decisions(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS human_reviews (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('conflict','guard_decision','correction')),
  subject_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','edited','rejected','more_evidence_requested')),
  requested_by text NOT NULL,
  reviewer text,
  proposed_wording text,
  resolved_wording text,
  rationale text,
  resolution_source_id text,
  resolution_memory_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, resolution_source_id) REFERENCES sources(workspace_id, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id, resolution_memory_id) REFERENCES memory_atoms(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  resource_type text,
  resource_id text,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (workspace_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS output_cache (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fixture_hash text NOT NULL,
  agent text NOT NULL,
  prompt_version text NOT NULL,
  output jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, fixture_hash, agent, prompt_version)
);

CREATE INDEX IF NOT EXISTS sources_workspace_received_idx ON sources(workspace_id, received_at DESC);
CREATE INDEX IF NOT EXISTS runs_workspace_created_idx ON runs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS runs_active_idx ON runs(workspace_id, status) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS run_events_replay_idx ON run_events(workspace_id, run_id, sequence);
CREATE INDEX IF NOT EXISTS outbox_dispatch_idx ON outbox_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS memory_atoms_topic_idx ON memory_atoms(workspace_id, topic, status);
CREATE INDEX IF NOT EXISTS memory_atoms_entity_idx ON memory_atoms(workspace_id, entity_id, status);
CREATE INDEX IF NOT EXISTS memory_atoms_validity_idx ON memory_atoms(workspace_id, valid_until) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS conflicts_open_idx ON conflicts(workspace_id, status, severity);
CREATE INDEX IF NOT EXISTS context_packs_active_idx ON context_packs(workspace_id, status, expires_at);
CREATE INDEX IF NOT EXISTS human_reviews_queue_idx ON human_reviews(workspace_id, status, created_at);
CREATE INDEX IF NOT EXISTS idempotency_expiry_idx ON idempotency_keys(expires_at);

INSERT INTO groundmesh_schema_migrations(version)
VALUES ('${SCHEMA_VERSION}')
ON CONFLICT (version) DO NOTHING;
`;
