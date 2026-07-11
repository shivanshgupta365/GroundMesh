import type {
  ApplicablePolicy,
  AuthorityRole,
  Claim,
  ClaimPattern,
  ContextPack,
  GuardReason,
  GuardVerdict,
  MemoryStatus,
  MemoryType,
  RecommendedAction,
  TruthState,
} from "./contracts";

export const AUTHORITY_SCORES = {
  founder_decision: 1,
  approved_policy: 0.9,
  product_owner_update: 0.8,
  implementation_evidence: 0.75,
  crm_note: 0.55,
  support_macro: 0.45,
  agent_inference: 0.25,
} as const satisfies Readonly<Record<AuthorityRole, number>>;

export const FRESHNESS_TTL_DAYS = {
  policy_or_decision: 365,
  project_update_or_commitment: 90,
  implementation_fact: 120,
  customer_context_or_outcome: 180,
  default: 90,
} as const;

export const RESOLUTION_WEIGHTS = {
  authority: 0.5,
  freshness: 0.25,
  directness: 0.15,
  corroboration: 0.1,
} as const;

export const AUTOMATIC_RESOLUTION_THRESHOLD = 0.8;
export const AUTOMATIC_RESOLUTION_MINIMUM_LEAD = 0.15;
export const GUARD_MINIMUM_CONFIDENCE = 0.75;
export const GUARD_ALLOW_CONFIDENCE = 0.9;
export const CONTEXT_PACK_TTL_MS = 60 * 60 * 1_000;

const DAY_MS = 24 * 60 * 60 * 1_000;

export function authorityScoreFor(role: AuthorityRole): number {
  return AUTHORITY_SCORES[role];
}

export function freshnessTtlDaysFor(
  memoryType: MemoryType,
  authorityRole: AuthorityRole,
): number {
  if (memoryType === "policy" || memoryType === "decision") {
    return FRESHNESS_TTL_DAYS.policy_or_decision;
  }

  if (memoryType === "project_update" || memoryType === "commitment") {
    return FRESHNESS_TTL_DAYS.project_update_or_commitment;
  }

  if (memoryType === "fact" && authorityRole === "implementation_evidence") {
    return FRESHNESS_TTL_DAYS.implementation_fact;
  }

  if (memoryType === "customer_context" || memoryType === "agent_outcome") {
    return FRESHNESS_TTL_DAYS.customer_context_or_outcome;
  }

  return FRESHNESS_TTL_DAYS.default;
}

export interface FreshnessInput {
  memoryType: MemoryType;
  authorityRole: AuthorityRole;
  sourceTimestamp: string | Date;
  validFrom?: string | Date | null;
  validUntil?: string | Date | null;
  status: MemoryStatus;
  asOf?: string | Date;
}

export function calculateFreshnessScore(input: FreshnessInput): number {
  if (
    input.status === "superseded" ||
    input.status === "stale" ||
    input.status === "rejected"
  ) {
    return 0;
  }

  const asOf = toTimestamp(input.asOf ?? new Date(), "asOf");
  const sourceTimestamp = toTimestamp(input.sourceTimestamp, "sourceTimestamp");
  const validFrom =
    input.validFrom === null || input.validFrom === undefined
      ? sourceTimestamp
      : toTimestamp(input.validFrom, "validFrom");
  const effectiveStart = Math.max(sourceTimestamp, validFrom);

  if (asOf < effectiveStart) {
    return 0;
  }

  const ttlExpiry =
    effectiveStart + freshnessTtlDaysFor(input.memoryType, input.authorityRole) * DAY_MS;
  const explicitExpiry =
    input.validUntil === null || input.validUntil === undefined
      ? Number.POSITIVE_INFINITY
      : toTimestamp(input.validUntil, "validUntil");
  const effectiveExpiry = Math.min(ttlExpiry, explicitExpiry);

  if (effectiveExpiry <= effectiveStart || asOf >= effectiveExpiry) {
    return 0;
  }

  return roundScore((effectiveExpiry - asOf) / (effectiveExpiry - effectiveStart));
}

export interface ResolutionScoreInput {
  authority: number;
  freshness: number;
  directness: number;
  corroboration: number;
}

export function calculateResolutionScore(input: ResolutionScoreInput): number {
  const authority = assertScore(input.authority, "authority");
  const freshness = assertScore(input.freshness, "freshness");
  const directness = assertScore(input.directness, "directness");
  const corroboration = assertScore(input.corroboration, "corroboration");

  return roundScore(
    authority * RESOLUTION_WEIGHTS.authority +
      freshness * RESOLUTION_WEIGHTS.freshness +
      directness * RESOLUTION_WEIGHTS.directness +
      corroboration * RESOLUTION_WEIGHTS.corroboration,
  );
}

export interface ResolutionEvaluationCandidate extends ResolutionScoreInput {
  id: string;
}

export interface RankedResolutionCandidate extends ResolutionEvaluationCandidate {
  score: number;
}

export type AutomaticResolutionReason =
  | "resolved"
  | "no_candidates"
  | "below_threshold"
  | "insufficient_lead"
  | "equal_authority_high_impact";

export interface AutomaticResolutionResult {
  canResolve: boolean;
  winnerId: string | null;
  reason: AutomaticResolutionReason;
  rankedCandidates: RankedResolutionCandidate[];
}

export interface AutomaticResolutionOptions {
  highImpact: boolean;
  threshold?: number;
  minimumLead?: number;
  equalAuthorityTolerance?: number;
}

export function evaluateAutomaticResolution(
  candidates: readonly ResolutionEvaluationCandidate[],
  options: AutomaticResolutionOptions,
): AutomaticResolutionResult {
  const threshold = options.threshold ?? AUTOMATIC_RESOLUTION_THRESHOLD;
  const minimumLead = options.minimumLead ?? AUTOMATIC_RESOLUTION_MINIMUM_LEAD;
  const equalAuthorityTolerance = options.equalAuthorityTolerance ?? 0.001;
  assertScore(threshold, "threshold");
  assertScore(minimumLead, "minimumLead");

  const rankedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      score: calculateResolutionScore(candidate),
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const winner = rankedCandidates[0];
  if (winner === undefined) {
    return { canResolve: false, winnerId: null, reason: "no_candidates", rankedCandidates };
  }

  if (winner.score < threshold) {
    return {
      canResolve: false,
      winnerId: null,
      reason: "below_threshold",
      rankedCandidates,
    };
  }

  const runnerUp = rankedCandidates[1];
  if (runnerUp !== undefined) {
    if (
      options.highImpact &&
      Math.abs(winner.authority - runnerUp.authority) <= equalAuthorityTolerance
    ) {
      return {
        canResolve: false,
        winnerId: null,
        reason: "equal_authority_high_impact",
        rankedCandidates,
      };
    }

    if (roundScore(winner.score - runnerUp.score) < minimumLead) {
      return {
        canResolve: false,
        winnerId: null,
        reason: "insufficient_lead",
        rankedCandidates,
      };
    }
  }

  return {
    canResolve: true,
    winnerId: winner.id,
    reason: "resolved",
    rankedCandidates,
  };
}

export interface GuardEvaluationInput {
  contextPack: ContextPack;
  extractedClaims: readonly Claim[];
  extractionSucceeded: boolean;
  now?: string | Date;
}

export interface GuardEvaluation {
  decision: GuardVerdict;
  reasons: GuardReason[];
  recommendedAction: RecommendedAction | null;
}

export function evaluateActionGuard(input: GuardEvaluationInput): GuardEvaluation {
  const pack = input.contextPack;
  const now = toTimestamp(input.now ?? new Date(), "now");

  for (const blocked of pack.blocked_claims) {
    const matchingClaim = input.extractedClaims.find((claim) =>
      claimMatchesPattern(claim, blocked.pattern),
    );
    if (matchingClaim !== undefined) {
      return {
        decision: "BLOCK",
        reasons: [
          {
            code: "blocked_claim",
            message: blocked.reason,
            policy_memory_id: blocked.policy_memory_id,
            claim: matchingClaim.text,
          },
        ],
        recommendedAction: pack.recommended_action,
      };
    }
  }

  for (const policy of pack.applicable_policies) {
    const matchingClaim = input.extractedClaims.find((claim) =>
      claimMatchesPattern(claim, policy.pattern),
    );
    if (matchingClaim === undefined) {
      continue;
    }

    if (policy.effect === "block") {
      return {
        decision: "BLOCK",
        reasons: [policyReason(policy, matchingClaim)],
        recommendedAction: pack.recommended_action,
      };
    }

    return {
      decision: "REQUIRE_APPROVAL",
      reasons: [
        {
          code: "blocking_policy",
          message: policy.policy,
          policy_memory_id: policy.memory_atom_id,
          claim: matchingClaim.text,
        },
      ],
      recommendedAction: pack.recommended_action,
    };
  }

  if (!input.extractionSucceeded) {
    return requireApproval("extraction_failed", "Proposed claims could not be validated.", pack);
  }

  if (pack.status === "invalidated" || pack.invalidated_at !== null) {
    return requireApproval("pack_invalidated", "The Context Pack was invalidated by newer truth.", pack);
  }

  if (pack.status === "expired" || now >= toTimestamp(pack.expires_at, "expires_at")) {
    return requireApproval("pack_expired", "The Context Pack has expired and must be rebuilt.", pack);
  }

  const highSeverityConflict = pack.known_conflicts.find(
    (conflict) =>
      (conflict.severity === "high" || conflict.severity === "critical") &&
      conflict.status !== "resolved" &&
      conflict.status !== "dismissed",
  );
  if (highSeverityConflict !== undefined || pack.status === "needs_review") {
    return requireApproval(
      "high_severity_conflict",
      highSeverityConflict?.summary ?? "This context requires human review.",
      pack,
    );
  }

  if (pack.confidence < GUARD_MINIMUM_CONFIDENCE) {
    return requireApproval(
      "low_confidence",
      `Context confidence ${pack.confidence.toFixed(2)} is below ${GUARD_MINIMUM_CONFIDENCE.toFixed(2)}.`,
      pack,
    );
  }

  const noncriticalConflict = pack.known_conflicts.find(
    (conflict) => conflict.status !== "resolved" && conflict.status !== "dismissed",
  );
  if (noncriticalConflict !== undefined || pack.status === "verified_with_warning") {
    return {
      decision: "ALLOW_WITH_WARNING",
      reasons: [
        {
          code: "noncritical_ambiguity",
          message: noncriticalConflict?.summary ?? "Context contains a noncritical ambiguity.",
          policy_memory_id: null,
          claim: null,
        },
      ],
      recommendedAction: pack.recommended_action,
    };
  }

  if (pack.confidence < GUARD_ALLOW_CONFIDENCE) {
    return {
      decision: "ALLOW_WITH_WARNING",
      reasons: [
        {
          code: "moderate_confidence",
          message: `Context confidence ${pack.confidence.toFixed(2)} is below ${GUARD_ALLOW_CONFIDENCE.toFixed(2)}.`,
          policy_memory_id: null,
          claim: null,
        },
      ],
      recommendedAction: pack.recommended_action,
    };
  }

  return {
    decision: "ALLOW",
    reasons: [
      {
        code: "verified",
        message: "The action is grounded in a fresh, verified Context Pack.",
        policy_memory_id: null,
        claim: null,
      },
    ],
    recommendedAction: null,
  };
}

export function claimMatchesPattern(claim: Claim, pattern: ClaimPattern): boolean {
  const subjectMatches = normalizeClaimPart(claim.subject) === normalizeClaimPart(pattern.subject);
  const predicateMatches =
    normalizeClaimPart(claim.predicate) === normalizeClaimPart(pattern.predicate);
  if (!subjectMatches || !predicateMatches) {
    return false;
  }

  const claimValue = normalizeClaimPart(claim.value);
  const patternValue = normalizeClaimPart(pattern.value);
  return pattern.match === "exact"
    ? claimValue === patternValue
    : claimValue.includes(patternValue);
}

export function normalizeClaimPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface TruthStateInput {
  activeRunCount: number;
  unresolvedHighConflictCount: number;
  failedRunCount: number;
  staleMemoryCount: number;
}

export function deriveTruthState(input: TruthStateInput): TruthState {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  }

  if (input.activeRunCount > 0) {
    return "updating";
  }

  if (input.unresolvedHighConflictCount > 0 || input.failedRunCount > 0) {
    return "needs_attention";
  }

  return "verified";
}

function policyReason(policy: ApplicablePolicy, claim: Claim): GuardReason {
  return {
    code: "blocking_policy",
    message: policy.policy,
    policy_memory_id: policy.memory_atom_id,
    claim: claim.text,
  };
}

function requireApproval(
  code: Extract<
    GuardReason["code"],
    | "extraction_failed"
    | "pack_expired"
    | "pack_invalidated"
    | "low_confidence"
    | "high_severity_conflict"
  >,
  message: string,
  pack: ContextPack,
): GuardEvaluation {
  return {
    decision: "REQUIRE_APPROVAL",
    reasons: [{ code, message, policy_memory_id: null, claim: null }],
    recommendedAction: pack.recommended_action,
  };
}

function assertScore(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite score between 0 and 1`);
  }
  return value;
}

function roundScore(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
}

function toTimestamp(value: string | Date, name: string): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new RangeError(`${name} must be a valid date`);
  }
  return timestamp;
}
