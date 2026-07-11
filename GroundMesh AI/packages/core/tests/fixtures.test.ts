import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_SSO_FIXTURE_HASH,
  CANONICAL_SSO_FIXTURE_IDENTITY,
  CANONICAL_SSO_INGEST_REQUEST,
  CACHED_SSO_WORKFLOW_OUTPUT,
  CachedWorkflowOutputSchema,
  SSO_SEED_MEMORY_ATOMS,
  SSO_SEED_SOURCES,
  canonicalizeIngestEvent,
  getCachedSsoWorkflowOutput,
  isCanonicalSsoFixture,
} from "../src";

describe("canonical SSO fixture", () => {
  it("contains the four seeded source systems required by the demo", () => {
    expect(SSO_SEED_SOURCES.map((source) => source.source_type)).toEqual([
      "product_roadmap",
      "sales_crm_note",
      "github_issue",
      "support_macro",
    ]);
    expect(SSO_SEED_MEMORY_ATOMS).toHaveLength(4);
  });

  it("publishes a stable SHA-256 identity for exact cache gating", () => {
    expect(canonicalizeIngestEvent(CANONICAL_SSO_INGEST_REQUEST)).toBe(
      CANONICAL_SSO_FIXTURE_IDENTITY,
    );
    expect(createHash("sha256").update(CANONICAL_SSO_FIXTURE_IDENTITY).digest("hex")).toBe(
      CANONICAL_SSO_FIXTURE_HASH,
    );
  });

  it("normalizes harmless whitespace and entity ordering but rejects changed source meaning", () => {
    expect(
      isCanonicalSsoFixture({
        ...CANONICAL_SSO_INGEST_REQUEST,
        content: "  Enterprise SSO is delayed.   Do not commit a date externally. ",
        linked_entities: ["Enterprise SSO", "Acme"],
      }),
    ).toBe(true);
    expect(
      isCanonicalSsoFixture({
        ...CANONICAL_SSO_INGEST_REQUEST,
        content: "Enterprise SSO will launch next month.",
      }),
    ).toBe(false);
  });

  it("returns cached output only for the exact fixture hash", () => {
    expect(getCachedSsoWorkflowOutput("0".repeat(64))).toBeNull();
    const cached = getCachedSsoWorkflowOutput(CANONICAL_SSO_FIXTURE_HASH);
    expect(cached).not.toBeNull();
    expect(cached?.execution_mode).toBe("cached_demo");
    expect(cached?.run_events.every((event) => event.execution_mode === "cached_demo")).toBe(true);
    expect(CachedWorkflowOutputSchema.safeParse(CACHED_SSO_WORKFLOW_OUTPUT).success).toBe(true);
  });

  it("keeps the three specialist outputs distinct and source-backed", () => {
    expect(CACHED_SSO_WORKFLOW_OUTPUT.maya_report.agent).toBe("maya");
    expect(CACHED_SSO_WORKFLOW_OUTPUT.rook_report.agent).toBe("rook");
    expect(CACHED_SSO_WORKFLOW_OUTPUT.vera_report.agent).toBe("vera");
    expect(CACHED_SSO_WORKFLOW_OUTPUT.maya_report.candidates).toHaveLength(2);
    expect(CACHED_SSO_WORKFLOW_OUTPUT.rook_report.conflicts[0]?.severity).toBe("high");
    expect(CACHED_SSO_WORKFLOW_OUTPUT.vera_report.resolution_confidence).toBe(0.94);
    expect(CACHED_SSO_WORKFLOW_OUTPUT.context_pack.citations).toHaveLength(3);
  });
});
