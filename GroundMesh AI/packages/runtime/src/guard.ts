import { randomUUID } from "node:crypto";

import {
  CONTRACT_VERSION,
  GuardDecisionSchema,
  HumanReviewSchema,
  evaluateActionGuard,
  type Claim,
  type ContextPack,
  type GuardDecision,
  type HumanReview,
  type ProposedAction,
} from "@groundmesh/core";

export function extractActionClaims(action: ProposedAction): Claim[] {
  const content = action.content.trim();
  if (!content) return [];
  const lower = content.toLowerCase();
  const subject = /sso/.test(lower) ? "Enterprise SSO" : action.audience;
  const releaseValue = lower.includes("next month")
    ? "next month"
    : lower.match(/\bq[1-4]\b/i)?.[0]?.toUpperCase();
  if (releaseValue) {
    return [
      {
        subject,
        predicate: "release_date_commitment",
        value: releaseValue,
        text: content,
        confidence: lower.includes("will") ? 0.98 : 0.86,
      },
    ];
  }
  return [
    {
      subject,
      predicate: action.type,
      value: content,
      text: content,
      confidence: 0.82,
    },
  ];
}

export interface GuardBuildResult {
  decision: GuardDecision;
  review: HumanReview | null;
}

export function buildGuardDecision(input: {
  workspaceId: string;
  contextPack: ContextPack;
  proposedAction: ProposedAction;
  now?: Date;
}): GuardBuildResult {
  const now = input.now ?? new Date();
  const extractedClaims = extractActionClaims(input.proposedAction);
  const evaluation = evaluateActionGuard({
    contextPack: input.contextPack,
    extractedClaims,
    extractionSucceeded: extractedClaims.length > 0,
    now,
  });
  const decisionId = randomUUID();
  const needsReview = evaluation.decision === "BLOCK" || evaluation.decision === "REQUIRE_APPROVAL";
  const reviewId = needsReview ? randomUUID() : null;
  const review = needsReview
    ? HumanReviewSchema.parse({
        schema_version: CONTRACT_VERSION,
        id: reviewId,
        workspace_id: input.workspaceId,
        subject_type: evaluation.decision === "BLOCK" ? "correction" : "guard_decision",
        subject_id: decisionId,
        status: "pending",
        reviewer: null,
        proposed_content:
          evaluation.recommendedAction?.message ?? input.contextPack.recommended_action.message,
        resolved_content: null,
        rationale: null,
        created_memory_id: null,
        created_at: now.toISOString(),
        resolved_at: null,
      })
    : null;

  const decision = GuardDecisionSchema.parse({
    schema_version: CONTRACT_VERSION,
    id: decisionId,
    workspace_id: input.workspaceId,
    context_pack_id: input.contextPack.id,
    proposed_action: input.proposedAction,
    extracted_claims: extractedClaims,
    decision: evaluation.decision,
    reasons: evaluation.reasons,
    recommended_action: evaluation.recommendedAction,
    review_id: reviewId,
    created_at: now.toISOString(),
  });
  return { decision, review };
}
