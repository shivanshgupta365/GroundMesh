begin;

create extension if not exists vector with schema extensions;

create table if not exists public.groundmesh_schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  fixture_version text,
  truth_status text not null default 'verified' check (truth_status in ('updating','needs_attention','verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.browser_sessions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fixture_versions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version text not null,
  fixture_hash text not null,
  applied_at timestamptz not null default now(),
  unique (workspace_id, version)
);

create table if not exists public.authority_profiles (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  label text not null,
  authority numeric(5,4) not null check (authority between 0 and 1),
  created_at timestamptz not null default now(),
  unique (workspace_id, code),
  unique (workspace_id, id)
);

create table if not exists public.sources (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  external_id text,
  author text,
  title text not null,
  body text not null,
  source_timestamp timestamptz,
  received_at timestamptz not null default now(),
  authority_profile_id uuid not null,
  source_hash text not null,
  linked_entities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (workspace_id, id),
  unique (workspace_id, source_hash),
  foreign key (workspace_id, authority_profile_id)
    references public.authority_profiles(workspace_id, id)
);

create table if not exists public.runs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid,
  kind text not null default 'ingestion',
  status text not null default 'queued' check (status in ('queued','running','completed','needs_review','failed','cancelled')),
  execution_mode text not null default 'live_antigravity' check (execution_mode in ('live_antigravity','live_gemini_fallback','cached_demo')),
  current_step text,
  attempt integer not null default 0 check (attempt >= 0),
  cancellation_requested boolean not null default false,
  safe_summary text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, source_id) references public.sources(workspace_id, id)
);

create table if not exists public.provider_interactions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null,
  agent text not null,
  provider text not null,
  model text not null,
  provider_interaction_id text,
  environment_id text,
  prompt_version text,
  attempt integer not null default 1 check (attempt > 0),
  execution_mode text not null check (execution_mode in ('live_antigravity','live_gemini_fallback','cached_demo')),
  status text not null,
  request_summary jsonb not null default '{}'::jsonb,
  response_summary jsonb,
  raw_report jsonb,
  latency_ms integer,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete cascade
);

create table if not exists public.workflow_steps (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null,
  step text not null,
  agent text not null,
  status text not null check (status in ('queued','running','completed','failed','cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  provider_interaction_id uuid references public.provider_interactions(id) on delete set null,
  environment_id text,
  prompt_version text,
  raw_report jsonb,
  validated_output jsonb,
  safe_summary text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, step, attempt),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete cascade
);

create table if not exists public.run_events (
  id uuid primary key,
  schema_version text not null default '1',
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  agent text not null,
  execution_mode text not null check (execution_mode in ('live_antigravity','live_gemini_fallback','cached_demo')),
  safe_summary text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (run_id, sequence),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete cascade
);

create table if not exists public.outbox_jobs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null,
  job_type text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete cascade
);

create table if not exists public.model_usage (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid,
  provider_interaction_id uuid references public.provider_interactions(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  quality_metrics_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null
);

create table if not exists public.entities (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  canonical_name text not null,
  aliases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, type, canonical_name)
);

create table if not exists public.agents (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, code)
);

create table if not exists public.workflows (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, code)
);

create table if not exists public.memory_atoms (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null,
  run_id uuid,
  entity_id uuid,
  kind text not null,
  topic text not null,
  subject text not null,
  predicate text not null,
  object text not null,
  statement text not null,
  evidence_kind text not null default 'explicit' check (evidence_kind in ('explicit','inferred')),
  source_timestamp timestamptz not null,
  authority_role text not null,
  status text not null default 'candidate' check (status in ('candidate','active','disputed','stale','superseded','rejected')),
  authority numeric(5,4) not null check (authority between 0 and 1),
  freshness numeric(5,4) not null check (freshness between 0 and 1),
  directness numeric(5,4) not null check (directness between 0 and 1),
  corroboration numeric(5,4) not null check (corroboration between 0 and 1),
  resolution_score numeric(5,4) not null check (resolution_score between 0 and 1),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  valid_from timestamptz,
  valid_until timestamptz,
  embedding_model text,
  embedding_dimension integer,
  embedding extensions.vector(768),
  applies_to jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, source_id) references public.sources(workspace_id, id),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null,
  foreign key (workspace_id, entity_id) references public.entities(workspace_id, id) on delete set null,
  check ((embedding is null and embedding_dimension is null) or embedding_dimension = 768)
);

create table if not exists public.memory_edges (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_memory_id uuid not null,
  to_memory_id uuid not null,
  relation text not null check (relation in ('supports','contradicts','supersedes','clarifies','derived_from')),
  run_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, from_memory_id, to_memory_id, relation),
  foreign key (workspace_id, from_memory_id) references public.memory_atoms(workspace_id, id) on delete cascade,
  foreign key (workspace_id, to_memory_id) references public.memory_atoms(workspace_id, id) on delete cascade,
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null,
  check (from_memory_id <> to_memory_id)
);

create table if not exists public.memory_status_history (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid not null,
  from_status text,
  to_status text not null,
  run_id uuid,
  reason text not null,
  changed_by text not null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, memory_id) references public.memory_atoms(workspace_id, id) on delete cascade,
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null
);

create table if not exists public.memory_entities (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, memory_id, entity_id),
  foreign key (workspace_id, memory_id) references public.memory_atoms(workspace_id, id) on delete cascade,
  foreign key (workspace_id, entity_id) references public.entities(workspace_id, id) on delete cascade
);

create table if not exists public.memory_agents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid not null,
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, memory_id, agent_id),
  foreign key (workspace_id, memory_id) references public.memory_atoms(workspace_id, id) on delete cascade,
  foreign key (workspace_id, agent_id) references public.agents(workspace_id, id) on delete cascade
);

create table if not exists public.memory_workflows (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid not null,
  workflow_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, memory_id, workflow_id),
  foreign key (workspace_id, memory_id) references public.memory_atoms(workspace_id, id) on delete cascade,
  foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete cascade
);

create table if not exists public.conflicts (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid,
  topic text not null,
  left_memory_id uuid not null,
  right_memory_id uuid not null,
  winner_memory_id uuid,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','resolved','needs_review','dismissed')),
  reason text not null,
  resolution text,
  score_gap numeric(5,4),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null,
  foreign key (workspace_id, left_memory_id) references public.memory_atoms(workspace_id, id),
  foreign key (workspace_id, right_memory_id) references public.memory_atoms(workspace_id, id),
  foreign key (workspace_id, winner_memory_id) references public.memory_atoms(workspace_id, id) on delete set null
);

create table if not exists public.context_packs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid,
  requesting_agent text not null,
  task text not null,
  scope jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  status text not null default 'verified' check (status in ('verified','verified_with_warning','needs_review','expired','invalidated')),
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  invalidation_reason text,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null
);

create table if not exists public.context_pack_memories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  context_pack_id uuid not null,
  memory_id uuid not null,
  rank integer not null default 0,
  relevance numeric(5,4) not null default 1,
  created_at timestamptz not null default now(),
  primary key (workspace_id, context_pack_id, memory_id),
  foreign key (workspace_id, context_pack_id) references public.context_packs(workspace_id, id) on delete cascade,
  foreign key (workspace_id, memory_id) references public.memory_atoms(workspace_id, id) on delete cascade
);

create table if not exists public.context_pack_agents (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  context_pack_id uuid not null,
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, context_pack_id, agent_id),
  foreign key (workspace_id, context_pack_id) references public.context_packs(workspace_id, id) on delete cascade,
  foreign key (workspace_id, agent_id) references public.agents(workspace_id, id) on delete cascade
);

create table if not exists public.guard_decisions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  context_pack_id uuid not null,
  run_id uuid,
  verdict text not null check (verdict in ('ALLOW','ALLOW_WITH_WARNING','REQUIRE_APPROVAL','BLOCK')),
  proposed_action jsonb not null,
  canonical_claim text,
  prohibited_claim text,
  governing_memory_id uuid,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  explanation text not null,
  citations jsonb not null default '[]'::jsonb,
  execution_mode text not null check (execution_mode in ('live_antigravity','live_gemini_fallback','cached_demo')),
  simulated boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, context_pack_id) references public.context_packs(workspace_id, id),
  foreign key (workspace_id, run_id) references public.runs(workspace_id, id) on delete set null,
  foreign key (workspace_id, governing_memory_id) references public.memory_atoms(workspace_id, id) on delete set null
);

create table if not exists public.guard_decision_memories (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  guard_decision_id uuid not null,
  memory_id uuid not null,
  role text not null default 'evidence',
  created_at timestamptz not null default now(),
  primary key (workspace_id, guard_decision_id, memory_id),
  foreign key (workspace_id, guard_decision_id) references public.guard_decisions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, memory_id) references public.memory_atoms(workspace_id, id) on delete cascade
);

create table if not exists public.human_reviews (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null check (subject_type in ('conflict','guard_decision','correction')),
  subject_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','edited','rejected','more_evidence_requested')),
  requested_by text not null,
  reviewer text,
  proposed_wording text,
  resolved_wording text,
  rationale text,
  resolution_source_id uuid,
  resolution_memory_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, resolution_source_id) references public.sources(workspace_id, id) on delete set null,
  foreign key (workspace_id, resolution_memory_id) references public.memory_atoms(workspace_id, id) on delete set null
);

create table if not exists public.idempotency_keys (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  resource_type text,
  resource_id uuid,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (workspace_id, operation, idempotency_key)
);

create table if not exists public.output_cache (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fixture_hash text not null,
  agent text not null,
  prompt_version text not null,
  output jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, fixture_hash, agent, prompt_version)
);

create index if not exists sources_workspace_received_idx on public.sources(workspace_id, received_at desc);
create index if not exists runs_workspace_created_idx on public.runs(workspace_id, created_at desc);
create index if not exists runs_active_idx on public.runs(workspace_id, status) where status in ('queued','running');
create index if not exists run_events_replay_idx on public.run_events(workspace_id, run_id, sequence);
create index if not exists outbox_dispatch_idx on public.outbox_jobs(status, available_at);
create index if not exists memory_atoms_topic_idx on public.memory_atoms(workspace_id, topic, status);
create index if not exists memory_atoms_entity_idx on public.memory_atoms(workspace_id, entity_id, status);
create index if not exists memory_atoms_validity_idx on public.memory_atoms(workspace_id, valid_until) where status = 'active';
create index if not exists memory_atoms_embedding_hnsw_idx
  on public.memory_atoms using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;
create index if not exists conflicts_open_idx on public.conflicts(workspace_id, status, severity);
create index if not exists context_packs_active_idx on public.context_packs(workspace_id, status, expires_at);
create index if not exists human_reviews_queue_idx on public.human_reviews(workspace_id, status, created_at);
create index if not exists idempotency_expiry_idx on public.idempotency_keys(expires_at);

create or replace function public.groundmesh_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.groundmesh_reject_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

drop trigger if exists sources_immutable on public.sources;
create trigger sources_immutable before update on public.sources
for each row execute function public.groundmesh_reject_update();

drop trigger if exists run_events_immutable on public.run_events;
create trigger run_events_immutable before update on public.run_events
for each row execute function public.groundmesh_reject_update();

drop trigger if exists memory_status_history_immutable on public.memory_status_history;
create trigger memory_status_history_immutable before update on public.memory_status_history
for each row execute function public.groundmesh_reject_update();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workspaces','browser_sessions','fixture_versions','authority_profiles','sources','runs',
    'provider_interactions','workflow_steps','run_events','outbox_jobs','model_usage','entities',
    'agents','workflows','memory_atoms','memory_edges','memory_status_history','memory_entities',
    'memory_agents','memory_workflows','conflicts','context_packs','context_pack_memories',
    'context_pack_agents','guard_decisions','guard_decision_memories','human_reviews',
    'idempotency_keys','output_cache'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists workspace_isolation on public.%I', table_name);
    if table_name = 'workspaces' then
      execute format(
        'create policy workspace_isolation on public.%I using (id::text = nullif(current_setting(''app.workspace_id'', true), '''')) with check (id::text = nullif(current_setting(''app.workspace_id'', true), ''''))',
        table_name
      );
    else
      execute format(
        'create policy workspace_isolation on public.%I using (workspace_id::text = nullif(current_setting(''app.workspace_id'', true), '''')) with check (workspace_id::text = nullif(current_setting(''app.workspace_id'', true), ''''))',
        table_name
      );
    end if;
  end loop;
end;
$$;

insert into public.groundmesh_schema_migrations(version)
values ('202607110001')
on conflict (version) do nothing;

commit;
