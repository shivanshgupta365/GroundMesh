"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Ban,
  Bot,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  FileCode2,
  FileText,
  GitBranch,
  History,
  Inbox,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Network,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRoundCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  cancelRun,
  checkAction,
  createContextPack,
  getAccessStatus,
  getWorkspaceSnapshot,
  ingestEvent,
  requestAccess,
  resetDemo,
  resolveReview,
  retryRun,
  subscribeToRun,
  type AccessStatus,
  type ConflictRow,
  type ContextPackRow,
  type ExecutionMode,
  type GuardDecisionRow,
  type HumanReviewRow,
  type MemoryAtomRow,
  type RunEventRow,
  type RunRow,
  type SourceRow,
  type WorkspaceSnapshot,
} from "@/lib/client-api";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Textarea,
} from "@/components/ui/primitives";

const MOTION = {
  enter: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  quick: { duration: 0.2, ease: "easeOut" as const },
  handoff: { duration: 1.6, ease: "easeInOut" as const },
};

const SAFE_REPLY =
  "Enterprise SSO is delayed while security review remains open. We do not have a committed release date yet, and we will share an update as soon as the review is complete.";

const CANONICAL_EVENT = {
  author: "Founder",
  title: "Enterprise SSO decision",
  content: "Enterprise SSO is delayed. Do not commit a date externally.",
};

const AGENT_CONFIG = [
  {
    id: "maya" as const,
    name: "Maya",
    role: "Memory curator",
    short: "M",
    color: "cyan",
    waiting: "Waiting for new evidence",
    working: "Separating source text into atomic memories",
    complete: "Source mapped into typed memory",
  },
  {
    id: "rook" as const,
    name: "Rook",
    role: "Context auditor",
    short: "R",
    color: "red",
    waiting: "Standing by to challenge context",
    working: "Auditing contradictions and blast radius",
    complete: "Conflicts and stale context identified",
  },
  {
    id: "vera" as const,
    name: "Vera",
    role: "Evidence resolver",
    short: "V",
    color: "violet",
    waiting: "Waiting for the evidence package",
    working: "Ranking authority, recency and corroboration",
    complete: "Verified context package prepared",
  },
] as const;

type AgentId = (typeof AGENT_CONFIG)[number]["id"];
type AgentState = "waiting" | "working" | "complete" | "attention";
type EvidenceView = "canvas" | "table";

function textFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null, includeYear = false): string {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(run: RunRow): string {
  const start = run.startedAt ? new Date(run.startedAt).valueOf() : NaN;
  const end = run.completedAt ? new Date(run.completedAt).valueOf() : Date.now();
  if (!Number.isFinite(start)) return "Not started";
  const seconds = Math.max(0, Math.round((end - start) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function sourceAuthor(source: SourceRow): string {
  return (
    textFromUnknown(source.metadata.author) ??
    textFromUnknown(source.metadata.owner) ??
    ({
      founder_message: "Founder",
      product_roadmap: "Priya · Product",
      sales_crm_note: "Dev · Sales",
      github_issue: "Security Engineering",
      support_macro: "Support Operations",
      human_decision: "Human reviewer",
    }[source.type] ?? "Company source")
  );
}

function SourceIcon({ type, className }: { type: string; className?: string }) {
  const iconClass = className ?? "size-3.5";
  if (type.includes("github")) return <FileCode2 className={iconClass} aria-hidden="true" />;
  if (type.includes("crm")) return <Users className={iconClass} aria-hidden="true" />;
  if (type.includes("message")) return <MessageSquareText className={iconClass} aria-hidden="true" />;
  if (type.includes("policy") || type.includes("decision")) {
    return <ShieldCheck className={iconClass} aria-hidden="true" />;
  }
  return <FileText className={iconClass} aria-hidden="true" />;
}

function authorityLabel(source: SourceRow): string {
  const configured = textFromUnknown(source.metadata.authorityRole);
  if (configured) return titleCase(configured);
  if (source.type === "founder_message" || source.type === "human_decision") {
    return "Highest authority";
  }
  if (source.type === "github_issue") return "Implementation evidence";
  if (source.type === "product_roadmap") return "Product authority";
  return "Operational context";
}

function executionLabel(mode: ExecutionMode): string {
  return {
    live_antigravity: "Live · Antigravity",
    live_gemini_fallback: "Live · Gemini fallback",
    cached_demo: "Cached demo",
  }[mode];
}

function eventSummary(event: RunEventRow): string {
  return (
    textFromUnknown(event.payload.safeSummary) ??
    textFromUnknown(event.payload.safe_summary) ??
    textFromUnknown(event.payload.summary) ??
    ({
      source_received: "Source preserved and orchestration queued.",
      agent_started: `${titleCase(event.agent)} started its specialist pass.`,
      agent_completed: `${titleCase(event.agent)} completed its specialist pass.`,
      memory_extracted: "Candidate memories were validated and added to the evidence table.",
      conflict_detected: "A material contradiction was found in the active context.",
      evidence_verified: "Evidence was ranked and an authoritative claim was selected.",
      memory_superseded: "Outdated claims were retained and marked superseded.",
      context_pack_ready: "A minimal verified Context Pack is ready for action.",
      action_blocked: "The proposed action violated an active communication policy.",
      human_review_required: "A human decision is required before the action can proceed.",
      human_approved: "The approved correction was written back into durable memory.",
      run_completed: "The context update completed successfully.",
      run_failed: "The workflow stopped safely and can be retried.",
      run_cancelled: "The workflow was cancelled without losing the source.",
    }[event.type] ?? titleCase(event.type))
  );
}

function latestMode(snapshot: WorkspaceSnapshot): ExecutionMode {
  return snapshot.runs[0]?.executionMode ?? "cached_demo";
}

function findMemory(snapshot: WorkspaceSnapshot, pattern: RegExp): MemoryAtomRow | null {
  return (
    snapshot.memories.find((memory) =>
      pattern.test(`${memory.statement} ${memory.object} ${memory.predicate}`),
    ) ?? null
  );
}

function runIsActive(run: RunRow | undefined): boolean {
  return run?.status === "queued" || run?.status === "running";
}

function agentState(snapshot: WorkspaceSnapshot, agent: AgentId): AgentState {
  const run = snapshot.runs.find(runIsActive);
  if (run) {
    const current = run.currentStep?.toLowerCase() ?? "";
    if (current.includes(agent)) return "working";
    const order: AgentId[] = ["maya", "rook", "vera"];
    const currentIndex = order.findIndex((entry) => current.includes(entry));
    const agentIndex = order.indexOf(agent);
    if (currentIndex > agentIndex) return "complete";
    return "waiting";
  }

  const latest = [...snapshot.events].reverse().find((event) => event.agent === agent);
  if (!latest) return "waiting";
  if (latest.type.includes("failed")) return "attention";
  return latest.type === "agent_started" ? "working" : "complete";
}

function agentSummary(snapshot: WorkspaceSnapshot, agent: AgentId, state: AgentState): string {
  const latest = [...snapshot.events].reverse().find((event) => event.agent === agent);
  if (latest) return eventSummary(latest);
  const config = AGENT_CONFIG.find((entry) => entry.id === agent);
  if (!config) return "Waiting for orchestration";
  if (state === "working") return config.working;
  if (state === "complete") return config.complete;
  return config.waiting;
}

function latestRun(snapshot: WorkspaceSnapshot): RunRow | null {
  return (
    [...snapshot.runs].sort(
      (left, right) => new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf(),
    )[0] ?? null
  );
}

function latestPack(snapshot: WorkspaceSnapshot): ContextPackRow | null {
  return (
    [...snapshot.contextPacks].sort(
      (left, right) => new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf(),
    )[0] ?? null
  );
}

function latestDecision(snapshot: WorkspaceSnapshot): GuardDecisionRow | null {
  return (
    [...snapshot.guardDecisions].sort(
      (left, right) => new Date(right.createdAt).valueOf() - new Date(left.createdAt).valueOf(),
    )[0] ?? null
  );
}

function GroundMeshMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="GroundMesh">
      <span className="groundmesh-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-semibold tracking-[-0.03em] text-[var(--text)]">
            GroundMesh
          </span>
          <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
            Verified context layer
          </span>
        </span>
      )}
    </div>
  );
}

function AccessGate({
  status,
  checking,
  onUnlocked,
}: {
  status: AccessStatus | null;
  checking: boolean;
  onUnlocked: (status: AccessStatus) => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const next = await requestAccess(code);
      if (!next.authenticated) throw new Error("That access code was not accepted.");
      onUnlocked(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify access.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="access-shell" aria-busy="true">
        <div className="access-ambient access-ambient-one" />
        <div className="access-ambient access-ambient-two" />
        <div className="access-card">
          <GroundMeshMark />
          <div className="mt-14 flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <Loader2 className="size-4 animate-spin text-[var(--lime)]" aria-hidden="true" />
            Establishing an isolated demo workspace…
          </div>
        </div>
      </main>
    );
  }

  if (status?.authenticated) return null;

  return (
    <main className="access-shell">
      <div className="access-ambient access-ambient-one" />
      <div className="access-ambient access-ambient-two" />
      <section className="access-card" aria-labelledby="access-title">
        <GroundMeshMark />
        <div className="access-kicker mt-16">
          <span className="size-1.5 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" />
          Bangalore demo environment
        </div>
        <h1 id="access-title" className="mt-5 max-w-lg text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.055em] sm:text-5xl">
          Enter the Situation Room.
        </h1>
        <p className="mt-5 max-w-md text-pretty text-sm leading-6 text-[var(--text-secondary)]">
          A private, isolated workspace where every agent action is grounded in the same verified company reality.
        </p>
        <form className="mt-10" onSubmit={submit}>
          <label htmlFor="access-code" className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
            Demo access code
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" aria-hidden="true" />
              <Input
                id="access-code"
                type="password"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-12 pl-10 font-mono tracking-[0.12em]"
                autoComplete="current-password"
                autoFocus
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "access-error" : undefined}
                placeholder="••••••••••"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              Unlock room
            </Button>
          </div>
          {error && (
            <p id="access-error" role="alert" className="mt-3 flex items-center gap-2 text-xs text-[var(--red-soft)]">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {error}
            </p>
          )}
        </form>
        <div className="mt-12 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          <span>Isolated session</span>
          <span>Simulated actions</span>
          <span>Replay enabled</span>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  action,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--text-secondary)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="truncate text-sm font-semibold tracking-[-0.02em]">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

function SourceCard({
  source,
  index,
  selected,
  onSelect,
  reducedMotion,
}: {
  source: SourceRow;
  index: number;
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
}) {
  const isFounder = source.type === "founder_message" || source.type === "human_decision";
  return (
    <motion.button
      type="button"
      initial={reducedMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reducedMotion ? { duration: 0 } : { ...MOTION.enter, delay: Math.min(index, 6) * 0.045 }}
      className={cn("source-card group text-left", selected && "source-card-selected")}
      onClick={onSelect}
      aria-label={`Open source: ${source.title}`}
    >
      <span className={cn("source-icon", isFounder && "source-icon-authority")}>
        <SourceIcon type={source.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-1 text-xs font-semibold text-[var(--text)]">{source.title}</span>
          {isFounder && <span className="authority-dot" title="Highest authority" />}
        </span>
        <span className="mt-1.5 line-clamp-2 text-[11px] leading-[1.55] text-[var(--text-secondary)]">
          {source.body}
        </span>
        <span className="mt-2.5 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          <span className="truncate">{sourceAuthor(source)}</span>
          <span className="shrink-0">{formatDate(source.sourceTimestamp)}</span>
        </span>
      </span>
    </motion.button>
  );
}

function IngestDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (run: RunRow) => void;
}) {
  const [sourceType, setSourceType] = useState("founder_message");
  const [author, setAuthor] = useState(CANONICAL_EVENT.author);
  const [title, setTitle] = useState(CANONICAL_EVENT.title);
  const [content, setContent] = useState(CANONICAL_EVENT.content);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const isCanonical =
      sourceType === "founder_message" &&
      author.trim() === CANONICAL_EVENT.author &&
      title.trim() === CANONICAL_EVENT.title &&
      content.trim() === CANONICAL_EVENT.content;
    try {
      const result = await ingestEvent({
        source_type: sourceType,
        author: author.trim(),
        title: title.trim(),
        content: content.trim(),
        source_timestamp: isCanonical ? "2026-07-11T09:30:00.000Z" : new Date().toISOString(),
        linked_entities: ["Enterprise SSO", "Acme"],
        metadata: { submitted_via: "situation_room", simulated: true },
      });
      onCreated(result.run);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source could not be accepted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="border-b border-[var(--line)] px-6 py-5 pr-14">
          <DialogTitle>Submit live evidence</DialogTitle>
          <DialogDescription className="mt-1">
            The original text is preserved before any agent begins processing.
          </DialogDescription>
        </div>
        <form onSubmit={submit} className="max-h-[calc(88vh-94px)] overflow-y-auto p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field-label">
              Source type
              <span className="relative mt-2 block">
                <select
                  className="field-select"
                  value={sourceType}
                  onChange={(event) => setSourceType(event.target.value)}
                >
                  <option value="founder_message">Founder message</option>
                  <option value="product_owner_update">Product update</option>
                  <option value="sales_crm_note">Sales CRM note</option>
                  <option value="github_issue">GitHub issue</option>
                  <option value="support_macro">Support macro</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              </span>
            </label>
            <label className="field-label">
              Author
              <Input className="mt-2" value={author} onChange={(event) => setAuthor(event.target.value)} required />
            </label>
          </div>
          <label className="field-label mt-5 block">
            Title
            <Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className="field-label mt-5 block">
            Original source text
            <Textarea
              className="mt-2 min-h-32"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
            />
          </label>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-[11px] leading-5 text-[var(--text-secondary)]">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--lime-soft)]" aria-hidden="true" />
            Source content is treated as untrusted data. Authority comes from the signed session role, never from the text itself.
          </div>
          {error && (
            <p role="alert" className="mt-4 flex items-center gap-2 text-xs text-[var(--red-soft)]">
              <TriangleAlert className="size-3.5" /> {error}
            </p>
          )}
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting || !content.trim()}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Preserve &amp; investigate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SourceInbox({
  sources,
  selectedSourceId,
  onSelect,
  onAdd,
  reducedMotion,
}: {
  sources: SourceRow[];
  selectedSourceId: string | null;
  onSelect: (source: SourceRow) => void;
  onAdd: () => void;
  reducedMotion: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...sources].sort(
        (left, right) => new Date(right.receivedAt).valueOf() - new Date(left.receivedAt).valueOf(),
      ),
    [sources],
  );

  return (
    <aside className="room-panel source-inbox" aria-label="Source Inbox">
      <SectionHeader
        icon={<Inbox className="size-4" aria-hidden="true" />}
        eyebrow="01 · incoming context"
        title="Source Inbox"
        action={
          <Button variant="ghost" size="icon" onClick={onAdd} aria-label="Submit live evidence">
            <Plus className="size-4" />
          </Button>
        }
      />
      <div className="source-summary">
        <span>
          <strong>{sources.length}</strong> preserved sources
        </span>
        <span className="flex items-center gap-1.5 text-[var(--lime-soft)]">
          <CircleDot className="size-3" aria-hidden="true" /> append only
        </span>
      </div>
      <div className="source-list gm-scrollbar" tabIndex={0} aria-label="Preserved source list">
        <AnimatePresence initial={false}>
          {sorted.map((source, index) => (
            <SourceCard
              key={source.id}
              source={source}
              index={index}
              selected={source.id === selectedSourceId}
              onSelect={() => onSelect(source)}
              reducedMotion={reducedMotion}
            />
          ))}
        </AnimatePresence>
      </div>
      <div className="source-footer">
        <span className="flex items-center gap-2">
          <LockKeyhole className="size-3.5" aria-hidden="true" /> Raw source preserved first
        </span>
        <Button variant="quiet" size="sm" onClick={onAdd}>
          Add evidence <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </aside>
  );
}

function MemoryCard({
  memory,
  tone,
  onCitation,
  reducedMotion,
}: {
  memory: MemoryAtomRow;
  tone: "contested" | "candidate" | "verified" | "support";
  onCitation: () => void;
  reducedMotion: boolean;
}) {
  const statusTone =
    memory.status === "active"
      ? "verified"
      : memory.status === "disputed"
        ? "danger"
        : memory.status === "superseded" || memory.status === "stale"
          ? "warning"
          : "neutral";
  return (
    <motion.article
      layout
      initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 7 }}
      animate={{ opacity: memory.status === "superseded" ? 0.62 : 1, scale: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : MOTION.enter}
      className={cn("memory-card", `memory-card-${tone}`)}
    >
      <div className="flex items-center justify-between gap-3">
        <Badge tone={statusTone}>{titleCase(memory.status)}</Badge>
        <span className="font-mono text-[9px] text-[var(--text-tertiary)]">
          {Math.round(memory.confidence * 100)}% conf.
        </span>
      </div>
      <p className={cn("mt-3 text-xs font-medium leading-[1.55]", memory.status === "superseded" && "line-through decoration-[var(--red-muted)]")}>
        {memory.statement}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {titleCase(memory.kind)} · A{memory.authority.toFixed(2)}
        </span>
        <button type="button" className="citation-link" onClick={onCitation}>
          <Link2 className="size-3" aria-hidden="true" /> source
        </button>
      </div>
    </motion.article>
  );
}

function EvidenceCanvas({
  snapshot,
  onSource,
  onConflict,
  reducedMotion,
}: {
  snapshot: WorkspaceSnapshot;
  onSource: (sourceId: string) => void;
  onConflict: (conflict: ConflictRow) => void;
  reducedMotion: boolean;
}) {
  const crm = findMemory(snapshot, /next month|release_date_commitment/i);
  const roadmap = findMemory(snapshot, /\bq3\b|delivery_window/i);
  const support = findMemory(snapshot, /coming soon|availability_timing/i);
  const github = findMemory(snapshot, /security review|release approval/i);
  const founderPolicy =
    findMemory(snapshot, /do not commit|external_release_date_commitment|prohibited/i) ??
    snapshot.memories.find((memory) => memory.authority >= 0.9 && memory.status === "active") ??
    null;
  const founderDecision =
    findMemory(snapshot, /is delayed|delivery_status/i) ??
    snapshot.memories.find((memory) => memory.kind === "decision" && memory.status === "active") ??
    null;
  const primaryConflict = snapshot.conflicts[0] ?? null;
  const contested = [crm, roadmap, support].filter((item): item is MemoryAtomRow => item !== null);
  const verified = [founderPolicy, founderDecision].filter(
    (item, index, list): item is MemoryAtomRow => item !== null && list.indexOf(item) === index,
  );

  return (
    <div className="evidence-canvas" aria-label="Evidence relationship canvas">
      <svg className="evidence-threads" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dangerThread" x1="0" x2="1">
            <stop offset="0" stopColor="var(--red)" stopOpacity="0.08" />
            <stop offset="0.48" stopColor="var(--red)" stopOpacity="0.72" />
            <stop offset="1" stopColor="var(--red)" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="verifiedThread" x1="0" x2="1">
            <stop offset="0" stopColor="var(--violet)" stopOpacity="0.1" />
            <stop offset="0.55" stopColor="var(--lime)" stopOpacity="0.65" />
            <stop offset="1" stopColor="var(--lime)" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path className="thread thread-danger" d="M 160 125 C 325 125, 300 252, 490 252" stroke="url(#dangerThread)" />
        <path className="thread thread-danger" d="M 160 265 C 325 265, 325 252, 490 252" stroke="url(#dangerThread)" />
        <path className="thread thread-danger" d="M 160 405 C 325 405, 330 252, 490 252" stroke="url(#dangerThread)" />
        <path className="thread thread-verified" d="M 515 252 C 690 252, 670 145, 830 145" stroke="url(#verifiedThread)" />
        <path className="thread thread-verified" d="M 515 252 C 690 252, 675 350, 830 350" stroke="url(#verifiedThread)" />
        {!reducedMotion && (
          <circle r="3.5" fill="var(--lime)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 515 252 C 690 252, 670 145, 830 145" />
          </circle>
        )}
      </svg>

      <div className="evidence-column evidence-column-left">
        <p className="canvas-column-label text-[var(--red-soft)]">
          <TriangleAlert className="size-3" /> Contested claims
        </p>
        <div className="space-y-3">
          {contested.length ? (
            contested.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                tone="contested"
                onCitation={() => onSource(memory.sourceId)}
                reducedMotion={reducedMotion}
              />
            ))
          ) : (
            <div className="canvas-empty">No competing claims retrieved yet.</div>
          )}
        </div>
      </div>

      <div className="evidence-column evidence-column-center">
        <p className="canvas-column-label text-[var(--violet-soft)]">
          <Network className="size-3" /> Resolution junction
        </p>
        {primaryConflict ? (
          <button
            type="button"
            onClick={() => onConflict(primaryConflict)}
            className="resolution-node group"
            aria-label={`Open ${primaryConflict.severity} severity conflict`}
          >
            <span className="resolution-pulse" aria-hidden="true" />
            <span className="relative z-10">
              <span className="flex items-center justify-between gap-3">
                <Badge tone={primaryConflict.status === "resolved" ? "verified" : "danger"}>
                  {primaryConflict.status}
                </Badge>
                <PanelRightOpen className="size-3.5 text-[var(--text-tertiary)] transition group-hover:text-[var(--text)]" />
              </span>
              <span className="mt-3 block text-left text-sm font-semibold leading-5">{primaryConflict.topic}</span>
              <span className="mt-2 line-clamp-3 block text-left text-[10px] leading-4 text-[var(--text-secondary)]">
                {primaryConflict.resolution ?? primaryConflict.reason}
              </span>
              <span className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <span>{titleCase(primaryConflict.severity)} impact</span>
                <span>{primaryConflict.scoreGap ? `+${primaryConflict.scoreGap.toFixed(2)} lead` : "Evidence ranked"}</span>
              </span>
            </span>
          </button>
        ) : (
          <div className="resolution-node resolution-node-idle">
            <CircleDot className="size-5 text-[var(--text-tertiary)]" />
            <p className="mt-3 text-xs text-[var(--text-secondary)]">Waiting for Rook to audit related context.</p>
          </div>
        )}
        {github && (
          <div className="mt-3">
            <MemoryCard
              memory={github}
              tone="support"
              onCitation={() => onSource(github.sourceId)}
              reducedMotion={reducedMotion}
            />
          </div>
        )}
      </div>

      <div className="evidence-column evidence-column-right">
        <p className="canvas-column-label text-[var(--lime-soft)]">
          <BadgeCheck className="size-3" /> Verified truth
        </p>
        <div className="space-y-3">
          {verified.length ? (
            verified.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                tone="verified"
                onCitation={() => onSource(memory.sourceId)}
                reducedMotion={reducedMotion}
              />
            ))
          ) : (
            <div className="canvas-empty">No authoritative claim selected yet.</div>
          )}
        </div>
        {verified.length > 0 && (
          <div className="verified-impact">
            <Sparkles className="size-3.5 text-[var(--lime)]" />
            <span>Applied to Support, Sales + Customer Success</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceTable({ snapshot, onSource }: { snapshot: WorkspaceSnapshot; onSource: (sourceId: string) => void }) {
  return (
    <div className="evidence-table-wrap gm-scrollbar" tabIndex={0}>
      <table className="evidence-table">
        <caption className="sr-only">Memory claims and their evidence state</caption>
        <thead>
          <tr>
            <th>Claim</th>
            <th>Type</th>
            <th>Status</th>
            <th>Authority</th>
            <th>Freshness</th>
            <th>Confidence</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.memories.map((memory) => (
            <tr key={memory.id}>
              <td className="min-w-72 font-medium text-[var(--text)]">{memory.statement}</td>
              <td>{titleCase(memory.kind)}</td>
              <td>
                <Badge
                  tone={
                    memory.status === "active"
                      ? "verified"
                      : memory.status === "disputed"
                        ? "danger"
                        : memory.status === "stale" || memory.status === "superseded"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {memory.status}
                </Badge>
              </td>
              <td className="font-mono">{memory.authority.toFixed(2)}</td>
              <td className="font-mono">{Math.round(memory.freshness * 100)}%</td>
              <td className="font-mono">{Math.round(memory.confidence * 100)}%</td>
              <td>
                <button type="button" className="citation-link" onClick={() => onSource(memory.sourceId)}>
                  <Link2 className="size-3" /> Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceSurface({
  snapshot,
  onSource,
  onConflict,
  reducedMotion,
}: {
  snapshot: WorkspaceSnapshot;
  onSource: (sourceId: string) => void;
  onConflict: (conflict: ConflictRow) => void;
  reducedMotion: boolean;
}) {
  const [view, setView] = useState<EvidenceView>("canvas");
  return (
    <section id="evidence-surface" className="room-panel evidence-surface" aria-label="Shared Evidence Table" tabIndex={-1}>
      <SectionHeader
        icon={<Network className="size-4" aria-hidden="true" />}
        eyebrow="02 · shared reasoning surface"
        title="Evidence Table"
        action={
          <div className="view-toggle" role="group" aria-label="Evidence view">
            <button type="button" onClick={() => setView("canvas")} aria-pressed={view === "canvas"}>
              <Network className="size-3.5" /> Canvas
            </button>
            <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"}>
              <Braces className="size-3.5" /> Table
            </button>
          </div>
        }
      />
      <div className="evidence-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <span className="topic-pill"><span className="size-1.5 rounded-full bg-[var(--violet)]" /> Enterprise SSO</span>
          <span className="topic-pill">Acme</span>
          <span className="topic-pill">Release date</span>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          <GitBranch className="size-3" /> append-oriented history
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          {...(!reducedMotion ? { exit: { opacity: 0, y: -4 } } : {})}
          transition={reducedMotion ? { duration: 0 } : MOTION.quick}
          className="min-h-0 flex-1"
        >
          {view === "canvas" ? (
            <EvidenceCanvas
              snapshot={snapshot}
              onSource={onSource}
              onConflict={onConflict}
              reducedMotion={reducedMotion}
            />
          ) : (
            <EvidenceTable snapshot={snapshot} onSource={onSource} />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function AgentRail({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  return (
    <aside className="room-panel agent-rail" aria-label="Agent Presence Rail">
      <SectionHeader
        icon={<Bot className="size-4" aria-hidden="true" />}
        eyebrow="03 · managed colleagues"
        title="Agent Presence"
        action={<span className="live-signal" aria-label="Agent presence online"><i /> live</span>}
      />
      <div className="agent-list">
        {AGENT_CONFIG.map((agent, index) => {
          const state = agentState(snapshot, agent.id);
          return (
            <div key={agent.id} className={cn("agent-card", `agent-${agent.color}`, state === "working" && "agent-working")}>
              {index < AGENT_CONFIG.length - 1 && <span className="agent-handoff-line" aria-hidden="true" />}
              <div className="agent-avatar-wrap">
                <span className="agent-avatar">{agent.short}</span>
                <span className={cn("agent-state-dot", `state-${state}`)} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <strong className="block text-xs text-[var(--text)]">{agent.name}</strong>
                    <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">{agent.role}</span>
                  </span>
                  <span className={cn("agent-state-label", `state-label-${state}`)}>{state}</span>
                </div>
                <p className="mt-3 text-[10px] leading-[1.55] text-[var(--text-secondary)]">
                  “{agentSummary(snapshot, agent.id, state)}”
                </p>
                {state === "working" && (
                  <div className="mt-3 h-px overflow-hidden bg-[var(--line)]">
                    <motion.div
                      className="h-full w-1/2 bg-current"
                      animate={{ x: ["-100%", "250%"] }}
                      transition={{ duration: MOTION.handoff.duration, ease: MOTION.handoff.ease, repeat: Infinity }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="agent-rail-footer">
        <div>
          <p className="section-eyebrow">Handoff policy</p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">Each specialist sees only the evidence required for its role.</p>
        </div>
        <ShieldCheck className="size-4 shrink-0 text-[var(--lime-soft)]" />
      </div>
    </aside>
  );
}

function GuardVerdictPanel({ decision, onReview }: { decision: GuardDecisionRow; onReview: () => void }) {
  const isBlock = decision.verdict === "BLOCK";
  const isApproval = decision.verdict === "REQUIRE_APPROVAL";
  const tone = isBlock ? "danger" : isApproval ? "warning" : decision.verdict === "ALLOW" ? "verified" : "warning";
  const Icon = isBlock ? Ban : isApproval ? UserRoundCheck : decision.verdict === "ALLOW" ? CheckCircle2 : TriangleAlert;
  const safeReply = decision.recommendedAction ?? SAFE_REPLY;
  const citationCount = decision.citations.length + (decision.governingMemoryId ? 1 : 0);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={MOTION.enter} className={cn("guard-result", `guard-result-${tone}`)}>
      <div className="flex items-start gap-3">
        <span className="guard-verdict-icon"><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Action Guard verdict</span>
              <strong className="mt-0.5 block text-lg tracking-[-0.03em]">{titleCase(decision.verdict)}</strong>
            </span>
            <Badge tone={tone}>{Math.round(decision.confidence * 100)}% confidence</Badge>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">{decision.explanation}</p>
          {isBlock && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="guard-claim guard-claim-blocked">
                <span className="guard-claim-label"><XCircle className="size-3" /> Prohibited claim</span>
                <p>{decision.prohibitedClaim ?? decision.canonicalClaim ?? "SSO will be available next month."}</p>
              </div>
              <div className="guard-claim guard-claim-safe">
                <span className="guard-claim-label"><Check className="size-3" /> Safe correction</span>
                <p>{safeReply}</p>
              </div>
            </div>
          )}
          {(isBlock || isApproval) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
              <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                <Link2 className="size-3" /> {citationCount > 0 ? `${citationCount} linked citation${citationCount === 1 ? "" : "s"}` : "Citation verification pending"}
              </span>
              <Button variant={isBlock ? "danger" : "secondary"} size="sm" onClick={onReview}>
                <UserRoundCheck className="size-3.5" /> Review correction
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionGate({
  snapshot,
  onRefresh,
  onReview,
}: {
  snapshot: WorkspaceSnapshot;
  onRefresh: () => Promise<void>;
  onReview: (review: HumanReviewRow | null, decision: GuardDecisionRow | null) => void;
}) {
  const [proposedAction, setProposedAction] = useState(
    "Reply to Acme: Enterprise SSO will be available next month.",
  );
  const [checkedDecision, setCheckedDecision] = useState<GuardDecisionRow | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decision = checkedDecision ?? latestDecision(snapshot);

  async function runGuard() {
    setChecking(true);
    setError(null);
    try {
      let pack = latestPack(snapshot);
      if (!pack || ["expired", "invalidated"].includes(pack.status)) {
        pack = await createContextPack();
      }
      const result = await checkAction(pack.id, proposedAction);
      setCheckedDecision(result);
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be checked.");
    } finally {
      setChecking(false);
    }
  }

  const openReview = () => {
    const review =
      snapshot.reviews.find(
        (item) =>
          item.status === "pending" &&
          (item.subjectId === decision?.id || item.id === decision?.reviewId),
      ) ?? snapshot.reviews.find((item) => item.status === "pending") ?? null;
    onReview(review, decision);
  };

  const pack = latestPack(snapshot);
  return (
    <section className="room-panel action-gate" aria-label="Action Gate">
      <SectionHeader
        icon={<ShieldAlert className="size-4" aria-hidden="true" />}
        eyebrow="04 · deterministic enforcement"
        title="Action Gate"
        action={<Badge tone="violet"><Activity className="size-3" /> simulated only</Badge>}
      />
      <div className="action-gate-body">
        <div className="action-composer">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="proposed-action" className="field-label">Proposed customer action</label>
            {pack && (
              <span className="font-mono text-[9px] text-[var(--text-tertiary)]">
                Pack {shortId(pack.id)} · {Math.round(pack.confidence * 100)}%
              </span>
            )}
          </div>
          <div className="relative mt-2">
            <Textarea
              id="proposed-action"
              className="min-h-20 resize-none pr-28"
              value={proposedAction}
              onChange={(event) => setProposedAction(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="absolute bottom-2.5 right-2.5"
              onClick={runGuard}
              disabled={checking || !proposedAction.trim()}
            >
              {checking ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              Check action
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            <span>Claim extraction → policy match → verdict</span>
            <span>Never defaults to allow</span>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-[var(--red-soft)]">{error}</p>}
        </div>
        <div className="min-w-0">
          {decision ? (
            <GuardVerdictPanel decision={decision} onReview={openReview} />
          ) : (
            <div className="guard-empty">
              <ShieldCheck className="size-5 text-[var(--text-tertiary)]" />
              <div>
                <p className="text-xs font-medium text-[var(--text)]">No verdict yet</p>
                <p className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">Run the proposed reply through the active Context Pack before it can leave this room.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SourceDialog({ source, onOpenChange }: { source: SourceRow | null; onOpenChange: (open: boolean) => void }) {
  if (!source) return null;
  return (
    <Dialog open={Boolean(source)} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="border-b border-[var(--line)] px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <span className="source-icon source-icon-authority"><SourceIcon type={source.type} className="size-4" /></span>
            <div>
              <DialogTitle>{source.title}</DialogTitle>
              <DialogDescription className="mt-1">Immutable source record · {shortId(source.id)}</DialogDescription>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SourceMeta label="Type" value={titleCase(source.type)} />
            <SourceMeta label="Author" value={sourceAuthor(source)} />
            <SourceMeta label="Authority" value={authorityLabel(source)} />
            <SourceMeta label="Source time" value={formatDate(source.sourceTimestamp, true)} />
          </div>
          <div className="source-original mt-6">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Original text</span>
            <blockquote className="mt-3 text-base leading-7 tracking-[-0.015em] text-[var(--text)]">“{source.body}”</blockquote>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            <span>Received {formatDate(source.receivedAt, true)}</span>
            <span className="flex items-center gap-1.5 text-[var(--lime-soft)]"><ShieldCheck className="size-3" /> Provenance intact</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="source-meta">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConflictDialog({
  conflict,
  snapshot,
  onOpenChange,
  onSource,
}: {
  conflict: ConflictRow | null;
  snapshot: WorkspaceSnapshot;
  onOpenChange: (open: boolean) => void;
  onSource: (sourceId: string) => void;
}) {
  if (!conflict) return null;
  const left = snapshot.memories.find((memory) => memory.id === conflict.leftMemoryId) ?? null;
  const right = snapshot.memories.find((memory) => memory.id === conflict.rightMemoryId) ?? null;
  const winner = snapshot.memories.find((memory) => memory.id === conflict.winnerMemoryId) ?? right;
  return (
    <Dialog open={Boolean(conflict)} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel-solid)] px-6 py-5 pr-14">
          <p className="section-eyebrow text-[var(--red-soft)]">Conflict room · {titleCase(conflict.severity)} impact</p>
          <DialogTitle className="mt-1">{conflict.topic}</DialogTitle>
          <DialogDescription className="mt-2">Compare the complete evidence record before an operational claim is accepted.</DialogDescription>
        </div>
        <div className="p-6">
          <div className="conflict-comparison">
            {[left, right].map((memory, index) => (
              <div key={memory?.id ?? index} className={cn("conflict-claim", memory?.id === winner?.id && "conflict-claim-winner")}>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={memory?.id === winner?.id ? "verified" : "danger"}>{memory?.id === winner?.id ? "authoritative" : "challenged"}</Badge>
                  <span className="font-mono text-[9px] text-[var(--text-tertiary)]">{memory ? `A${memory.authority.toFixed(2)}` : "Missing"}</span>
                </div>
                <p className="mt-4 text-sm font-medium leading-6">{memory?.statement ?? "Claim record unavailable"}</p>
                {memory && (
                  <button type="button" className="citation-link mt-4" onClick={() => onSource(memory.sourceId)}>
                    <Link2 className="size-3" /> View original source
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="resolution-explainer mt-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--violet)_14%,transparent)] text-[var(--violet-soft)]"><Sparkles className="size-4" /></span>
              <div>
                <p className="text-xs font-semibold">Vera’s evidence resolution</p>
                <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{conflict.resolution ?? conflict.reason}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              <Score label="Authority" value={winner?.authority ?? 0} weight="50%" />
              <Score label="Freshness" value={winner?.freshness ?? 0} weight="25%" />
              <Score label="Directness" value={winner?.directness ?? 0} weight="15%" />
              <Score label="Corroboration" value={winner?.corroboration ?? 0} weight="10%" />
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-[color-mix(in_oklab,var(--lime)_24%,var(--line))] bg-[color-mix(in_oklab,var(--lime)_6%,var(--panel))] p-4">
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--lime-soft)]"><BadgeCheck className="size-3.5" /> operational resolution</span>
            <p className="mt-3 text-sm font-medium leading-6">{winner?.statement ?? "The resolved claim remains available in the evidence table."}</p>
            <p className="mt-2 text-[10px] leading-4 text-[var(--text-secondary)]">History was not deleted. Competing claims remain inspectable and are marked with their current status.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Score({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div className="score-cell">
      <span>{label}</span>
      <strong>{Math.round(value * 100)}</strong>
      <small>{weight} weight</small>
    </div>
  );
}

function ReviewDrawer({
  review,
  decision,
  open,
  onOpenChange,
  onResolved,
}: {
  review: HumanReviewRow | null;
  decision: GuardDecisionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => Promise<void>;
}) {
  const [wording, setWording] = useState(review?.proposedWording ?? decision?.recommendedAction ?? SAFE_REPLY);
  const [rationale, setRationale] = useState("Keeps the response aligned with the founder decision and the open security review.");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "approve" | "edit" | "reject" | "request_more_evidence") {
    if (!review) {
      setError("The correction review has not been persisted yet. Run Action Guard again to create it.");
      return;
    }
    setSubmitting(action);
    setError(null);
    try {
      await resolveReview(review.id, {
        decision: action,
        resolved_content: wording.trim(),
        rationale: rationale.trim(),
      });
      await onResolved();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review could not be resolved.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--panel-solid)] px-6 py-5 pr-14">
          <div className="flex items-center gap-2">
            <Badge tone="warning">Human review</Badge>
            {review && <span className="font-mono text-[9px] text-[var(--text-tertiary)]">{shortId(review.id)}</span>}
          </div>
          <DialogTitle className="mt-3">Approve a safe correction</DialogTitle>
          <DialogDescription className="mt-2">The blocked wording cannot be overridden. Approval creates a new immutable human-decision source and durable outcome memory.</DialogDescription>
        </div>
        <div className="space-y-5 p-6">
          <div className="review-alert">
            <Ban className="mt-0.5 size-4 shrink-0 text-[var(--red-soft)]" />
            <div>
              <p className="text-xs font-semibold">Original action remains blocked</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{decision?.prohibitedClaim ?? decision?.canonicalClaim ?? "SSO will be available next month."}</p>
            </div>
          </div>
          <label className="field-label block">
            Approved customer wording
            <Textarea className="mt-2 min-h-36" value={wording} onChange={(event) => setWording(event.target.value)} />
          </label>
          <label className="field-label block">
            Decision rationale
            <Textarea className="mt-2 min-h-24" value={rationale} onChange={(event) => setRationale(event.target.value)} />
          </label>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="section-eyebrow">Affected Context Packs</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Support · Acme', 'Sales · Enterprise', 'Customer Success · SSO'].map((item) => (
                <span key={item} className="topic-pill"><RefreshCw className="size-3" /> {item}</span>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[var(--text-secondary)]">Approval invalidates and rebuilds these packs before future actions.</p>
          </div>
          {error && <p role="alert" className="text-xs leading-5 text-[var(--red-soft)]">{error}</p>}
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-5">
            <Button variant="ghost" onClick={() => submit("request_more_evidence")} disabled={Boolean(submitting)}>
              More evidence
            </Button>
            <Button variant="danger" onClick={() => submit("reject")} disabled={Boolean(submitting)}>
              Reject
            </Button>
            <Button className="col-span-2" variant="primary" size="lg" onClick={() => submit(wording === review?.proposedWording ? "approve" : "edit")} disabled={Boolean(submitting) || !wording.trim() || !rationale.trim()}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />}
              Approve correction &amp; teach GroundMesh
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReplayDialog({
  snapshot,
  open,
  onOpenChange,
  onRetry,
  onCancel,
}: {
  snapshot: WorkspaceSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: (runId: string) => Promise<void>;
  onCancel: (runId: string) => Promise<void>;
}) {
  const newest = latestRun(snapshot);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [acting, setActing] = useState(false);
  const run = snapshot.runs.find((item) => item.id === selectedRunId) ?? newest;
  const events = [...snapshot.events]
    .filter((event) => event.runId === run?.id)
    .sort((left, right) => left.sequence - right.sequence);

  async function act(kind: "retry" | "cancel") {
    if (!run) return;
    setActing(true);
    try {
      await (kind === "retry" ? onRetry(run.id) : onCancel(run.id));
    } finally {
      setActing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,900px)]">
        <div className="border-b border-[var(--line)] px-6 py-5 pr-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle>Run Replay</DialogTitle>
              <DialogDescription className="mt-1">Ordered persisted events, safe summaries and provider mode.</DialogDescription>
            </div>
            {run && <Badge tone={run.status === "completed" ? "verified" : runIsActive(run) ? "updating" : "danger"}>{run.status}</Badge>}
          </div>
        </div>
        <div className="grid max-h-[calc(88vh-94px)] min-h-[520px] grid-cols-[210px_minmax(0,1fr)] overflow-hidden max-sm:grid-cols-1">
          <aside className="replay-runs gm-scrollbar border-r border-[var(--line)] bg-[var(--panel)] p-3 max-sm:max-h-40 max-sm:border-b max-sm:border-r-0">
            <p className="section-eyebrow px-2 py-2">Recorded runs</p>
            {snapshot.runs.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedRunId(item.id)} className={cn("replay-run", item.id === run?.id && "replay-run-active")}>
                <span className="flex items-center justify-between gap-2"><strong>{titleCase(item.kind)}</strong><i className={cn("run-status-dot", `run-${item.status}`)} /></span>
                <span>{formatDate(item.createdAt)}</span>
                <span className="font-mono">{shortId(item.id)}</span>
              </button>
            ))}
          </aside>
          <div className="gm-scrollbar overflow-y-auto p-6">
            {run && (
              <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SourceMeta label="Mode" value={executionLabel(run.executionMode)} />
                <SourceMeta label="Duration" value={formatDuration(run)} />
                <SourceMeta label="Attempt" value={`#${run.attempt}`} />
                <SourceMeta label="Events" value={String(events.length)} />
              </div>
            )}
            <ol className="replay-timeline" aria-label="Ordered run event timeline">
              {events.map((event, index) => (
                <li key={event.id} className="replay-event">
                  <span className="replay-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="replay-line" aria-hidden="true" />
                  <div className="min-w-0 flex-1 pb-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <strong className="text-xs">{titleCase(event.type)}</strong>
                        <Badge tone={event.agent === "human" ? "warning" : event.agent === "orchestrator" ? "neutral" : "violet"}>{event.agent}</Badge>
                      </span>
                      <time className="font-mono text-[9px] text-[var(--text-tertiary)]">{formatDate(event.createdAt)}</time>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{eventSummary(event)}</p>
                    <span className="mt-2 block font-mono text-[8px] uppercase tracking-[0.09em] text-[var(--text-tertiary)]">sequence {event.sequence} · {executionLabel(event.executionMode)}</span>
                  </div>
                </li>
              ))}
            </ol>
            {!events.length && <div className="guard-empty">No persisted events are available for this run yet.</div>}
            {run && (run.status === "failed" || run.status === "needs_review") && (
              <Button variant="secondary" size="sm" onClick={() => act("retry")} disabled={acting}><RotateCcw className="size-3.5" /> Retry run</Button>
            )}
            {run && runIsActive(run) && (
              <Button variant="danger" size="sm" onClick={() => act("cancel")} disabled={acting}><Ban className="size-3.5" /> Cancel run</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Header({
  snapshot,
  connected,
  onReplay,
  onReset,
  resetting,
}: {
  snapshot: WorkspaceSnapshot;
  connected: boolean;
  onReplay: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const run = latestRun(snapshot);
  const mode = latestMode(snapshot);
  const truth = snapshot.workspace.truthStatus;
  const truthTone = truth === "verified" ? "verified" : truth === "updating" ? "updating" : "danger";
  const TruthIcon = truth === "verified" ? BadgeCheck : truth === "updating" ? RefreshCw : TriangleAlert;
  return (
    <header className="room-header">
      <div className="flex min-w-0 items-center gap-5">
        <GroundMeshMark />
        <span className="hidden h-8 w-px bg-[var(--line)] sm:block" />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-xs font-medium text-[var(--text)]">{snapshot.workspace.name}</p>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Situation Room · SSO incident</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="header-health hidden md:flex">
          <span className={cn("truth-orb", `truth-${truth}`)}><TruthIcon className="size-3.5" /></span>
          <span>
            <span className="block text-[10px] font-semibold">{titleCase(truth)}</span>
            <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {snapshot.counts.openConflicts} open · {snapshot.counts.staleMemories} stale
            </span>
          </span>
          <Badge tone={truthTone} className="ml-2">truth state</Badge>
        </div>
        <span className="mode-chip" title="Current provider execution mode">
          <i className={cn(mode === "cached_demo" ? "bg-[var(--amber)]" : connected ? "bg-[var(--lime)]" : "bg-[var(--red)]")} />
          <span className="hidden sm:inline">{executionLabel(mode)}</span>
          <span className="sm:hidden">{mode === "cached_demo" ? "Cached" : "Live"}</span>
        </span>
        <Button variant="quiet" size="sm" onClick={onReplay}>
          <History className="size-3.5" /> <span className="hidden sm:inline">Replay</span>
          {run && <span className="hidden font-mono text-[8px] text-[var(--text-tertiary)] xl:inline">{shortId(run.id)}</span>}
        </Button>
        <Button variant="ghost" size="icon" onClick={onReset} disabled={resetting} aria-label="Reset demo workspace">
          <RotateCcw className={cn("size-4", resetting && "animate-spin")} />
        </Button>
      </div>
    </header>
  );
}

function StatusStrip({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const run = latestRun(snapshot);
  const active = runIsActive(run ?? undefined);
  const contextPack = latestPack(snapshot);
  return (
    <div className="status-strip" role="status" aria-live="polite">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("run-orbit", !active && "run-orbit-idle")} aria-hidden="true"><i /></span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[var(--text)]">
            {active ? run?.safeSummary ?? `${titleCase(run?.currentStep ?? "workflow")} in progress` : run?.safeSummary ?? "Organizational context is ready"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.09em] text-[var(--text-tertiary)]">
            {run ? `${titleCase(run.status)} · ${executionLabel(run.executionMode)} · ${formatDuration(run)}` : "No active run"}
          </p>
        </div>
      </div>
      <div className="status-strip-metrics">
        <span><strong>{snapshot.memories.length}</strong> memory atoms</span>
        <span><strong>{snapshot.conflicts.length}</strong> conflicts traced</span>
        <span><strong>{contextPack ? Math.round(contextPack.confidence * 100) : 0}%</strong> pack confidence</span>
        <span><strong>{snapshot.counts.pendingReviews}</strong> human review</span>
      </div>
    </div>
  );
}

function ResetDialog({ open, onOpenChange, onConfirm, resetting }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; resetting: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,480px)]">
        <div className="p-6 pr-14">
          <span className="grid size-10 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--amber)_35%,var(--line))] bg-[color-mix(in_oklab,var(--amber)_9%,transparent)] text-[var(--amber-soft)]"><RotateCcw className="size-4" /></span>
          <DialogTitle className="mt-5">Reset this demo workspace?</DialogTitle>
          <DialogDescription className="mt-2">The isolated session returns to the four seeded sources and canonical pre-investigation state. No other judge session is affected.</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep current state</Button>
            <Button variant="danger" onClick={onConfirm} disabled={resetting}>
              {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Reset workspace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SituationRoom() {
  const reducedMotionPreference = useReducedMotion();
  const reducedMotion = reducedMotionPreference ?? false;
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [selectedSource, setSelectedSource] = useState<SourceRow | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRow | null>(null);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<HumanReviewRow | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<GuardDecisionRow | null>(null);
  const eventIdsRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const next = await getWorkspaceSnapshot();
    setSnapshot(next);
    const active = next.runs.find(runIsActive);
    if (active) {
      setActiveRunId(active.id);
      setConnected(true);
    } else {
      setActiveRunId(null);
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAccessStatus()
      .then((status) => {
        if (cancelled) return;
        setAccessStatus(status);
        if (status.authenticated) {
          refresh()
            .catch((error: unknown) => setFatalError(error instanceof Error ? error.message : "Workspace unavailable"))
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFatalError(error instanceof Error ? error.message : "Access service unavailable");
        setLoading(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!activeRunId) return;
    const unsubscribe = subscribeToRun(activeRunId, {
      onEvent: (event) => {
        if (eventIdsRef.current.has(event.id)) return;
        eventIdsRef.current.add(event.id);
        setConnected(true);
        setAnnouncement(eventSummary(event));
        setSnapshot((current) => {
          if (!current || current.events.some((item) => item.id === event.id)) return current;
          return { ...current, events: [...current.events, event] };
        });
        if (["run_completed", "run_failed", "run_cancelled"].includes(event.type)) {
          setConnected(false);
          setActiveRunId(null);
          void refresh();
        }
      },
      onError: () => setConnected(false),
    });
    return unsubscribe;
  }, [activeRunId, refresh]);

  function unlock(status: AccessStatus) {
    setAccessStatus(status);
    setLoading(true);
    refresh()
      .catch((error: unknown) => setFatalError(error instanceof Error ? error.message : "Workspace unavailable"))
      .finally(() => setLoading(false));
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetDemo();
      setActiveRunId(null);
      eventIdsRef.current.clear();
      await refresh();
      setResetOpen(false);
      setAnnouncement("The isolated demo workspace has been reset.");
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  async function handleRunCreated(run: RunRow) {
    setActiveRunId(run.id);
    setConnected(true);
    await refresh();
  }

  async function handleRetry(runId: string) {
    const run = await retryRun(runId);
    setActiveRunId(run.id);
    await refresh();
  }

  async function handleCancel(runId: string) {
    await cancelRun(runId);
    await refresh();
  }

  function openReview(review: HumanReviewRow | null, decision: GuardDecisionRow | null) {
    setSelectedReview(review);
    setSelectedDecision(decision);
    setReviewOpen(true);
  }

  function openSourceById(sourceId: string) {
    const source = snapshot?.sources.find((item) => item.id === sourceId) ?? null;
    setSelectedConflict(null);
    setSelectedSource(source);
  }

  if (checkingAccess || !accessStatus?.authenticated) {
    return <AccessGate status={accessStatus} checking={checkingAccess} onUnlocked={unlock} />;
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--ink)]">
        <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
          <Loader2 className="size-4 animate-spin text-[var(--lime)]" /> Loading isolated Situation Room…
        </div>
      </main>
    );
  }

  if (fatalError || !snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--ink)] p-6">
        <section className="w-full max-w-md rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-solid)] p-7">
          <GroundMeshMark />
          <TriangleAlert className="mt-12 size-7 text-[var(--red-soft)]" />
          <h1 className="mt-4 text-xl font-semibold tracking-[-0.035em]">The Situation Room could not load.</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{fatalError ?? "The workspace snapshot is unavailable."}</p>
          <Button className="mt-6" variant="secondary" onClick={() => window.location.reload()}><RefreshCw className="size-4" /> Retry connection</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="situation-room">
      <a href="#evidence-surface" className="skip-link">Skip to evidence</a>
      <Header snapshot={snapshot} connected={connected} onReplay={() => setReplayOpen(true)} onReset={() => setResetOpen(true)} resetting={resetting} />
      <StatusStrip snapshot={snapshot} />
      <div className="room-grid">
        <SourceInbox
          sources={snapshot.sources}
          selectedSourceId={selectedSource?.id ?? null}
          onSelect={setSelectedSource}
          onAdd={() => setIngestOpen(true)}
          reducedMotion={reducedMotion}
        />
        <EvidenceSurface snapshot={snapshot} onSource={openSourceById} onConflict={setSelectedConflict} reducedMotion={reducedMotion} />
        <AgentRail snapshot={snapshot} />
        <ActionGate snapshot={snapshot} onRefresh={refresh} onReview={openReview} />
      </div>
      <footer className="room-footer">
        <span>GroundMesh v1.0 · Hackathon workspace</span>
        <span className="flex items-center gap-4"><span>All customer actions simulated</span><span>Private reasoning hidden</span><span>Sources inspectable</span></span>
      </footer>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      <IngestDialog open={ingestOpen} onOpenChange={setIngestOpen} onCreated={handleRunCreated} />
      <SourceDialog source={selectedSource} onOpenChange={(open) => !open && setSelectedSource(null)} />
      <ConflictDialog conflict={selectedConflict} snapshot={snapshot} onOpenChange={(open) => !open && setSelectedConflict(null)} onSource={openSourceById} />
      <ReviewDrawer
        key={`${selectedReview?.id ?? "new"}:${selectedDecision?.id ?? "none"}`}
        review={selectedReview}
        decision={selectedDecision}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onResolved={refresh}
      />
      <ReplayDialog snapshot={snapshot} open={replayOpen} onOpenChange={setReplayOpen} onRetry={handleRetry} onCancel={handleCancel} />
      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={handleReset} resetting={resetting} />
    </main>
  );
}
