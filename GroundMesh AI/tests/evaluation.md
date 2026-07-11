# GroundMesh v1.0 Evaluation and Release Gates

This document is the release contract for the hackathon MVP. A build is releasable only when every required gate below has evidence from the same commit and deployment. Cached and live-provider results must be reported separately.

## 1. Automated repository gate

Run from the repository root with `GEMINI_API_KEY` unset or blank:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
docker build -f Dockerfile.web -t groundmesh-web:evaluation .
docker build -f Dockerfile.worker -t groundmesh-worker:evaluation .
```

Pass criteria:

- Every command exits zero with no skipped required suite and no lint warnings.
- Unit coverage includes Zod contracts, authority and freshness, resolution thresholds, all guard verdicts, truth state, cache identity and idempotency.
- No test or snapshot contains credentials, private reasoning, or an unlabelled cached result.
- Both images build without a key or other secret in the build context or build arguments.
- Both images start as their unprivileged user; web session health and worker `/healthz` return success.

The checked-in CI workflow runs these gates on every pull request. A green workflow is necessary, but not sufficient, for release.

## 2. Functional acceptance matrix

Use a new browser session or reset before each independent scenario.

| ID | Scenario | Required observation |
| --- | --- | --- |
| F-01 | Demo reset | The four roadmap, CRM, GitHub and support sources return within 10 seconds; prior session-only additions disappear. |
| F-02 | Founder ingestion | HTTP 202 returns in under 1 second with source and run IDs; the immutable source remains after any downstream failure. |
| F-03 | Maya extraction | One explicit `decision` and one explicit `policy` atom are validated, source-linked and visible. Maya does not choose a winner. |
| F-04 | Rook audit | Roadmap, CRM, support and GitHub evidence are considered; the next-month promise is a high-severity conflict affecting sales, support and customer success. |
| F-05 | Vera resolution | The no-date founder decision wins at or above 0.80, leads the competing claim by at least 0.15, cites the founder and open security review, and supersedes rather than deletes older timing claims. |
| F-06 | Context Pack | The support pack has a one-hour expiry and includes current facts, policy, resolved conflict, blocked claim, safe reply and source citations; it does not contain a proposed action. |
| F-07 | Unsafe action | `Enterprise SSO will be available next month.` produces `BLOCK`, the governing policy, citations and a date-free correction. No external-send integration is called. |
| F-08 | Human correction | A BLOCK cannot approve the original wording. Approving its correction creates an immutable `human_decision` source and outcome memory, invalidates affected packs, and updates the next pack. |
| F-09 | Replay | Reopening the run returns the same persisted events in strictly increasing sequence order with no duplicate IDs or private reasoning. |
| F-10 | Session isolation | Two browser sessions receive different workspaces; reset and writes in one do not alter the other. |

The canonical order is reset -> ingest -> resolve -> compose -> block -> approve -> compose again -> replay.

## 3. Action Guard decision table

Each row is a mandatory deterministic unit or integration case. BLOCK has precedence over every lower-priority condition, and any evaluation failure must fail closed.

| Expected verdict | Input condition |
| --- | --- |
| `BLOCK` | A canonical extracted subject/predicate/value matches a blocked claim. |
| `BLOCK` | A canonical extracted claim matches a structured blocking policy. |
| `REQUIRE_APPROVAL` | Claim extraction or validation fails. |
| `REQUIRE_APPROVAL` | Context Pack is expired or invalidated. |
| `REQUIRE_APPROVAL` | Context confidence is below 0.75. |
| `REQUIRE_APPROVAL` | An unresolved high or critical conflict remains. |
| `ALLOW_WITH_WARNING` | Context confidence is from 0.75 through 0.899. |
| `ALLOW_WITH_WARNING` | Only unresolved low or medium ambiguity remains. |
| `ALLOW` | Pack is fresh, confidence is at least 0.90, and no blocking rule or unresolved conflict applies. |

Also verify normalization is stable across case, punctuation and whitespace, but does not broaden an exact rule into semantic model discretion.

## 4. API, SSE and persistence gates

Required API cases:

- `POST /api/events/ingest` rejects a missing `Idempotency-Key`, deduplicates the same key, and never accepts a public numeric authority score.
- Every failure uses `{ error: { code, message, retryable, details? }, request_id }` and an appropriate non-2xx status.
- `GET /api/runs/{runId}/events` sends persisted events in order, heartbeats while idle, resumes after `Last-Event-ID`, and produces no missing or duplicate event after reconnection.
- Retry creates or resumes only a retryable failed run; cancel is idempotent and produces a persisted terminal event.
- Source, snapshot, review and run IDs from another session return not found or forbidden without revealing existence.
- Worker task routes reject a missing or incorrect `X-GroundMesh-Worker-Secret` whenever the secret is configured; `/healthz` reveals only readiness.

Required database cases:

- Migration applies to an empty Supabase project and re-running its idempotent checks causes no damage.
- RLS prevents cross-workspace reads and writes for every domain table.
- Source, event, interaction and status-history provenance is append-only.
- Ingestion atomically commits source, run, first event and outbox job; a forced rollback leaves none of them partially committed.
- Duplicate outbox/task delivery does not duplicate steps, events, memories, reviews or decisions.
- Activating new truth, supersession edges and Context Pack invalidation commit together.
- Human approval creates the decision source and memory before the review references them.
- Reset is scoped, idempotent and restores the exact fixture version.

## 5. Provider and failure gates

Recorded provider fixtures run on every release. A gated live run uses a fresh restricted server-side key and must never print that key, prompts containing secrets, or raw private reasoning.

| Failure injected | Required behavior |
| --- | --- |
| Antigravity timeout, 429 or 5xx | One bounded transient retry, then direct structured Gemini fallback. |
| Invalid normalized JSON | One repair attempt; persistent failure becomes retryable `needs_review`. |
| Hallucinated source ID | Validation fails; no memory write occurs. |
| Antigravity and Gemini unavailable for exact SSO hash | Use `cached_demo`, visibly label it, and exclude it from live-quality metrics. |
| Both providers unavailable for arbitrary input | Preserve the source and move the run to retryable `needs_review`; never substitute cached demo evidence. |
| Specialist exceeds 45 seconds | Cancel that interaction and continue through the bounded fallback path. |
| Run reaches 150 seconds | Stop preview work and reach a safe terminal or fallback state before 180 seconds. |
| Daily model budget reached | Open the circuit breaker; exact demo may use labelled cache and arbitrary work becomes `needs_review`. |

All managed-agent requests must use isolated environments without database credentials and with networking disabled or explicitly allowlisted.

## 6. Performance and reliability run

Run ten consecutive canonical cycles against the release deployment. Reset before every cycle and do not manually repair state. Record server timestamps rather than judging animation timing.

| Measurement | Target for every cycle |
| --- | --- |
| Reset completion | < 10 seconds |
| Source acceptance | < 1 second |
| First persisted/SSE UI event | < 2 seconds from acceptance |
| Full reset-to-approved-memory loop | < 180 seconds |
| Citation completeness | 100% of operational claims |
| Unsafe date prevention | BLOCK in 10/10 cycles |
| Approved correction reuse | Present in the subsequent pack in 10/10 cycles |

Store for each cycle: commit SHA, deployment revision, UTC start, execution mode, source ID, run ID, acceptance milliseconds, first-event milliseconds, completion milliseconds, verdict, created outcome memory ID and any retry count. All ten cycles must pass; report median and p95 without mixing `cached_demo` with either live mode.

## 7. Product-quality metrics

Use a reviewed labelled set, not only the canonical scenario. Preserve the input IDs and human labels with the result.

| Metric | Calculation | Release target |
| --- | --- | --- |
| Conflict precision | Genuine detected conflicts / all detected conflicts | >= 80% |
| Extraction validity | Semantically correct, schema-valid atoms / reviewed atoms | >= 90% |
| Citation completeness | Operational claims with at least one valid stored source / operational claims | 100% |
| Unsafe-action prevention | Seeded prohibited claims blocked / prohibited claims | 100% |
| False-block rate | Safe seeded actions incorrectly blocked / safe seeded actions | <= 20% |
| Human-resolution reuse | Approved rules present in the next relevant pack / approved rules | 100% |

Do not describe these fixture results as production accuracy.

## 8. Browser and accessibility gate

Test Chromium at desktop and narrow responsive widths, keyboard-only navigation, and `prefers-reduced-motion: reduce`.

- Source cards, conflict comparisons, citations, Action Gate and review drawer are reachable and operable by keyboard.
- Focus is visible, moves into the review drawer, and returns to the invoking control on close.
- Agent/run updates use a live region without repeatedly interrupting the user.
- Every color state also has a text label; graph relations have an equivalent semantic table.
- Critical text and controls meet WCAG 2.2 AA contrast, and automated axe scans have no serious or critical findings.
- Reduced motion preserves state meaning without sliding, drifting or pulsing dependencies.
- Browser console and network panel contain no uncaught errors, secret values, external-send request, or private reasoning.

## 9. Release evidence and sign-off

Attach the following to the release record:

- CI URL and commit SHA.
- Migration version and `supabase migration list` output.
- Cloud Run web and worker revision names plus image digests.
- Direct-worker configuration and explicit queue-adapter status; when Cloud Tasks is active, include queue configuration and terminal/retry counts.
- Ten-cycle results separated by execution mode.
- Product-quality metric worksheet and reviewer identity.
- Accessibility/browser report.
- Secret-scan result, key-rotation confirmation and Cloud Billing budget link.
- One successful reset, live flow, cached flow, block, review write-back and replay trace.

Release sign-off requires engineering approval for correctness and a product reviewer for the conflict labels, safe wording and false-block sample.
