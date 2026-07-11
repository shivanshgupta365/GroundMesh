import { describe, expect, it } from "vitest";
import {
  AUTHORITY_SCORES,
  CANONICAL_SSO_CONTEXT_PACK,
  CANONICAL_UNSAFE_CLAIM,
  calculateFreshnessScore,
  calculateResolutionScore,
  deriveTruthState,
  evaluateActionGuard,
  evaluateAutomaticResolution,
  freshnessTtlDaysFor,
  type ContextPack,
} from "../src";

describe("authority and freshness policies", () => {
  it("uses the locked authority ladder", () => {
    expect(AUTHORITY_SCORES).toEqual({
      founder_decision: 1,
      approved_policy: 0.9,
      product_owner_update: 0.8,
      implementation_evidence: 0.75,
      crm_note: 0.55,
      support_macro: 0.45,
      agent_inference: 0.25,
    });
  });

  it("selects deterministic TTLs by memory category", () => {
    expect(freshnessTtlDaysFor("policy", "founder_decision")).toBe(365);
    expect(freshnessTtlDaysFor("commitment", "crm_note")).toBe(90);
    expect(freshnessTtlDaysFor("fact", "implementation_evidence")).toBe(120);
    expect(freshnessTtlDaysFor("customer_context", "support_macro")).toBe(180);
  });

  it("decays freshness linearly and zeros superseded or expired memories", () => {
    const base = {
      memoryType: "commitment" as const,
      authorityRole: "crm_note" as const,
      sourceTimestamp: "2026-01-01T00:00:00.000Z",
      status: "active" as const,
    };

    expect(calculateFreshnessScore({ ...base, asOf: "2026-01-01T00:00:00.000Z" })).toBe(1);
    expect(calculateFreshnessScore({ ...base, asOf: "2026-02-15T00:00:00.000Z" })).toBe(0.5);
    expect(calculateFreshnessScore({ ...base, asOf: "2026-04-01T00:00:00.000Z" })).toBe(0);
    expect(
      calculateFreshnessScore({
        ...base,
        status: "superseded",
        asOf: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(0);
  });
});

describe("resolution policy", () => {
  it("uses the locked 50/25/15/10 score", () => {
    expect(
      calculateResolutionScore({
        authority: 1,
        freshness: 0.96,
        directness: 0.9,
        corroboration: 0.65,
      }),
    ).toBe(0.94);
  });

  it("auto-resolves only above threshold with the required lead", () => {
    const result = evaluateAutomaticResolution(
      [
        { id: "founder", authority: 1, freshness: 0.96, directness: 0.9, corroboration: 0.65 },
        { id: "crm", authority: 0.55, freshness: 0.65, directness: 0.85, corroboration: 0.2 },
      ],
      { highImpact: true },
    );

    expect(result.canResolve).toBe(true);
    expect(result.winnerId).toBe("founder");
  });

  it("escalates equal-authority high-impact ambiguity", () => {
    const result = evaluateAutomaticResolution(
      [
        { id: "a", authority: 0.9, freshness: 1, directness: 1, corroboration: 0.8 },
        { id: "b", authority: 0.9, freshness: 0.98, directness: 1, corroboration: 0.8 },
      ],
      { highImpact: true },
    );

    expect(result).toMatchObject({
      canResolve: false,
      winnerId: null,
      reason: "equal_authority_high_impact",
    });
  });
});

describe("deterministic Action Guard", () => {
  it("returns BLOCK before any lower-priority confidence checks", () => {
    const result = evaluateActionGuard({
      contextPack: { ...CANONICAL_SSO_CONTEXT_PACK, confidence: 0.5 },
      extractedClaims: [CANONICAL_UNSAFE_CLAIM],
      extractionSucceeded: true,
      now: "2026-07-11T09:45:00.000Z",
    });

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0]?.code).toBe("blocked_claim");
  });

  it("returns REQUIRE_APPROVAL for extraction failure, expiry, and low confidence", () => {
    const noClaims = { extractedClaims: [], now: "2026-07-11T09:45:00.000Z" } as const;
    expect(
      evaluateActionGuard({
        contextPack: CANONICAL_SSO_CONTEXT_PACK,
        extractionSucceeded: false,
        ...noClaims,
      }).decision,
    ).toBe("REQUIRE_APPROVAL");
    expect(
      evaluateActionGuard({
        contextPack: CANONICAL_SSO_CONTEXT_PACK,
        extractionSucceeded: true,
        extractedClaims: [],
        now: "2026-07-11T10:30:15.000Z",
      }).decision,
    ).toBe("REQUIRE_APPROVAL");
    expect(
      evaluateActionGuard({
        contextPack: { ...CANONICAL_SSO_CONTEXT_PACK, confidence: 0.74 },
        extractionSucceeded: true,
        ...noClaims,
      }).decision,
    ).toBe("REQUIRE_APPROVAL");
  });

  it("returns warning for confidence 0.75-0.899 and allow from 0.90", () => {
    const packAt = (confidence: number): ContextPack => ({
      ...CANONICAL_SSO_CONTEXT_PACK,
      confidence,
    });
    const common = {
      extractedClaims: [],
      extractionSucceeded: true,
      now: "2026-07-11T09:45:00.000Z",
    } as const;

    expect(evaluateActionGuard({ contextPack: packAt(0.75), ...common }).decision).toBe(
      "ALLOW_WITH_WARNING",
    );
    expect(evaluateActionGuard({ contextPack: packAt(0.899), ...common }).decision).toBe(
      "ALLOW_WITH_WARNING",
    );
    expect(evaluateActionGuard({ contextPack: packAt(0.9), ...common }).decision).toBe("ALLOW");
  });
});

describe("truth state", () => {
  it("prioritizes updating, then attention, then verified", () => {
    expect(
      deriveTruthState({
        activeRunCount: 1,
        unresolvedHighConflictCount: 2,
        failedRunCount: 1,
        staleMemoryCount: 3,
      }),
    ).toBe("updating");
    expect(
      deriveTruthState({
        activeRunCount: 0,
        unresolvedHighConflictCount: 1,
        failedRunCount: 0,
        staleMemoryCount: 3,
      }),
    ).toBe("needs_attention");
    expect(
      deriveTruthState({
        activeRunCount: 0,
        unresolvedHighConflictCount: 0,
        failedRunCount: 0,
        staleMemoryCount: 3,
      }),
    ).toBe("verified");
  });
});
