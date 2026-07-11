import { createHash, randomUUID } from "node:crypto";

import {
  CONTRACT_VERSION,
  SSO_FIXTURE_IDS,
  SSO_SEED_MEMORY_ATOMS,
  SSO_SEED_SOURCES,
  authorityScoreFor,
  type Agent,
  type AgentRun,
  type AuthorityRole,
  type Conflict,
  type ContextPack,
  type ExecutionMode,
  type GuardDecision,
  type HumanReview,
  type IngestEventRequest,
  type JsonValue,
  type MemoryAtom,
  type MemoryStatus,
  type ReviewResolutionRequest,
  type RunEvent,
  type RunStatus,
  type SourceEvent,
  type WorkspaceSnapshot as CoreWorkspaceSnapshot,
} from "@groundmesh/core";

import { getDatabase, type DatabaseExecutor, type GroundMeshDatabase, type QueryResultRow } from "./db";
import { scopedFixtureId, scopeMemory, scopeSource } from "./fixture-scope";
import {
  AUTHORITY_DEFAULTS,
  type AgentName,
  type AuthorityProfileCode,
  type ConflictRow,
  type ContextPackRow,
  type GuardDecisionRow,
  type HumanReviewRow,
  type JsonObject,
  type MemoryAtomRow,
  type RunEventRow,
  type RunRow,
  type SourceRow,
  type StepStatus,
  type WorkflowStepName,
  type WorkflowStepRow,
  type WorkspaceRow,
  type WorkspaceSnapshot,
} from "./schema";

const JSON_COLUMNS = new Set([
  "aliases",
  "applies_to",
  "citations",
  "data",
  "embedding",
  "entities",
  "linked_entities",
  "metadata",
  "payload",
  "proposed_action",
  "raw_report",
  "request_summary",
  "response_body",
  "response_summary",
  "scope",
  "validated_output",
]);

const NUMBER_COLUMNS = new Set([
  "attempt",
  "attempts",
  "authority",
  "cached_tokens",
  "confidence",
  "corroboration",
  "embedding_dimension",
  "estimated_cost_usd",
  "freshness",
  "input_tokens",
  "output_tokens",
  "rank",
  "relevance",
  "resolution_score",
  "response_status",
  "score_gap",
  "sequence",
]);

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normaliseValue(column: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (JSON_COLUMNS.has(column)) return parseJson(value);
  if (NUMBER_COLUMNS.has(column) && value !== null && value !== undefined) return Number(value);
  return value;
}

function fromRow<T>(record: QueryResultRow): T {
  const result: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(record)) {
    result[snakeToCamel(column)] = normaliseValue(column, value);
  }
  return result as T;
}

function fromRows<T>(records: QueryResultRow[]): T[] {
  return records.map((record) => fromRow<T>(record));
}

function iso(value: unknown, fallback = new Date().toISOString()): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return fallback;
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : json(value)).digest("hex");
}

function safeSlug(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `workspace-${hashValue(value).slice(0, 10)}`;
}

/** Stable UUID remapping keeps each demo clone isolated while preserving fixture relationships. */
export const remapFixtureId = scopedFixtureId;

function authorityRoleForSource(sourceType: IngestEventRequest["source_type"]): AuthorityRole {
  switch (sourceType) {
    case "founder_message":
    case "human_decision":
      return "founder_decision";
    case "approved_policy":
      return "approved_policy";
    case "product_roadmap":
    case "product_owner_update":
      return "product_owner_update";
    case "github_issue":
      return "implementation_evidence";
    case "sales_crm_note":
      return "crm_note";
    case "support_macro":
      return "support_macro";
    case "fixture_seed":
      return "agent_inference";
  }
}

function toSourceEvent(row: QueryResultRow): SourceEvent {
  return {
    schema_version: CONTRACT_VERSION,
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    source_type: row.type as SourceEvent["source_type"],
    author: row.author === null || row.author === undefined ? null : String(row.author),
    title: row.title === null || row.title === undefined ? null : String(row.title),
    content: String(row.body),
    source_timestamp: iso(row.source_timestamp, iso(row.received_at)),
    received_at: iso(row.received_at),
    authority_role: row.authority_role as AuthorityRole,
    linked_entities: (parseJson(row.linked_entities) ?? []) as string[],
    metadata: (parseJson(row.metadata) ?? {}) as SourceEvent["metadata"],
  };
}

function toAgentRun(row: QueryResultRow): AgentRun {
  return {
    schema_version: CONTRACT_VERSION,
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    source_event_id: String(row.source_id),
    status: row.status as RunStatus,
    current_step: (row.current_step ?? "source_received") as AgentRun["current_step"],
    execution_mode: row.execution_mode as ExecutionMode,
    started_at: row.started_at ? iso(row.started_at) : null,
    finished_at: row.completed_at ? iso(row.completed_at) : null,
    created_at: iso(row.created_at),
    failure_code: row.error_code ? String(row.error_code) : null,
    safe_summary: String(row.safe_summary ?? "Run queued."),
  };
}

function toRunEvent(row: QueryResultRow): RunEvent {
  return {
    schema_version: CONTRACT_VERSION,
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    run_id: String(row.run_id),
    sequence: Number(row.sequence),
    event_type: row.event_type as RunEvent["event_type"],
    occurred_at: iso(row.occurred_at),
    execution_mode: row.execution_mode as ExecutionMode,
    agent: row.agent as Agent,
    safe_summary: String(row.safe_summary),
    payload: (parseJson(row.payload) ?? {}) as RunEvent["payload"],
  };
}

function toMemoryAtom(row: QueryResultRow): MemoryAtom {
  return {
    schema_version: CONTRACT_VERSION,
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    memory_type: row.kind as MemoryAtom["memory_type"],
    subject: String(row.subject),
    predicate: String(row.predicate),
    object_value: String(row.object),
    claim: String(row.statement),
    evidence_kind: row.evidence_kind as MemoryAtom["evidence_kind"],
    source_event_id: String(row.source_id),
    source_timestamp: iso(row.source_timestamp),
    authority_role: row.authority_role as AuthorityRole,
    authority_score: Number(row.authority),
    confidence_score: Number(row.confidence),
    freshness_score: Number(row.freshness),
    status: row.status as MemoryStatus,
    valid_from: row.valid_from ? iso(row.valid_from) : null,
    valid_until: row.valid_until ? iso(row.valid_until) : null,
    applies_to: (parseJson(row.applies_to) ?? []) as string[],
    entities: (parseJson(row.entities) ?? []) as string[],
    created_by_run_id: String(row.run_id),
    created_at: iso(row.created_at),
    embedding:
      row.embedding_model && row.embedding_dimension
        ? { model: String(row.embedding_model), dimensions: Number(row.embedding_dimension) }
        : null,
  };
}

function mergeStoredContract<T extends object>(row: QueryResultRow, overrides: Partial<T>): T {
  const stored = (parseJson(row.data) ?? {}) as T;
  return { ...stored, ...overrides };
}

export interface IngestedSource {
  source: SourceEvent;
  run: AgentRun;
  deduplicated: boolean;
}

export interface RunEventInput {
  id?: string;
  event_type?: RunEvent["event_type"];
  type?: RunEvent["event_type"];
  agent: Agent;
  execution_mode?: ExecutionMode;
  safe_summary?: string;
  payload?: RunEvent["payload"];
  occurred_at?: string;
}

export interface RunStateUpdate {
  status?: RunStatus;
  current_step?: AgentRun["current_step"] | null;
  execution_mode?: ExecutionMode;
  attempt?: number;
  cancellation_requested?: boolean;
  safe_summary?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface RunStepInput {
  id?: string;
  step: WorkflowStepName | string;
  agent: AgentName;
  status: StepStatus;
  attempt?: number;
  provider_interaction_id?: string | null;
  environment_id?: string | null;
  prompt_version?: string | null;
  raw_report?: JsonValue | null;
  validated_output?: JsonValue | null | undefined;
  safe_summary?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface IdempotentResponse {
  status: number;
  resourceType: string | null;
  resourceId: string | null;
  body: JsonValue | null;
  requestHash: string;
}

export class GroundMeshStore {
  constructor(private readonly database: GroundMeshDatabase) {}

  private async insertWorkspace(executor: DatabaseExecutor, workspaceId: string, name?: string): Promise<void> {
    const label = name?.trim() || "GroundMesh Demo";
    await executor.query(
      `INSERT INTO workspaces(id, slug, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
      [workspaceId, `${safeSlug(label)}-${hashValue(workspaceId).slice(0, 8)}`, label],
    );
    for (const [code, authority] of Object.entries(AUTHORITY_DEFAULTS)) {
      await executor.query(
        `INSERT INTO authority_profiles(id, workspace_id, code, label, authority)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (workspace_id, code) DO UPDATE SET label = EXCLUDED.label, authority = EXCLUDED.authority`,
        [remapFixtureId(workspaceId, `authority:${code}`), workspaceId, code, code.replaceAll("_", " "), authority],
      );
    }
    for (const code of ["orchestrator", "maya", "rook", "vera", "context_composer", "action_guard", "human"] as const) {
      await executor.query(
        `INSERT INTO agents(id, workspace_id, code, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, code) DO NOTHING`,
        [remapFixtureId(workspaceId, `agent:${code}`), workspaceId, code, code.replaceAll("_", " ")],
      );
    }
  }

  async ensureWorkspace(workspaceId: string, name?: string): Promise<WorkspaceRow> {
    await this.database.transaction((transaction) => this.insertWorkspace(transaction, workspaceId, name));
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw new Error(`Workspace ${workspaceId} could not be created`);
    return workspace;
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
    const rows = await this.database.query(`SELECT * FROM workspaces WHERE id = $1`, [workspaceId]);
    return rows[0] ? fromRow<WorkspaceRow>(rows[0]) : null;
  }

  async createWorkspaceSession(input: {
    sessionId?: string;
    workspaceId: string;
    sessionHash: string;
    expiresAt: string;
    metadata?: JsonObject;
  }): Promise<string> {
    await this.ensureWorkspace(input.workspaceId);
    const id = input.sessionId ?? randomUUID();
    await this.database.query(
      `INSERT INTO browser_sessions(id, workspace_id, session_hash, expires_at, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (session_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at, metadata = EXCLUDED.metadata`,
      [id, input.workspaceId, input.sessionHash, input.expiresAt, json(input.metadata ?? {})],
    );
    return id;
  }

  async workspaceForSession(sessionHash: string): Promise<string | null> {
    const rows = await this.database.query(
      `SELECT workspace_id FROM browser_sessions WHERE session_hash = $1 AND expires_at > now()`,
      [sessionHash],
    );
    return rows[0] ? String(rows[0].workspace_id) : null;
  }

  async getIdempotentResponse(
    workspaceId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<IdempotentResponse | null> {
    const rows = await this.database.query(
      `SELECT request_hash, response_status, resource_type, resource_id, response_body
       FROM idempotency_keys
       WHERE workspace_id = $1 AND operation = $2 AND idempotency_key = $3 AND expires_at > now()`,
      [workspaceId, operation, idempotencyKey],
    );
    const row = rows[0];
    if (!row || row.response_status === null) return null;
    return {
      status: Number(row.response_status),
      resourceType: row.resource_type ? String(row.resource_type) : null,
      resourceId: row.resource_id ? String(row.resource_id) : null,
      body: parseJson(row.response_body) as JsonValue | null,
      requestHash: String(row.request_hash),
    };
  }

  async saveIdempotentResponse(
    workspaceId: string,
    operation: string,
    idempotencyKey: string,
    requestHash: string,
    response: { status: number; body: JsonValue; resourceType?: string; resourceId?: string },
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO idempotency_keys(
         workspace_id, operation, idempotency_key, request_hash, response_status,
         resource_type, resource_id, response_body, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
       ON CONFLICT (workspace_id, operation, idempotency_key) DO UPDATE SET
         response_status = EXCLUDED.response_status,
         resource_type = EXCLUDED.resource_type,
         resource_id = EXCLUDED.resource_id,
         response_body = EXCLUDED.response_body,
         completed_at = now()`,
      [
        workspaceId,
        operation,
        idempotencyKey,
        requestHash,
        response.status,
        response.resourceType ?? null,
        response.resourceId ?? null,
        json(response.body),
      ],
    );
  }

  private async sourceById(executor: DatabaseExecutor, workspaceId: string, sourceId: string): Promise<SourceEvent | null> {
    const rows = await executor.query(
      `SELECT s.*, ap.code AS authority_role
       FROM sources s JOIN authority_profiles ap ON ap.id = s.authority_profile_id
       WHERE s.workspace_id = $1 AND s.id = $2`,
      [workspaceId, sourceId],
    );
    return rows[0] ? toSourceEvent(rows[0]) : null;
  }

  private async runById(executor: DatabaseExecutor, workspaceId: string, runId: string): Promise<AgentRun | null> {
    const rows = await executor.query(`SELECT * FROM runs WHERE workspace_id = $1 AND id = $2`, [workspaceId, runId]);
    return rows[0] ? toAgentRun(rows[0]) : null;
  }

  async ingestSource(
    workspaceId: string,
    input: IngestEventRequest & { id?: string; authority_role?: AuthorityRole },
    idempotencyKey: string,
  ): Promise<IngestedSource> {
    await this.ensureWorkspace(workspaceId);
    const requestHash = hashValue(input);
    return this.database.transaction(async (transaction) => {
      const existingKeys = await transaction.query(
        `SELECT * FROM idempotency_keys
         WHERE workspace_id = $1 AND operation = 'ingest_source' AND idempotency_key = $2
         FOR UPDATE`,
        [workspaceId, idempotencyKey],
      );
      const existing = existingKeys[0];
      if (existing) {
        if (String(existing.request_hash) !== requestHash) {
          throw new Error("Idempotency key was already used with a different request");
        }
        const response = parseJson(existing.response_body) as { source_event_id?: string; run_id?: string } | null;
        if (response?.source_event_id && response.run_id) {
          const [source, run] = await Promise.all([
            this.sourceById(transaction, workspaceId, response.source_event_id),
            this.runById(transaction, workspaceId, response.run_id),
          ]);
          if (source && run) return { source, run, deduplicated: true };
        }
      } else {
        await transaction.query(
          `INSERT INTO idempotency_keys(workspace_id, operation, idempotency_key, request_hash)
           VALUES ($1,'ingest_source',$2,$3)`,
          [workspaceId, idempotencyKey, requestHash],
        );
      }

      const sourceHash = hashValue({
        source_type: input.source_type,
        content: input.content,
        source_timestamp: input.source_timestamp,
        metadata: input.metadata,
      });
      const duplicateSources = await transaction.query(
        `SELECT s.*, ap.code AS authority_role
         FROM sources s JOIN authority_profiles ap ON ap.id = s.authority_profile_id
         WHERE s.workspace_id = $1 AND s.source_hash = $2`,
        [workspaceId, sourceHash],
      );
      if (duplicateSources[0]) {
        const priorRuns = await transaction.query(
          `SELECT * FROM runs WHERE workspace_id = $1 AND source_id = $2 ORDER BY created_at DESC LIMIT 1`,
          [workspaceId, duplicateSources[0].id],
        );
        if (priorRuns[0]) {
          const body = {
            source_event_id: String(duplicateSources[0].id),
            run_id: String(priorRuns[0].id),
            status: "queued",
          };
          await transaction.query(
            `UPDATE idempotency_keys SET response_status = 202, resource_type = 'run', resource_id = $4,
               response_body = $5::jsonb, completed_at = now()
             WHERE workspace_id = $1 AND operation = 'ingest_source' AND idempotency_key = $2 AND request_hash = $3`,
            [workspaceId, idempotencyKey, requestHash, priorRuns[0].id, json(body)],
          );
          return {
            source: toSourceEvent(duplicateSources[0]),
            run: toAgentRun(priorRuns[0]),
            deduplicated: true,
          };
        }
      }

      const sourceId = input.id ?? randomUUID();
      const runId = randomUUID();
      const eventId = randomUUID();
      const outboxId = randomUUID();
      const authorityRole = input.authority_role ?? authorityRoleForSource(input.source_type);
      const authorityRows = await transaction.query(
        `SELECT id FROM authority_profiles WHERE workspace_id = $1 AND code = $2`,
        [workspaceId, authorityRole],
      );
      const authorityProfileId = authorityRows[0]?.id;
      if (!authorityProfileId) throw new Error(`Missing authority profile ${authorityRole}`);

      const sourceRows = await transaction.query(
        `INSERT INTO sources(
           id, workspace_id, type, author, title, body, source_timestamp, received_at,
           authority_profile_id, source_hash, linked_entities, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10::jsonb,$11::jsonb)
         RETURNING *`,
        [
          sourceId,
          workspaceId,
          input.source_type,
          input.author,
          input.title ?? input.source_type.replaceAll("_", " "),
          input.content,
          input.source_timestamp,
          authorityProfileId,
          sourceHash,
          json(input.linked_entities),
          json(input.metadata),
        ],
      );
      const runRows = await transaction.query(
        `INSERT INTO runs(
           id, workspace_id, source_id, kind, status, execution_mode, current_step, safe_summary
         ) VALUES ($1,$2,$3,'ingestion','queued','live_antigravity','source_received','Source accepted; workflow queued.')
         RETURNING *`,
        [runId, workspaceId, sourceId],
      );
      await transaction.query(
        `INSERT INTO run_events(
           id, schema_version, workspace_id, run_id, sequence, event_type, agent,
           execution_mode, safe_summary, payload
         ) VALUES ($1,'1',$2,$3,1,'source_received','orchestrator','live_antigravity',$4,$5::jsonb)`,
        [eventId, workspaceId, runId, "Source accepted and queued.", json({ source_event_id: sourceId })],
      );
      await transaction.query(
        `INSERT INTO outbox_jobs(id, workspace_id, run_id, job_type, idempotency_key, payload)
         VALUES ($1,$2,$3,'process_run',$4,$5::jsonb)`,
        [outboxId, workspaceId, runId, `process:${runId}`, json({ run_id: runId, workspace_id: workspaceId })],
      );
      const body = { source_event_id: sourceId, run_id: runId, status: "queued" };
      await transaction.query(
        `UPDATE idempotency_keys SET response_status = 202, resource_type = 'run', resource_id = $4,
           response_body = $5::jsonb, completed_at = now()
         WHERE workspace_id = $1 AND operation = 'ingest_source' AND idempotency_key = $2 AND request_hash = $3`,
        [workspaceId, idempotencyKey, requestHash, runId, json(body)],
      );
      await transaction.query(`UPDATE workspaces SET truth_status = 'updating', updated_at = now() WHERE id = $1`, [workspaceId]);

      const sourceRow = sourceRows[0];
      const runRow = runRows[0];
      if (!sourceRow || !runRow) throw new Error("Ingestion transaction did not return its records");
      return {
        source: toSourceEvent({ ...sourceRow, authority_role: authorityRole }),
        run: toAgentRun(runRow),
        deduplicated: false,
      };
    });
  }

  async getSource(workspaceId: string, sourceId: string): Promise<SourceEvent | null> {
    return this.sourceById(this.database, workspaceId, sourceId);
  }

  async listSources(workspaceId: string, limit = 100): Promise<SourceEvent[]> {
    const rows = await this.database.query(
      `SELECT s.*, ap.code AS authority_role
       FROM sources s JOIN authority_profiles ap ON ap.id = s.authority_profile_id
       WHERE s.workspace_id = $1 ORDER BY s.received_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return rows.map(toSourceEvent);
  }

  async getRun(workspaceId: string, runId: string): Promise<AgentRun | null> {
    return this.runById(this.database, workspaceId, runId);
  }

  async listRuns(workspaceId: string, limit = 50): Promise<AgentRun[]> {
    const rows = await this.database.query(
      `SELECT * FROM runs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return rows.map(toAgentRun);
  }

  async listRunEvents(workspaceId: string, runId: string, after = 0): Promise<RunEvent[]> {
    const rows = await this.database.query(
      `SELECT * FROM run_events
       WHERE workspace_id = $1 AND run_id = $2 AND sequence > $3
       ORDER BY sequence ASC`,
      [workspaceId, runId, after],
    );
    return rows.map(toRunEvent);
  }

  async appendRunEvent(workspaceId: string, runId: string, input: RunEventInput): Promise<RunEvent> {
    return this.database.transaction(async (transaction) => {
      const runRows = await transaction.query(
        `SELECT execution_mode FROM runs WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
        [workspaceId, runId],
      );
      const run = runRows[0];
      if (!run) throw new Error(`Run ${runId} was not found in workspace ${workspaceId}`);
      const sequenceRows = await transaction.query(
        `SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM run_events WHERE run_id = $1`,
        [runId],
      );
      const sequence = Number(sequenceRows[0]?.sequence ?? 1);
      const eventType = input.event_type ?? input.type;
      if (!eventType) throw new Error("Run event requires event_type");
      const rows = await transaction.query(
        `INSERT INTO run_events(
           id, schema_version, workspace_id, run_id, sequence, event_type, agent,
           execution_mode, safe_summary, payload, occurred_at
         ) VALUES ($1,'1',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,COALESCE($10::timestamptz,now()))
         RETURNING *`,
        [
          input.id ?? randomUUID(),
          workspaceId,
          runId,
          sequence,
          eventType,
          input.agent,
          input.execution_mode ?? (run.execution_mode as ExecutionMode),
          input.safe_summary ?? eventType.replaceAll("_", " "),
          json(input.payload ?? {}),
          input.occurred_at ?? null,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("Run event insert failed");
      return toRunEvent(row);
    });
  }

  async setRunState(
    workspaceId: string,
    runId: string,
    state: RunStateUpdate | RunStatus,
  ): Promise<AgentRun> {
    const update: RunStateUpdate = typeof state === "string" ? { status: state } : state;
    const assignments: string[] = [];
    const values: unknown[] = [workspaceId, runId];
    const columns: Array<[keyof RunStateUpdate, string]> = [
      ["status", "status"],
      ["current_step", "current_step"],
      ["execution_mode", "execution_mode"],
      ["attempt", "attempt"],
      ["cancellation_requested", "cancellation_requested"],
      ["safe_summary", "safe_summary"],
      ["error_code", "error_code"],
      ["error_message", "error_message"],
      ["started_at", "started_at"],
      ["completed_at", "completed_at"],
    ];
    for (const [key, column] of columns) {
      if (!(key in update)) continue;
      values.push(update[key] ?? null);
      assignments.push(`${column} = $${values.length}`);
    }
    if (assignments.length === 0) {
      const current = await this.getRun(workspaceId, runId);
      if (!current) throw new Error(`Run ${runId} was not found`);
      return current;
    }
    assignments.push("updated_at = now()");
    const rows = await this.database.query(
      `UPDATE runs SET ${assignments.join(", ")}
       WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      values,
    );
    const row = rows[0];
    if (!row) throw new Error(`Run ${runId} was not found`);

    const status = (update.status ?? row.status) as RunStatus;
    if (["completed", "needs_review", "failed", "cancelled"].includes(status)) {
      const attentionRows = await this.database.query(
        `SELECT
           EXISTS(SELECT 1 FROM runs WHERE workspace_id = $1 AND status IN ('queued','running')) AS active,
           EXISTS(SELECT 1 FROM conflicts WHERE workspace_id = $1 AND status IN ('open','needs_review') AND severity IN ('high','critical')) AS attention,
           EXISTS(SELECT 1 FROM runs WHERE workspace_id = $1 AND status = 'failed') AS failed`,
        [workspaceId],
      );
      const counts = attentionRows[0];
      const truth = counts?.active ? "updating" : counts?.attention || counts?.failed ? "needs_attention" : "verified";
      await this.database.query(`UPDATE workspaces SET truth_status = $2, updated_at = now() WHERE id = $1`, [workspaceId, truth]);
    }
    return toAgentRun(row);
  }

  async requestRunCancellation(workspaceId: string, runId: string): Promise<AgentRun> {
    return this.setRunState(workspaceId, runId, { cancellation_requested: true, safe_summary: "Cancellation requested." });
  }

  async upsertRunStep(workspaceId: string, runId: string, input: RunStepInput): Promise<WorkflowStepRow> {
    const attempt = input.attempt ?? 1;
    const rows = await this.database.query(
      `INSERT INTO workflow_steps(
         id, workspace_id, run_id, step, agent, status, attempt, provider_interaction_id,
         environment_id, prompt_version, raw_report, validated_output, safe_summary,
         error_code, error_message, started_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17)
       ON CONFLICT (run_id, step, attempt) DO UPDATE SET
         agent = EXCLUDED.agent,
         status = EXCLUDED.status,
         provider_interaction_id = EXCLUDED.provider_interaction_id,
         environment_id = EXCLUDED.environment_id,
         prompt_version = EXCLUDED.prompt_version,
         raw_report = EXCLUDED.raw_report,
         validated_output = EXCLUDED.validated_output,
         safe_summary = EXCLUDED.safe_summary,
         error_code = EXCLUDED.error_code,
         error_message = EXCLUDED.error_message,
         started_at = COALESCE(EXCLUDED.started_at, workflow_steps.started_at),
         completed_at = EXCLUDED.completed_at,
         updated_at = now()
       RETURNING *`,
      [
        input.id ?? randomUUID(),
        workspaceId,
        runId,
        input.step,
        input.agent,
        input.status,
        attempt,
        input.provider_interaction_id ?? null,
        input.environment_id ?? null,
        input.prompt_version ?? null,
        input.raw_report === undefined ? null : json(input.raw_report),
        input.validated_output === undefined ? null : json(input.validated_output),
        input.safe_summary ?? null,
        input.error_code ?? null,
        input.error_message ?? null,
        input.started_at ?? null,
        input.completed_at ?? null,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("Workflow step upsert failed");
    return fromRow<WorkflowStepRow>(row);
  }

  async listRunSteps(workspaceId: string, runId: string): Promise<WorkflowStepRow[]> {
    const rows = await this.database.query(
      `SELECT * FROM workflow_steps WHERE workspace_id = $1 AND run_id = $2 ORDER BY created_at, attempt`,
      [workspaceId, runId],
    );
    return fromRows<WorkflowStepRow>(rows);
  }

  async claimOutboxJobs(limit = 10): Promise<Array<Record<string, unknown>>> {
    return this.database.transaction(async (transaction) => {
      const rows = await transaction.query(
        `SELECT * FROM outbox_jobs
         WHERE status = 'pending' AND available_at <= now()
         ORDER BY available_at, created_at
         FOR UPDATE SKIP LOCKED LIMIT $1`,
        [limit],
      );
      if (rows.length === 0) return [];
      const ids = rows.map((row) => String(row.id));
      for (const id of ids) {
        await transaction.query(
          `UPDATE outbox_jobs SET status = 'processing', attempts = attempts + 1,
             locked_at = now(), updated_at = now() WHERE id = $1`,
          [id],
        );
      }
      return rows.map((row) => fromRow<Record<string, unknown>>({ ...row, status: "processing" }));
    });
  }

  async completeOutboxJob(jobId: string, error?: string): Promise<void> {
    if (error) {
      await this.database.query(
        `UPDATE outbox_jobs SET status = 'pending', last_error = $2,
           available_at = now() + (LEAST(attempts, 6) * interval '2 seconds'), updated_at = now()
         WHERE id = $1`,
        [jobId, error],
      );
      return;
    }
    await this.database.query(
      `UPDATE outbox_jobs SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1`,
      [jobId],
    );
  }

  private async insertMemoryAtom(
    executor: DatabaseExecutor,
    workspaceId: string,
    atom: MemoryAtom & { embedding_values?: number[] },
  ): Promise<MemoryAtom> {
    const existingRows = await executor.query(
      `SELECT status FROM memory_atoms WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, atom.id],
    );
    const existingStatus = existingRows[0]?.status as MemoryStatus | undefined;
    const directness = atom.evidence_kind === "explicit" ? 1 : 0.5;
    const corroboration = Number((atom as unknown as { corroboration_score?: number }).corroboration_score ?? 0);
    const resolutionScore = Math.min(
      1,
      atom.authority_score * 0.5 + atom.freshness_score * 0.25 + directness * 0.15 + corroboration * 0.1,
    );
    const embeddingValues = atom.embedding_values ?? null;
    const embeddingCast = executor.dialect === "postgres" ? "$25::vector" : "$25::jsonb";
    const embeddingParameter = embeddingValues
      ? executor.dialect === "postgres"
        ? `[${embeddingValues.join(",")}]`
        : json(embeddingValues)
      : null;
    const rows = await executor.query(
      `INSERT INTO memory_atoms(
         id, workspace_id, source_id, run_id, entity_id, kind, topic, subject, predicate,
         object, statement, evidence_kind, source_timestamp, authority_role, status,
         authority, freshness, directness, corroboration, resolution_score, confidence,
         valid_from, valid_until, embedding_model, embedding_dimension, embedding,
         applies_to, entities, metadata, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,$24,${embeddingCast},$26::jsonb,$27::jsonb,$28::jsonb,$29,$29
       )
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         freshness = EXCLUDED.freshness,
         resolution_score = EXCLUDED.resolution_score,
         confidence = EXCLUDED.confidence,
         valid_until = EXCLUDED.valid_until,
         embedding_model = EXCLUDED.embedding_model,
         embedding_dimension = EXCLUDED.embedding_dimension,
         embedding = EXCLUDED.embedding,
         applies_to = EXCLUDED.applies_to,
         entities = EXCLUDED.entities,
         metadata = EXCLUDED.metadata,
         updated_at = now()
       RETURNING *`,
      [
        atom.id,
        workspaceId,
        atom.source_event_id,
        atom.created_by_run_id,
        atom.memory_type,
        `${atom.subject}:${atom.predicate}`.toLowerCase(),
        atom.subject,
        atom.predicate,
        atom.object_value,
        atom.claim,
        atom.evidence_kind,
        atom.source_timestamp,
        atom.authority_role,
        atom.status,
        atom.authority_score,
        atom.freshness_score,
        directness,
        corroboration,
        resolutionScore,
        atom.confidence_score,
        atom.valid_from,
        atom.valid_until,
        atom.embedding?.model ?? null,
        atom.embedding?.dimensions ?? null,
        embeddingParameter,
        json(atom.applies_to),
        json(atom.entities),
        json({ schema_version: atom.schema_version }),
        atom.created_at,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error(`Memory atom ${atom.id} could not be inserted`);
    if (!existingStatus || existingStatus !== atom.status) {
      await executor.query(
        `INSERT INTO memory_status_history(
           id, workspace_id, memory_id, from_status, to_status, run_id, reason, changed_by, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'orchestrator',$8)`,
        [
          randomUUID(),
          workspaceId,
          atom.id,
          existingStatus ?? null,
          atom.status,
          atom.created_by_run_id,
          existingStatus ? "memory_upserted" : "memory_created",
          atom.created_at,
        ],
      );
    }
    for (const entityName of atom.entities) {
      const canonicalName = entityName.trim();
      if (!canonicalName) continue;
      const entityId = scopedFixtureId(workspaceId, `entity:${canonicalName.toLowerCase()}`);
      await executor.query(
        `INSERT INTO entities(id, workspace_id, type, canonical_name, aliases)
         VALUES ($1,$2,'named_entity',$3,'[]'::jsonb)
         ON CONFLICT (workspace_id, type, canonical_name) DO NOTHING`,
        [entityId, workspaceId, canonicalName],
      );
      await executor.query(
        `INSERT INTO memory_entities(workspace_id, memory_id, entity_id)
         SELECT $1,$2,id FROM entities
         WHERE workspace_id = $1 AND type = 'named_entity' AND canonical_name = $3
         ON CONFLICT (workspace_id, memory_id, entity_id) DO NOTHING`,
        [workspaceId, atom.id, canonicalName],
      );
    }
    for (const agentCode of atom.applies_to) {
      const code = agentCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
      if (!code) continue;
      const agentId = scopedFixtureId(workspaceId, `agent:${code}`);
      await executor.query(
        `INSERT INTO agents(id, workspace_id, code, display_name)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (workspace_id, code) DO NOTHING`,
        [agentId, workspaceId, code, agentCode.replaceAll("_", " ")],
      );
      await executor.query(
        `INSERT INTO memory_agents(workspace_id, memory_id, agent_id)
         SELECT $1,$2,id FROM agents WHERE workspace_id = $1 AND code = $3
         ON CONFLICT (workspace_id, memory_id, agent_id) DO NOTHING`,
        [workspaceId, atom.id, code],
      );
    }
    return toMemoryAtom(row);
  }

  async insertMemoryAtoms(
    workspaceId: string,
    atoms: Array<MemoryAtom & { embedding_values?: number[] }>,
  ): Promise<MemoryAtom[]> {
    return this.database.transaction(async (transaction) => {
      const inserted: MemoryAtom[] = [];
      for (const atom of atoms) inserted.push(await this.insertMemoryAtom(transaction, workspaceId, atom));
      return inserted;
    });
  }

  async getMemoryAtom(workspaceId: string, memoryId: string): Promise<MemoryAtom | null> {
    const rows = await this.database.query(
      `SELECT * FROM memory_atoms WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, memoryId],
    );
    return rows[0] ? toMemoryAtom(rows[0]) : null;
  }

  async listMemoryAtoms(
    workspaceId: string,
    options: { status?: MemoryStatus; topic?: string; entity?: string; limit?: number } = {},
  ): Promise<MemoryAtom[]> {
    const clauses = ["workspace_id = $1"];
    const parameters: unknown[] = [workspaceId];
    if (options.status) {
      parameters.push(options.status);
      clauses.push(`status = $${parameters.length}`);
    }
    if (options.topic) {
      parameters.push(options.topic);
      clauses.push(`topic = $${parameters.length}`);
    }
    if (options.entity) {
      parameters.push(json([options.entity]));
      clauses.push(`entities @> $${parameters.length}::jsonb`);
    }
    parameters.push(options.limit ?? 250);
    const rows = await this.database.query(
      `SELECT * FROM memory_atoms WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC LIMIT $${parameters.length}`,
      parameters,
    );
    return rows.map(toMemoryAtom);
  }

  async findRelatedMemories(
    workspaceId: string,
    input: { subject?: string; predicate?: string; topic?: string; entities?: string[]; limit?: number },
  ): Promise<MemoryAtom[]> {
    const terms = [input.subject, input.predicate, input.topic, ...(input.entities ?? [])]
      .filter((term): term is string => Boolean(term?.trim()))
      .map((term) => `%${term}%`);
    if (terms.length === 0) return this.listMemoryAtoms(workspaceId, { status: "active", limit: input.limit ?? 40 });
    const clauses: string[] = [];
    const parameters: unknown[] = [workspaceId];
    for (const term of terms) {
      parameters.push(term);
      clauses.push(`(subject ILIKE $${parameters.length} OR predicate ILIKE $${parameters.length} OR topic ILIKE $${parameters.length} OR statement ILIKE $${parameters.length})`);
    }
    parameters.push(input.limit ?? 40);
    const rows = await this.database.query(
      `SELECT * FROM memory_atoms
       WHERE workspace_id = $1 AND status IN ('active','disputed') AND (${clauses.join(" OR ")})
       ORDER BY authority DESC, freshness DESC, confidence DESC LIMIT $${parameters.length}`,
      parameters,
    );
    return rows.map(toMemoryAtom);
  }

  async transitionMemoryStatuses(
    workspaceId: string,
    transitions: Array<{
      memory_id?: string;
      memoryId?: string;
      to_status?: MemoryStatus;
      toStatus?: MemoryStatus;
      reason: string;
      changed_by?: Agent;
      changedBy?: Agent;
      run_id?: string | null;
      runId?: string | null;
      superseded_by_memory_id?: string | null | undefined;
      supersededByMemoryId?: string | null | undefined;
    }>,
  ): Promise<MemoryAtom[]> {
    return this.database.transaction(async (transaction) => {
      const updated: MemoryAtom[] = [];
      for (const transition of transitions) {
        const memoryId = transition.memory_id ?? transition.memoryId;
        const toStatus = transition.to_status ?? transition.toStatus;
        if (!memoryId || !toStatus) throw new Error("Memory transition requires memory id and target status");
        const currentRows = await transaction.query(
          `SELECT * FROM memory_atoms WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
          [workspaceId, memoryId],
        );
        const current = currentRows[0];
        if (!current) throw new Error(`Memory atom ${memoryId} was not found`);
        const rows = await transaction.query(
          `UPDATE memory_atoms SET status = $3,
             freshness = CASE WHEN $3 IN ('stale','superseded','rejected') THEN 0 ELSE freshness END,
             updated_at = now()
           WHERE workspace_id = $1 AND id = $2 RETURNING *`,
          [workspaceId, memoryId, toStatus],
        );
        const runId = transition.run_id ?? transition.runId ?? null;
        await transaction.query(
          `INSERT INTO memory_status_history(
             id, workspace_id, memory_id, from_status, to_status, run_id, reason, changed_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            randomUUID(),
            workspaceId,
            memoryId,
            current.status,
            toStatus,
            runId,
            transition.reason,
            transition.changed_by ?? transition.changedBy ?? "orchestrator",
          ],
        );
        const supersededBy = transition.superseded_by_memory_id ?? transition.supersededByMemoryId;
        if (toStatus === "superseded" && supersededBy) {
          await transaction.query(
            `INSERT INTO memory_edges(id, workspace_id, from_memory_id, to_memory_id, relation, run_id)
             VALUES ($1,$2,$3,$4,'supersedes',$5)
             ON CONFLICT (workspace_id, from_memory_id, to_memory_id, relation) DO NOTHING`,
            [randomUUID(), workspaceId, supersededBy, memoryId, runId],
          );
        }
        const row = rows[0];
        if (row) updated.push(toMemoryAtom(row));
      }
      await transaction.query(
        `UPDATE context_packs SET status = 'invalidated', invalidated_at = now(),
           invalidation_reason = 'Related truth changed', updated_at = now()
         WHERE workspace_id = $1 AND status IN ('verified','verified_with_warning','needs_review')`,
        [workspaceId],
      );
      return updated;
    });
  }

  async createConflict(workspaceId: string, conflict: Conflict): Promise<Conflict> {
    const left = conflict.memory_atom_ids[0];
    const right = conflict.memory_atom_ids[1];
    if (!left || !right) throw new Error("A conflict requires at least two memory atoms");
    await this.database.query(
      `INSERT INTO conflicts(
         id, workspace_id, run_id, topic, left_memory_id, right_memory_id, winner_memory_id,
         severity, status, reason, resolution, data, created_at, resolved_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11::jsonb,$12,$13,$12)
       ON CONFLICT (id) DO UPDATE SET
         winner_memory_id = EXCLUDED.winner_memory_id,
         severity = EXCLUDED.severity,
         status = EXCLUDED.status,
         reason = EXCLUDED.reason,
         data = EXCLUDED.data,
         resolved_at = EXCLUDED.resolved_at,
         updated_at = now()
       RETURNING *`,
      [
        conflict.id,
        workspaceId,
        conflict.created_by_run_id,
        conflict.explanation.slice(0, 120),
        left,
        right,
        conflict.resolved_by_memory_id,
        conflict.severity,
        conflict.status,
        conflict.explanation,
        json(conflict),
        conflict.created_at,
        conflict.resolved_at,
      ],
    );
    return conflict;
  }

  async getConflict(workspaceId: string, conflictId: string): Promise<Conflict | null> {
    const rows = await this.database.query(`SELECT * FROM conflicts WHERE workspace_id = $1 AND id = $2`, [workspaceId, conflictId]);
    if (!rows[0]) return null;
    return mergeStoredContract<Conflict>(rows[0], {
      status: rows[0].status as Conflict["status"],
      severity: rows[0].severity as Conflict["severity"],
      resolved_at: rows[0].resolved_at ? iso(rows[0].resolved_at) : null,
      resolved_by_memory_id: rows[0].winner_memory_id ? String(rows[0].winner_memory_id) : null,
    });
  }

  async listConflicts(workspaceId: string, status?: Conflict["status"]): Promise<Conflict[]> {
    const rows = status
      ? await this.database.query(
          `SELECT * FROM conflicts WHERE workspace_id = $1 AND status = $2 ORDER BY created_at DESC`,
          [workspaceId, status],
        )
      : await this.database.query(`SELECT * FROM conflicts WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
    return rows.map((row) =>
      mergeStoredContract<Conflict>(row, {
        status: row.status as Conflict["status"],
        severity: row.severity as Conflict["severity"],
        resolved_at: row.resolved_at ? iso(row.resolved_at) : null,
        resolved_by_memory_id: row.winner_memory_id ? String(row.winner_memory_id) : null,
      }),
    );
  }

  async createContextPack(workspaceId: string, pack: ContextPack): Promise<ContextPack> {
    return this.database.transaction(async (transaction) => {
      const latestRuns = await transaction.query(
        `SELECT id FROM runs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [workspaceId],
      );
      const runId = latestRuns[0]?.id ?? null;
      await transaction.query(
        `INSERT INTO context_packs(
           id, workspace_id, run_id, requesting_agent, task, scope, confidence, status,
           expires_at, invalidated_at, data, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$12)
         ON CONFLICT (id) DO UPDATE SET
           requesting_agent = EXCLUDED.requesting_agent,
           task = EXCLUDED.task,
           scope = EXCLUDED.scope,
           confidence = EXCLUDED.confidence,
           status = EXCLUDED.status,
           expires_at = EXCLUDED.expires_at,
           invalidated_at = EXCLUDED.invalidated_at,
           data = EXCLUDED.data,
           updated_at = now()`,
        [
          pack.id,
          workspaceId,
          runId,
          pack.requesting_agent,
          pack.task,
          json(pack.scope),
          pack.confidence,
          pack.status,
          pack.expires_at,
          pack.invalidated_at,
          json(pack),
          pack.created_at,
        ],
      );
      const memoryIds = new Set<string>();
      for (const fact of pack.verified_facts) memoryIds.add(fact.memory_atom_id);
      for (const policy of pack.applicable_policies) memoryIds.add(policy.memory_atom_id);
      for (const blocked of pack.blocked_claims) memoryIds.add(blocked.policy_memory_id);
      let rank = 0;
      for (const memoryId of memoryIds) {
        await transaction.query(
          `INSERT INTO context_pack_memories(workspace_id, context_pack_id, memory_id, rank)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (workspace_id, context_pack_id, memory_id) DO UPDATE SET rank = EXCLUDED.rank`,
          [workspaceId, pack.id, memoryId, rank++],
        );
      }
      const requestingAgentCode = pack.requesting_agent
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
      if (requestingAgentCode) {
        const agentId = scopedFixtureId(workspaceId, `agent:${requestingAgentCode}`);
        await transaction.query(
          `INSERT INTO agents(id, workspace_id, code, display_name)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (workspace_id, code) DO NOTHING`,
          [agentId, workspaceId, requestingAgentCode, pack.requesting_agent],
        );
        await transaction.query(
          `INSERT INTO context_pack_agents(workspace_id, context_pack_id, agent_id)
           SELECT $1,$2,id FROM agents WHERE workspace_id = $1 AND code = $3
           ON CONFLICT (workspace_id, context_pack_id, agent_id) DO NOTHING`,
          [workspaceId, pack.id, requestingAgentCode],
        );
      }
      return pack;
    });
  }

  async getContextPack(workspaceId: string, contextPackId: string): Promise<ContextPack | null> {
    const rows = await this.database.query(
      `SELECT * FROM context_packs WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, contextPackId],
    );
    const row = rows[0];
    if (!row) return null;
    const expired = Date.parse(iso(row.expires_at)) <= Date.now();
    const status = expired && row.status !== "invalidated" ? "expired" : (row.status as ContextPack["status"]);
    return mergeStoredContract<ContextPack>(row, {
      status,
      expires_at: iso(row.expires_at),
      invalidated_at: row.invalidated_at ? iso(row.invalidated_at) : null,
    });
  }

  async listContextPacks(workspaceId: string, limit = 30): Promise<ContextPack[]> {
    const rows = await this.database.query(
      `SELECT * FROM context_packs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return Promise.all(rows.map((row) => this.getContextPack(workspaceId, String(row.id)))).then(
      (packs) => packs.filter((pack): pack is ContextPack => pack !== null),
    );
  }

  async invalidateContextPacks(workspaceId: string, reason: string, memoryIds?: string[]): Promise<number> {
    if (memoryIds && memoryIds.length > 0) {
      let count = 0;
      for (const memoryId of memoryIds) {
        count += await this.database.execute(
          `UPDATE context_packs SET status = 'invalidated', invalidated_at = now(),
             invalidation_reason = $3, updated_at = now()
           WHERE workspace_id = $1 AND status NOT IN ('invalidated','expired')
             AND id IN (SELECT context_pack_id FROM context_pack_memories WHERE workspace_id = $1 AND memory_id = $2)`,
          [workspaceId, memoryId, reason],
        );
      }
      return count;
    }
    return this.database.execute(
      `UPDATE context_packs SET status = 'invalidated', invalidated_at = now(),
         invalidation_reason = $2, updated_at = now()
       WHERE workspace_id = $1 AND status NOT IN ('invalidated','expired')`,
      [workspaceId, reason],
    );
  }

  private async createReviewRecord(executor: DatabaseExecutor, review: HumanReview): Promise<HumanReview> {
    await executor.query(
      `INSERT INTO human_reviews(
         id, workspace_id, subject_type, subject_id, status, requested_by, reviewer,
         proposed_wording, resolved_wording, rationale, resolution_memory_id, data,
         created_at, resolved_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,'action_guard',$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         reviewer = EXCLUDED.reviewer,
         resolved_wording = EXCLUDED.resolved_wording,
         rationale = EXCLUDED.rationale,
         resolution_memory_id = EXCLUDED.resolution_memory_id,
         data = EXCLUDED.data,
         resolved_at = EXCLUDED.resolved_at,
         updated_at = now()`,
      [
        review.id,
        review.workspace_id,
        review.subject_type,
        review.subject_id,
        review.status,
        review.reviewer,
        review.proposed_content,
        review.resolved_content,
        review.rationale,
        review.created_memory_id,
        json(review),
        review.created_at,
        review.resolved_at,
      ],
    );
    return review;
  }

  async createHumanReview(workspaceId: string, review: HumanReview): Promise<HumanReview> {
    if (review.workspace_id !== workspaceId) throw new Error("Review workspace mismatch");
    return this.createReviewRecord(this.database, review);
  }

  async createGuardDecision(workspaceId: string, decision: GuardDecision): Promise<GuardDecision> {
    return this.database.transaction(async (transaction) => {
      const governingMemoryId = decision.reasons.find((reason) => reason.policy_memory_id)?.policy_memory_id ?? null;
      const prohibitedClaim = decision.reasons.find((reason) => reason.claim)?.claim ?? null;
      let reviewId = decision.review_id;
      if ((decision.decision === "BLOCK" || decision.decision === "REQUIRE_APPROVAL") && !reviewId) {
        reviewId = randomUUID();
      }
      const storedDecision: GuardDecision = { ...decision, review_id: reviewId };
      const packRows = await transaction.query(
        `SELECT cp.run_id, COALESCE(r.execution_mode, 'live_antigravity') AS execution_mode
         FROM context_packs cp LEFT JOIN runs r ON r.id = cp.run_id
         WHERE cp.workspace_id = $1 AND cp.id = $2`,
        [workspaceId, decision.context_pack_id],
      );
      const contextRunId = packRows[0]?.run_id ?? null;
      const executionMode = (packRows[0]?.execution_mode ?? "live_antigravity") as ExecutionMode;
      await transaction.query(
        `INSERT INTO guard_decisions(
           id, workspace_id, context_pack_id, run_id, verdict, proposed_action,
           canonical_claim, prohibited_claim, governing_memory_id, confidence,
           explanation, citations, execution_mode, simulated, data
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb,$13,true,$14::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
         RETURNING *`,
        [
          decision.id,
          workspaceId,
          decision.context_pack_id,
          contextRunId,
          decision.decision,
          json(decision.proposed_action),
          decision.extracted_claims[0]?.text ?? null,
          prohibitedClaim,
          governingMemoryId,
          decision.extracted_claims[0]?.confidence ?? 0,
          decision.reasons.map((reason) => reason.message).join(" "),
          json([]),
          executionMode,
          json(storedDecision),
        ],
      );
      if (governingMemoryId) {
        await transaction.query(
          `INSERT INTO guard_decision_memories(workspace_id, guard_decision_id, memory_id, role)
           VALUES ($1,$2,$3,'governing_policy')
           ON CONFLICT (workspace_id, guard_decision_id, memory_id) DO NOTHING`,
          [workspaceId, decision.id, governingMemoryId],
        );
      }
      if (reviewId) {
        const review: HumanReview = {
          schema_version: CONTRACT_VERSION,
          id: reviewId,
          workspace_id: workspaceId,
          subject_type: decision.decision === "BLOCK" ? "correction" : "guard_decision",
          subject_id: decision.id,
          status: "pending",
          reviewer: null,
          proposed_content:
            decision.recommended_action?.message ?? decision.proposed_action.content,
          resolved_content: null,
          rationale: null,
          created_memory_id: null,
          created_at: decision.created_at,
          resolved_at: null,
        };
        await this.createReviewRecord(transaction, review);
        await transaction.query(
          `UPDATE workspaces SET truth_status = 'needs_attention', updated_at = now() WHERE id = $1`,
          [workspaceId],
        );
      }
      if (contextRunId && (decision.decision === "BLOCK" || decision.decision === "REQUIRE_APPROVAL")) {
        await transaction.query(`SELECT id FROM runs WHERE workspace_id = $1 AND id = $2 FOR UPDATE`, [workspaceId, contextRunId]);
        const sequenceRows = await transaction.query(
          `SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM run_events WHERE run_id = $1`,
          [contextRunId],
        );
        const eventType = decision.decision === "BLOCK" ? "action_blocked" : "human_review_required";
        const safeSummary =
          decision.decision === "BLOCK"
            ? "Action Guard blocked the simulated customer action."
            : "Action Guard requires human approval.";
        await transaction.query(
          `INSERT INTO run_events(
             id, schema_version, workspace_id, run_id, sequence, event_type, agent,
             execution_mode, safe_summary, payload
           ) VALUES ($1,'1',$2,$3,$4,$5,'action_guard',$6,$7,$8::jsonb)`,
          [
            randomUUID(),
            workspaceId,
            contextRunId,
            Number(sequenceRows[0]?.sequence ?? 1),
            eventType,
            executionMode,
            safeSummary,
            json({ guard_decision_id: decision.id, verdict: decision.decision, review_id: reviewId }),
          ],
        );
      }
      return storedDecision;
    });
  }

  async getGuardDecision(workspaceId: string, decisionId: string): Promise<GuardDecision | null> {
    const rows = await this.database.query(
      `SELECT * FROM guard_decisions WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, decisionId],
    );
    return rows[0] ? mergeStoredContract<GuardDecision>(rows[0], {}) : null;
  }

  async listGuardDecisions(workspaceId: string, limit = 50): Promise<GuardDecision[]> {
    const rows = await this.database.query(
      `SELECT * FROM guard_decisions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, limit],
    );
    return rows.map((row) => mergeStoredContract<GuardDecision>(row, {}));
  }

  private toReview(row: QueryResultRow): HumanReview {
    return mergeStoredContract<HumanReview>(row, {
      status: row.status as HumanReview["status"],
      reviewer: row.reviewer ? String(row.reviewer) : null,
      resolved_content: row.resolved_wording ? String(row.resolved_wording) : null,
      rationale: row.rationale ? String(row.rationale) : null,
      created_memory_id: row.resolution_memory_id ? String(row.resolution_memory_id) : null,
      resolved_at: row.resolved_at ? iso(row.resolved_at) : null,
    });
  }

  async listReviews(
    workspaceId: string,
    status?: HumanReview["status"],
  ): Promise<HumanReview[]> {
    const rows = status
      ? await this.database.query(
          `SELECT * FROM human_reviews WHERE workspace_id = $1 AND status = $2 ORDER BY created_at`,
          [workspaceId, status],
        )
      : await this.database.query(
          `SELECT * FROM human_reviews WHERE workspace_id = $1 ORDER BY created_at`,
          [workspaceId],
        );
    return rows.map((row) => this.toReview(row));
  }

  async resolveReview(
    workspaceId: string,
    reviewId: string,
    resolution: ReviewResolutionRequest,
  ): Promise<HumanReview> {
    return this.database.transaction(async (transaction) => {
      const reviewRows = await transaction.query(
        `SELECT * FROM human_reviews WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
        [workspaceId, reviewId],
      );
      const reviewRow = reviewRows[0];
      if (!reviewRow) throw new Error(`Review ${reviewId} was not found`);
      if (reviewRow.status !== "pending" && reviewRow.status !== "more_evidence_requested") {
        return this.toReview(reviewRow);
      }
      const status: HumanReview["status"] =
        resolution.decision === "approve"
          ? "approved"
          : resolution.decision === "edit"
            ? "edited"
            : resolution.decision === "reject"
              ? "rejected"
              : "more_evidence_requested";
      const now = new Date().toISOString();
      let sourceId: string | null = null;
      let memoryId: string | null = null;
      let decisionRunId: string | null = null;

      if ((status === "approved" || status === "edited") && resolution.content) {
        sourceId = randomUUID();
        memoryId = randomUUID();
        decisionRunId = randomUUID();
        const authorityRows = await transaction.query(
          `SELECT id FROM authority_profiles WHERE workspace_id = $1 AND code = 'founder_decision'`,
          [workspaceId],
        );
        const authorityId = authorityRows[0]?.id;
        if (!authorityId) throw new Error("Founder authority profile is missing");
        await transaction.query(
          `INSERT INTO sources(
             id, workspace_id, type, author, title, body, source_timestamp, received_at,
             authority_profile_id, source_hash, linked_entities, metadata
           ) VALUES ($1,$2,'human_decision',$3,'Approved human decision',$4,$5,$5,$6,$7,'[]'::jsonb,$8::jsonb)`,
          [
            sourceId,
            workspaceId,
            resolution.reviewer,
            resolution.content,
            now,
            authorityId,
            hashValue({ reviewId, content: resolution.content, rationale: resolution.rationale }),
            json({ review_id: reviewId, rationale: resolution.rationale }),
          ],
        );
        await transaction.query(
          `INSERT INTO runs(
             id, workspace_id, source_id, kind, status, execution_mode, current_step,
             safe_summary, started_at, completed_at
           ) VALUES ($1,$2,$3,'human_review','completed','live_antigravity','completed',$4,$5,$5)`,
          [decisionRunId, workspaceId, sourceId, "Human decision recorded.", now],
        );
        const memory: MemoryAtom = {
          schema_version: CONTRACT_VERSION,
          id: memoryId,
          workspace_id: workspaceId,
          memory_type: reviewRow.subject_type === "correction" ? "policy" : "agent_outcome",
          subject: "Approved human decision",
          predicate: reviewRow.subject_type === "correction" ? "safe_wording" : "review_outcome",
          object_value: resolution.content,
          claim: resolution.content,
          evidence_kind: "explicit",
          source_event_id: sourceId,
          source_timestamp: now,
          authority_role: "founder_decision",
          authority_score: authorityScoreFor("founder_decision"),
          confidence_score: 1,
          freshness_score: 1,
          status: "active",
          valid_from: now,
          valid_until: null,
          applies_to: ["product", "sales", "support", "customer_success"],
          entities: [],
          created_by_run_id: decisionRunId,
          created_at: now,
          embedding: null,
        };
        await this.insertMemoryAtom(transaction, workspaceId, memory);
        await transaction.query(
          `INSERT INTO run_events(
             id, schema_version, workspace_id, run_id, sequence, event_type, agent,
             execution_mode, safe_summary, payload, occurred_at
           ) VALUES ($1,'1',$2,$3,1,'human_review_resolved','human','live_antigravity',$4,$5::jsonb,$6)`,
          [randomUUID(), workspaceId, decisionRunId, "Human decision added to shared memory.", json({ review_id: reviewId, memory_atom_id: memoryId }), now],
        );
      }

      const resolvedAt = status === "more_evidence_requested" ? null : now;
      const original = this.toReview(reviewRow);
      const completed: HumanReview = {
        ...original,
        status,
        reviewer: resolution.reviewer,
        resolved_content: resolution.content,
        rationale: resolution.rationale,
        created_memory_id: memoryId,
        resolved_at: resolvedAt,
      };
      const updatedRows = await transaction.query(
        `UPDATE human_reviews SET
           status = $3, reviewer = $4, resolved_wording = $5, rationale = $6,
           resolution_source_id = $7, resolution_memory_id = $8, data = $9::jsonb,
           resolved_at = $10, updated_at = now()
         WHERE workspace_id = $1 AND id = $2 RETURNING *`,
        [
          workspaceId,
          reviewId,
          status,
          resolution.reviewer,
          resolution.content,
          resolution.rationale,
          sourceId,
          memoryId,
          json(completed),
          resolvedAt,
        ],
      );
      if (reviewRow.subject_type === "conflict" && (status === "approved" || status === "edited")) {
        await transaction.query(
          `UPDATE conflicts SET status = 'resolved', winner_memory_id = $3, resolution = $4,
             resolved_at = $5, updated_at = now()
           WHERE workspace_id = $1 AND id = $2`,
          [workspaceId, reviewRow.subject_id, memoryId, resolution.rationale, now],
        );
      }
      if (memoryId) {
        await transaction.query(
          `UPDATE context_packs SET status = 'invalidated', invalidated_at = $2,
             invalidation_reason = 'Human decision changed shared truth', updated_at = now()
           WHERE workspace_id = $1 AND status NOT IN ('invalidated','expired')`,
          [workspaceId, now],
        );
      }
      const truthRows = await transaction.query(
        `SELECT
           EXISTS(SELECT 1 FROM runs WHERE workspace_id = $1 AND status IN ('queued','running')) AS active,
           EXISTS(SELECT 1 FROM conflicts WHERE workspace_id = $1 AND status IN ('open','needs_review') AND severity IN ('high','critical')) AS conflicts,
           EXISTS(SELECT 1 FROM runs WHERE workspace_id = $1 AND status = 'failed') AS failed,
           EXISTS(SELECT 1 FROM human_reviews WHERE workspace_id = $1 AND status IN ('pending','more_evidence_requested')) AS reviews`,
        [workspaceId],
      );
      const truthInputs = truthRows[0];
      const truth = truthInputs?.active
        ? "updating"
        : truthInputs?.conflicts || truthInputs?.failed || truthInputs?.reviews
          ? "needs_attention"
          : "verified";
      await transaction.query(`UPDATE workspaces SET truth_status = $2, updated_at = now() WHERE id = $1`, [workspaceId, truth]);
      const updated = updatedRows[0];
      if (!updated) throw new Error("Review update failed");
      return this.toReview(updated);
    });
  }

  async createSource(workspaceId: string, source: SourceEvent): Promise<SourceEvent> {
    await this.ensureWorkspace(workspaceId);
    const authorityRows = await this.database.query(
      `SELECT id FROM authority_profiles WHERE workspace_id = $1 AND code = $2`,
      [workspaceId, source.authority_role],
    );
    const authorityId = authorityRows[0]?.id;
    if (!authorityId) throw new Error(`Authority profile ${source.authority_role} was not found`);
    const rows = await this.database.query(
      `INSERT INTO sources(
         id, workspace_id, type, author, title, body, source_timestamp, received_at,
         authority_profile_id, source_hash, linked_entities, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [
        source.id,
        workspaceId,
        source.source_type,
        source.author,
        source.title ?? source.source_type.replaceAll("_", " "),
        source.content,
        source.source_timestamp,
        source.received_at,
        authorityId,
        hashValue({ source_type: source.source_type, content: source.content, source_timestamp: source.source_timestamp }),
        json(source.linked_entities),
        json(source.metadata),
      ],
    );
    if (rows[0]) return { ...source, workspace_id: workspaceId };
    const existing = await this.getSource(workspaceId, source.id);
    if (!existing) throw new Error(`Source ${source.id} could not be created`);
    return existing;
  }

  async createRun(
    workspaceId: string,
    input: {
      id?: string;
      sourceId: string;
      kind?: string;
      status?: RunStatus;
      executionMode?: ExecutionMode;
      currentStep?: AgentRun["current_step"];
      safeSummary?: string;
    },
  ): Promise<AgentRun> {
    const rows = await this.database.query(
      `INSERT INTO runs(
         id, workspace_id, source_id, kind, status, execution_mode, current_step, safe_summary
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        input.id ?? randomUUID(),
        workspaceId,
        input.sourceId,
        input.kind ?? "ingestion",
        input.status ?? "queued",
        input.executionMode ?? "live_antigravity",
        input.currentStep ?? "source_received",
        input.safeSummary ?? "Run queued.",
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("Run could not be created");
    return toAgentRun(row);
  }

  async createProviderInteraction(input: {
    id?: string;
    workspaceId: string;
    runId: string;
    agent: Agent;
    provider: string;
    model: string;
    interactionId?: string | null;
    environmentId?: string | null;
    promptVersion: string;
    attempt?: number;
    executionMode: ExecutionMode;
    status?: "started" | "succeeded" | "failed" | "cancelled";
    requestSummary?: JsonValue;
    safeSummary?: string;
  }): Promise<string> {
    const id = input.id ?? randomUUID();
    await this.database.query(
      `INSERT INTO provider_interactions(
         id, workspace_id, run_id, agent, provider, model, provider_interaction_id,
         environment_id, prompt_version, attempt, execution_mode, status, request_summary, response_summary
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)`,
      [
        id,
        input.workspaceId,
        input.runId,
        input.agent,
        input.provider,
        input.model,
        input.interactionId ?? null,
        input.environmentId ?? null,
        input.promptVersion,
        input.attempt ?? 1,
        input.executionMode,
        input.status ?? "started",
        json(input.requestSummary ?? {}),
        json({ safe_summary: input.safeSummary ?? "Provider interaction started." }),
      ],
    );
    return id;
  }

  async completeProviderInteraction(
    interactionId: string,
    input: {
      status: "succeeded" | "failed" | "cancelled";
      providerInteractionId?: string | null;
      environmentId?: string | null;
      responseSummary?: JsonValue;
      rawReport?: JsonValue;
      latencyMs?: number | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<void> {
    await this.database.query(
      `UPDATE provider_interactions SET
         status = $2,
         provider_interaction_id = COALESCE($3, provider_interaction_id),
         environment_id = COALESCE($4, environment_id),
         response_summary = $5::jsonb,
         raw_report = $6::jsonb,
         latency_ms = $7,
         error_code = $8,
         error_message = $9,
         completed_at = now()
       WHERE id = $1`,
      [
        interactionId,
        input.status,
        input.providerInteractionId ?? null,
        input.environmentId ?? null,
        json(input.responseSummary ?? {}),
        input.rawReport === undefined ? null : json(input.rawReport),
        input.latencyMs ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
      ],
    );
  }

  async recordModelUsage(input: {
    workspaceId: string;
    runId?: string | null;
    providerInteractionId?: string | null;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    estimatedCostUsd?: number;
    qualityMetricsEligible?: boolean;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO model_usage(
         id, workspace_id, run_id, provider_interaction_id, model, input_tokens,
         output_tokens, cached_tokens, estimated_cost_usd, quality_metrics_eligible
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        randomUUID(),
        input.workspaceId,
        input.runId ?? null,
        input.providerInteractionId ?? null,
        input.model,
        input.inputTokens ?? 0,
        input.outputTokens ?? 0,
        input.cachedTokens ?? 0,
        input.estimatedCostUsd ?? 0,
        input.qualityMetricsEligible ?? true,
      ],
    );
  }

  async saveCachedOutput(
    workspaceId: string,
    fixtureHash: string,
    agent: Agent,
    promptVersion: string,
    output: JsonValue,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO output_cache(id, workspace_id, fixture_hash, agent, prompt_version, output)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (workspace_id, fixture_hash, agent, prompt_version)
       DO UPDATE SET output = EXCLUDED.output, created_at = now()`,
      [randomUUID(), workspaceId, fixtureHash, agent, promptVersion, json(output)],
    );
  }

  async getCachedOutput(
    workspaceId: string,
    fixtureHash: string,
    agent: Agent,
    promptVersion: string,
  ): Promise<JsonValue | null> {
    const rows = await this.database.query(
      `SELECT output FROM output_cache
       WHERE workspace_id = $1 AND fixture_hash = $2 AND agent = $3 AND prompt_version = $4`,
      [workspaceId, fixtureHash, agent, promptVersion],
    );
    return rows[0] ? (parseJson(rows[0].output) as JsonValue) : null;
  }

  private async seedCanonicalFixture(transaction: DatabaseExecutor, workspaceId: string): Promise<void> {
    const seedRunId = scopedFixtureId(workspaceId, SSO_FIXTURE_IDS.seedRun);
    const scopedSources = SSO_SEED_SOURCES.map((source) => scopeSource(source, workspaceId));
    const scopedMemories = SSO_SEED_MEMORY_ATOMS.map((memory) => scopeMemory(memory, workspaceId));

    for (const source of scopedSources) {
      const authorityRows = await transaction.query(
        `SELECT id FROM authority_profiles WHERE workspace_id = $1 AND code = $2`,
        [workspaceId, source.authority_role],
      );
      const authorityId = authorityRows[0]?.id;
      if (!authorityId) throw new Error(`Fixture authority ${source.authority_role} is missing`);
      await transaction.query(
        `INSERT INTO sources(
           id, workspace_id, type, author, title, body, source_timestamp, received_at,
           authority_profile_id, source_hash, linked_entities, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
        [
          source.id,
          workspaceId,
          source.source_type,
          source.author,
          source.title ?? source.source_type.replaceAll("_", " "),
          source.content,
          source.source_timestamp,
          source.received_at,
          authorityId,
          hashValue({ source_type: source.source_type, content: source.content, source_timestamp: source.source_timestamp }),
          json(source.linked_entities),
          json(source.metadata),
        ],
      );
    }
    const firstSource = scopedSources[0];
    if (!firstSource) throw new Error("Canonical fixture has no sources");
    await transaction.query(
      `INSERT INTO runs(
         id, workspace_id, source_id, kind, status, execution_mode, current_step,
         safe_summary, started_at, completed_at
       ) VALUES ($1,$2,$3,'fixture_seed','completed','cached_demo','completed',$4,$5,$5)`,
      [seedRunId, workspaceId, firstSource.id, "Four fixture sources seeded through a recorded run.", new Date().toISOString()],
    );
    for (const memory of scopedMemories) await this.insertMemoryAtom(transaction, workspaceId, memory);
    await transaction.query(
      `INSERT INTO run_events(
         id, schema_version, workspace_id, run_id, sequence, event_type, agent,
         execution_mode, safe_summary, payload
       ) VALUES ($1,'1',$2,$3,1,'run_completed','orchestrator','cached_demo',$4,$5::jsonb)`,
      [
        scopedFixtureId(workspaceId, "90000000-0000-4000-8000-000000000001"),
        workspaceId,
        seedRunId,
        "Canonical evidence fixture seeded.",
        json({ source_count: scopedSources.length, memory_count: scopedMemories.length }),
      ],
    );
    await transaction.query(
      `INSERT INTO fixture_versions(id, workspace_id, version, fixture_hash)
       VALUES ($1,$2,'sso_v1',$3)`,
      [scopedFixtureId(workspaceId, "90000000-0000-4000-8000-000000000002"), workspaceId, hashValue(SSO_SEED_SOURCES)],
    );
    await transaction.query(
      `UPDATE workspaces SET fixture_version = 'sso_v1', truth_status = 'verified', updated_at = now() WHERE id = $1`,
      [workspaceId],
    );
  }

  async resetWorkspace(
    workspaceId: string,
    options: { name?: string; seed?: boolean } = {},
  ): Promise<WorkspaceSnapshot> {
    await this.database.transaction(async (transaction) => {
      await transaction.query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
      await this.insertWorkspace(transaction, workspaceId, options.name);
      if (options.seed !== false) await this.seedCanonicalFixture(transaction, workspaceId);
    });
    return this.getSnapshot(workspaceId);
  }

  async getSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
    const [workspaceRows, sourceRows, runRows, eventRows, memoryRows, conflictRows, packRows, guardRows, reviewRows] =
      await Promise.all([
        this.database.query(`SELECT * FROM workspaces WHERE id = $1`, [workspaceId]),
        this.database.query(`SELECT * FROM sources WHERE workspace_id = $1 ORDER BY received_at DESC`, [workspaceId]),
        this.database.query(`SELECT * FROM runs WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
        this.database.query(`SELECT * FROM run_events WHERE workspace_id = $1 ORDER BY occurred_at ASC, sequence ASC`, [workspaceId]),
        this.database.query(`SELECT * FROM memory_atoms WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
        this.database.query(`SELECT * FROM conflicts WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
        this.database.query(`SELECT * FROM context_packs WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
        this.database.query(`SELECT * FROM guard_decisions WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
        this.database.query(`SELECT * FROM human_reviews WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
      ]);
    const workspaceRow = workspaceRows[0];
    if (!workspaceRow) throw new Error(`Workspace ${workspaceId} was not found`);
    const runs = fromRows<RunRow>(runRows);
    const events = eventRows.map((row) => {
      const event = fromRow<Record<string, unknown>>(row);
      return {
        ...event,
        type: String(event.eventType),
        createdAt: String(event.occurredAt),
      } as unknown as RunEventRow;
    });
    const memories = fromRows<MemoryAtomRow>(memoryRows);
    const conflicts = fromRows<ConflictRow>(conflictRows);
    const reviews = fromRows<HumanReviewRow>(reviewRows);
    return {
      workspace: fromRow<WorkspaceRow>(workspaceRow),
      sources: fromRows<SourceRow>(sourceRows),
      runs,
      events,
      memories,
      conflicts,
      contextPacks: packRows.map((row) => {
        const pack = fromRow<Record<string, unknown>>(row);
        const data = (pack.data ?? {}) as Record<string, unknown>;
        const recommended = data.recommended_action as { message?: unknown } | undefined;
        return {
          ...pack,
          agent: String(pack.requestingAgent ?? "context_composer"),
          purpose: String(pack.task ?? "verified_context"),
          summary: String(recommended?.message ?? pack.task ?? "Verified Context Pack"),
        } as unknown as ContextPackRow;
      }),
      guardDecisions: guardRows.map((row) => {
        const decision = fromRow<Record<string, unknown>>(row);
        const data = (decision.data ?? {}) as Record<string, unknown>;
        const proposedAction = decision.proposedAction as { content?: unknown } | undefined;
        const recommended = data.recommended_action as { message?: unknown } | undefined;
        return {
          ...decision,
          proposedAction: String(proposedAction?.content ?? ""),
          recommendedAction: recommended?.message ?? null,
          reviewId: data.review_id ?? null,
        } as unknown as GuardDecisionRow;
      }),
      reviews,
      counts: {
        openConflicts: conflicts.filter((conflict) => conflict.status === "open" || conflict.status === "needs_review").length,
        staleMemories: memories.filter((memory) => memory.status === "stale" || memory.freshness <= 0).length,
        pendingReviews: reviews.filter((review) => review.status === "pending").length,
        activeRuns: runs.filter((run) => run.status === "queued" || run.status === "running").length,
      },
    };
  }

  async getFullSnapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
    return this.getSnapshot(workspaceId);
  }

  async getCoreSnapshot(workspaceId: string): Promise<CoreWorkspaceSnapshot> {
    const [workspace, sources, memories, conflicts, packs, runs] = await Promise.all([
      this.getWorkspace(workspaceId),
      this.listSources(workspaceId, 500),
      this.listMemoryAtoms(workspaceId, { limit: 500 }),
      this.listConflicts(workspaceId),
      this.listContextPacks(workspaceId, 100),
      this.listRuns(workspaceId, 100),
    ]);
    if (!workspace) throw new Error(`Workspace ${workspaceId} was not found`);
    return {
      schema_version: CONTRACT_VERSION,
      workspace_id: workspaceId,
      truth_state: workspace.truthStatus,
      counts: {
        active_runs: runs.filter((run) => run.status === "queued" || run.status === "running").length,
        unresolved_high_conflicts: conflicts.filter(
          (conflict) =>
            (conflict.status === "open" || conflict.status === "needs_review") &&
            (conflict.severity === "high" || conflict.severity === "critical"),
        ).length,
        failed_runs: runs.filter((run) => run.status === "failed").length,
        stale_memories: memories.filter((memory) => memory.status === "stale" || memory.freshness_score <= 0).length,
      },
      sources,
      memories,
      conflicts,
      context_packs: packs,
      latest_run: runs[0] ?? null,
    };
  }
}

let storePromise: Promise<GroundMeshStore> | undefined;

export function getStore(): Promise<GroundMeshStore> {
  storePromise ??= getDatabase().then((database) => new GroundMeshStore(database));
  return storePromise;
}
