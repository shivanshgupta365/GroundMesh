# GroundMesh Production Deployment

This runbook deploys the currently implemented topology: one public Cloud Run web service, one shared-secret-protected Cloud Run worker and a Supabase PostgreSQL/pgvector database. It also shows how to prepare the intended Cloud Tasks topology, but the repository does not yet contain a Cloud Tasks enqueue adapter. Run it from the repository root. Replace every `your-*` placeholder; never paste a credential into a committed file or Docker build argument.

Official references: [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Cloud Run container deployment](https://cloud.google.com/run/docs/deploying), [Cloud Run ingress](https://cloud.google.com/run/docs/securing/ingress), [authenticated HTTP tasks](https://cloud.google.com/tasks/docs/creating-http-target-tasks), [Secret Manager](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets), and [Cloud Billing budgets](https://cloud.google.com/billing/docs/how-to/budgets).

Runtime status:

- With `WORKER_URL` blank, the web process starts the durable workflow through its local asynchronous adapter.
- With `WORKER_URL` set, the web process POSTs directly to `$WORKER_URL/tasks/process-run` with `WORKER_SHARED_SECRET`.
- `outbox_jobs` is persisted, and the worker exposes `/tasks/drain`, but no code currently creates a Google Cloud Task.
- Do not claim OIDC/Cloud Tasks delivery until a queue client replaces the direct HTTP adapter and has its own integration test.

## 1. Prerequisites and deployment variables

Required local tools: Docker, Google Cloud CLI, Supabase CLI, Node.js 22.11+, pnpm 11.7.0, `curl` and `jq`.

```bash
gcloud auth login
gcloud auth application-default login

export PROJECT_ID=your-google-cloud-project
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export REGION=asia-south1
export REPOSITORY=groundmesh
export IMAGE_TAG="$(git rev-parse --short HEAD)"
export WEB_SERVICE=groundmesh-web
export WORKER_SERVICE=groundmesh-worker
export QUEUE=groundmesh-runs
export WEB_SA="groundmesh-web@$PROJECT_ID.iam.gserviceaccount.com"
export WORKER_SA="groundmesh-worker@$PROJECT_ID.iam.gserviceaccount.com"
export WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/web:$IMAGE_TAG"
export WORKER_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/worker:$IMAGE_TAG"

gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"
```

Do not reuse the Gemini key disclosed during development. Revoke it first and issue a new restricted server-side credential for this deployment.

## 2. Apply the Supabase migration

Create a new Supabase project in the region closest to `asia-south1`. Keep only demo data in the hackathon environment.

```bash
export SUPABASE_PROJECT_REF=your-project-ref
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
```

The initial production migration is `supabase/migrations/202607110001_groundmesh.sql`; checked-in files under `supabase/migrations/` are the only production schema source. Do not make ad hoc table or SQL-editor changes after linking; create another migration instead. A new project must receive pgvector, workspace-scoped domain tables, append-oriented provenance, transactional outbox support, fixture/reset state and RLS policies from these migrations.

In the Supabase dashboard, copy the PostgreSQL transaction-pooler URL for the server-only runtime `DATABASE_URL`. The current runtime uses its privileged PostgreSQL connection for isolated workspace provisioning and reset, and explicitly scopes every domain query by `workspace_id`; that connection can bypass RLS and therefore must never reach the browser or a managed-agent environment. RLS denies direct restricted/browser roles by default. Do not also inject the Supabase service-role key: the runtime uses PostgreSQL directly.

Before proceeding, verify:

- `supabase migration list` shows every local migration applied remotely.
- The `vector` extension exists and Memory Atom embeddings accept 768 dimensions.
- A restricted/direct client cannot read or mutate workspace data; server-runtime query tests prove explicit cross-workspace scoping.
- Reset works only for its current session workspace and cannot affect another session.

## 3. Create Google Cloud resources and identities

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudtasks.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com

gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="GroundMesh production containers"

gcloud iam service-accounts create groundmesh-web \
  --display-name="GroundMesh web"
gcloud iam service-accounts create groundmesh-worker \
  --display-name="GroundMesh worker"
```

## 4. Store and authorize secrets

Create these secrets once:

```bash
for SECRET in \
  groundmesh-database-url \
  groundmesh-gemini-api-key \
  groundmesh-session-secret \
  groundmesh-access-code \
  groundmesh-worker-secret
do
  gcloud secrets create "$SECRET" --replication-policy=automatic
done
```

Add `groundmesh-database-url`, `groundmesh-gemini-api-key` and `groundmesh-access-code` through the Secret Manager console so they never enter shell history. Generate the two random signing/shared secrets without printing them:

```bash
openssl rand -base64 48 | gcloud secrets versions add groundmesh-session-secret --data-file=-
openssl rand -base64 48 | gcloud secrets versions add groundmesh-worker-secret --data-file=-
```

Grant access per service and per secret:

```bash
for SECRET in groundmesh-database-url groundmesh-session-secret groundmesh-access-code groundmesh-worker-secret
do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$WEB_SA" \
    --role=roles/secretmanager.secretAccessor
done

for SECRET in groundmesh-database-url groundmesh-gemini-api-key groundmesh-worker-secret
do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$WORKER_SA" \
    --role=roles/secretmanager.secretAccessor
done
```

Rotate by adding a new secret version and deploying a new Cloud Run revision. Disable the old version only after smoke tests pass; destroy it after the rollback window.

## 5. Build and push immutable images

No secret is needed or permitted during either build.

```bash
gcloud auth configure-docker "$REGION-docker.pkg.dev"

docker build --file Dockerfile.web --tag "$WEB_IMAGE" .
docker build --file Dockerfile.worker --tag "$WORKER_IMAGE" .

docker push "$WEB_IMAGE"
docker push "$WORKER_IMAGE"
```

Record the pushed image digests. Never deploy a mutable `latest` tag.

## 6. Deploy the current direct worker

The worker deadline is below the product's 180-second demo ceiling. One warm instance is recommended for a judged live demo; use zero minimum instances outside demo windows to control cost.

```bash
gcloud run deploy "$WORKER_SERVICE" \
  --image="$WORKER_IMAGE" \
  --service-account="$WORKER_SA" \
  --region="$REGION" \
  --port=8080 \
  --timeout=180s \
  --concurrency=4 \
  --min-instances=1 \
  --max-instances=5 \
  --ingress=all \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_NORMALIZER_MODEL=gemini-3.5-flash,GEMINI_EMBEDDING_MODEL=gemini-embedding-2,DAILY_MODEL_BUDGET_USD=20,DATABASE_POOL_SIZE=10" \
  --set-secrets="DATABASE_URL=groundmesh-database-url:latest,GEMINI_API_KEY=groundmesh-gemini-api-key:latest,WORKER_SHARED_SECRET=groundmesh-worker-secret:latest"

export WORKER_URL="$(gcloud run services describe "$WORKER_SERVICE" \
  --region="$REGION" --format='value(status.url)')"
```

The current web adapter does not mint a Google identity token, so this revision must be reachable at its default URL and relies on the independently generated `WORKER_SHARED_SECRET` for task routes. `/healthz` is intentionally unauthenticated. This is suitable only for the controlled demo; it is not the final private/OIDC topology. Do not publish the worker URL or secret, rate-limit it at the platform edge where available, and complete the Cloud Tasks adapter before broader production use.

## 7. Prepare the Cloud Tasks target topology - not active

The commands below prepare the target queue and IAM, but current web code will not enqueue into it. Do not use queue depth as a health signal until the adapter is implemented and tested. Cloud Tasks is at-least-once delivery, so the future adapter must continue using task/run IDs for idempotency.

```bash
export TASKS_SA="groundmesh-tasks@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create groundmesh-tasks \
  --display-name="GroundMesh Cloud Tasks caller"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WEB_SA" \
  --role=roles/cloudtasks.enqueuer

gcloud iam service-accounts add-iam-policy-binding "$TASKS_SA" \
  --member="serviceAccount:$WEB_SA" \
  --role=roles/iam.serviceAccountUser

gcloud tasks queues create "$QUEUE" \
  --location="$REGION" \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=4 \
  --max-attempts=3 \
  --min-backoff=5s \
  --max-backoff=60s \
  --max-doublings=3

gcloud tasks queues describe "$QUEUE" --location="$REGION"
```

Before activating this queue, implement the enqueue adapter and its failure/outbox acknowledgement path. Each task must POST JSON `{ "workspace_id": "...", "run_id": "..." }` to `$WORKER_URL/tasks/process-run`, use an OIDC audience equal to the worker's default `run.app` URL, and use `CLOUD_TASKS_SERVICE_ACCOUNT=$TASKS_SA`. Send the application secret separately as `X-GroundMesh-Worker-Secret` because Cloud Tasks owns `Authorization` for the OIDC token. Then redeploy the worker with `--ingress=internal --no-allow-unauthenticated`, grant `roles/run.invoker` to `TASKS_SA`, and verify the queue end to end. Treat Cloud Tasks headers as delivery metadata, not identity.

## 8. Deploy the web service

The Cloud Run endpoint is publicly reachable, but the application access-code gate creates an isolated signed HttpOnly session before exposing demo state.

```bash
gcloud run deploy "$WEB_SERVICE" \
  --image="$WEB_IMAGE" \
  --service-account="$WEB_SA" \
  --region="$REGION" \
  --port=8080 \
  --timeout=60s \
  --concurrency=40 \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars="WORKER_URL=$WORKER_URL,DATABASE_POOL_SIZE=10" \
  --set-secrets="DATABASE_URL=groundmesh-database-url:latest,SESSION_SECRET=groundmesh-session-secret:latest,GROUND_MESH_ACCESS_CODE=groundmesh-access-code:latest,WORKER_SHARED_SECRET=groundmesh-worker-secret:latest"

export WEB_URL="$(gcloud run services describe "$WEB_SERVICE" \
  --region="$REGION" --format='value(status.url)')"
```

Do not place `GEMINI_API_KEY` on the web service. It belongs only on the worker. No secret may use a `NEXT_PUBLIC_` environment name. Leave the `CLOUD_TASKS_*` variables unset until the queue adapter exists; they do not activate queue dispatch by themselves.

## 9. Budget and quota controls

`DAILY_MODEL_BUDGET_USD` is currently a reserved operational target: the runtime records model usage but does not yet enforce this value as a circuit breaker. Do not treat it as a cap. Implement and test the circuit breaker before broader production use, and configure a separate billing alert now. Cloud Billing budgets send notifications rather than automatically stopping spend:

```bash
export BILLING_ACCOUNT_ID=your-billing-account-id

gcloud services enable billingbudgets.googleapis.com cloudbilling.googleapis.com
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="GroundMesh monthly budget" \
  --budget-amount=50USD \
  --filter-projects="projects/$PROJECT_NUMBER" \
  --threshold-rule=percent=0.50 \
  --threshold-rule=percent=0.80 \
  --threshold-rule=percent=1.00
```

Also set project/model quota alerts, keep Cloud Run maximum instances bounded, and inspect usage by execution mode. Cached runs must be excluded from live model-quality and cost metrics.

## 10. Post-deploy verification

First confirm both revisions are ready:

```bash
gcloud run services describe "$WEB_SERVICE" --region="$REGION" \
  --format='yaml(status.latestReadyRevisionName,status.url,status.conditions)'
gcloud run services describe "$WORKER_SERVICE" --region="$REGION" \
  --format='yaml(status.latestReadyRevisionName,status.url,status.conditions)'
curl --fail --silent --show-error "$WEB_URL/api/session/access"
curl --fail --silent --show-error "$WORKER_URL/healthz"
```

Then complete the release matrix in `tests/evaluation.md`:

1. Authenticate through the access-code gate and reset the demo.
2. Run the exact founder fixture through live Antigravity or direct Gemini fallback and confirm its visible execution label.
3. Run with the provider circuit open and confirm only the exact fixture uses visibly labelled `cached_demo`.
4. Submit arbitrary text while providers are unavailable and confirm retained `needs_review`, not cached substitution.
5. Compose the support pack, block the next-month promise, approve the correction and confirm the next pack includes the outcome.
6. Reconnect SSE with `Last-Event-ID`, replay the run, inspect citations and confirm no duplicates or private reasoning.
7. Run ten complete cycles within the timing and reliability gates.
8. Inspect Cloud Run logs for 5xx errors and browser console/network for uncaught errors or external-send calls.

## 11. Monitoring and incident controls

Create log-based metrics or dashboards for:

- ingestion acceptance and first-event latency;
- total run and specialist latency by execution mode;
- provider retry, timeout, repair and validation-failure counts;
- outbox age, plus Cloud Tasks attempt and terminal-failure counts only after the adapter is active;
- run status, unresolved high conflicts and pending human reviews;
- guard verdict counts and any guard evaluation failure;
- model usage/cost against the daily target, and circuit-breaker state after enforcement is implemented;
- reset duration, SSE reconnects and event sequence gaps.

Alert on any guard failure, outbox backlog older than two minutes, repeated provider failures, database connection exhaustion, web/worker 5xx rate, or the 50/80/100 percent billing thresholds. Add queue-backlog alerts when Cloud Tasks becomes active.

## 12. Rollback

Application rollback is revision-based and must not reverse an already-applied forward-only migration:

```bash
gcloud run revisions list --service="$WEB_SERVICE" --region="$REGION"
gcloud run revisions list --service="$WORKER_SERVICE" --region="$REGION"

gcloud run services update-traffic "$WEB_SERVICE" \
  --region="$REGION" --to-revisions=your-previous-web-revision=100
gcloud run services update-traffic "$WORKER_SERVICE" \
  --region="$REGION" --to-revisions=your-previous-worker-revision=100
```

If the Cloud Tasks adapter is active, pause queue dispatch before investigating a worker incident. With the current direct adapter, remove `WORKER_URL` in a new web revision instead.

```bash
gcloud tasks queues pause "$QUEUE" --location="$REGION"
```

Resume only after the prior worker revision is ready and an idempotent retry test passes:

```bash
gcloud tasks queues resume "$QUEUE" --location="$REGION"
```

For schema problems, ship a corrective forward migration. Do not manually edit Supabase migration history or destructively roll back production data.

## Security checklist

- Fresh restricted Gemini key; disclosed key revoked.
- Secret Manager only; no secrets in images, source, logs, prompts or browser bundles.
- Distinct least-privilege web and worker service accounts; create the task-caller identity only with the adapter.
- Current direct worker protected by a rotated application secret; Cloud Tasks/OIDC migration explicitly tracked as a production prerequisite.
- Access-code session secret at least 32 random characters; secure HttpOnly cookie in production.
- TLS server-only database URL, explicit workspace filters, and RLS verified with cross-workspace negative tests.
- Managed-agent environments contain no database credentials and use disabled/allowlisted networking.
- Raw provider reports remain server-side; run events contain only safe summaries and validated output.
- External actions remain simulated and all evaluation failures fail closed.
- Demo-data retention, deletion and key-rotation owners recorded before opening access.
