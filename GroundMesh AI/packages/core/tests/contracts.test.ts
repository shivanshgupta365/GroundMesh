import { describe, expect, it } from "vitest";
import {
  ActionCheckRequestSchema,
  CANONICAL_SSO_CONTEXT_PACK,
  CANONICAL_SSO_FOUNDER_SOURCE,
  CANONICAL_SSO_INGEST_REQUEST,
  CACHED_SSO_CORRECTION_REVIEW,
  CACHED_SSO_RUN_EVENTS,
  ContextPackSchema,
  IngestEventRequestSchema,
  MemoryAtomSchema,
  ReviewResolutionRequestSchema,
  RunEventSchema,
  SSO_RESOLVED_MEMORY_ATOMS,
  SourceEventSchema,
} from "../src";

describe("domain contracts", () => {
  it("validates source provenance with separate source and receipt timestamps", () => {
    const source = SourceEventSchema.parse(CANONICAL_SSO_FOUNDER_SOURCE);

    expect(source.source_timestamp).toBe("2026-07-11T09:30:00.000Z");
    expect(source.received_at).toBe("2026-07-11T09:30:01.000Z");
    expect(source.authority_role).toBe("founder_decision");
  });

  it("does not accept public numeric authority overrides", () => {
    expect(
      IngestEventRequestSchema.safeParse({
        ...CANONICAL_SSO_INGEST_REQUEST,
        authority_score: 1,
      }).success,
    ).toBe(false);
  });

  it("enforces bounded memory scores and embedding metadata", () => {
    const memory = SSO_RESOLVED_MEMORY_ATOMS[0];
    expect(memory).toBeDefined();
    expect(MemoryAtomSchema.safeParse(memory).success).toBe(true);
    expect(
      MemoryAtomSchema.safeParse({ ...memory, confidence_score: 1.01 }).success,
    ).toBe(false);
    expect(memory?.embedding).toEqual({ model: "gemini-embedding-2", dimensions: 768 });
  });

  it("keeps proposed actions out of Context Pack requests and records them at the guard", () => {
    expect(
      ContextPackSchema.safeParse({
        ...CANONICAL_SSO_CONTEXT_PACK,
        proposed_action: "Promise next month",
      }).success,
    ).toBe(false);

    expect(
      ActionCheckRequestSchema.safeParse({
        context_pack_id: CANONICAL_SSO_CONTEXT_PACK.id,
        proposed_action: {
          type: "customer_reply",
          content: "No committed date is available.",
          audience: "Acme",
          impact: "high",
          simulated: true,
        },
      }).success,
    ).toBe(true);
  });

  it("requires approved and edited reviews to provide resolved content", () => {
    expect(
      ReviewResolutionRequestSchema.safeParse({
        decision: "approve",
        content: null,
        rationale: "Evidence is sufficient.",
        reviewer: "Reviewer",
      }).success,
    ).toBe(false);
    expect(CACHED_SSO_CORRECTION_REVIEW.status).toBe("approved");
    expect(CACHED_SSO_CORRECTION_REVIEW.created_memory_id).not.toBeNull();
  });

  it("rejects private-reasoning fields from safe run payloads, including nested fields", () => {
    const event = CACHED_SSO_RUN_EVENTS[0];
    expect(event).toBeDefined();
    expect(
      RunEventSchema.safeParse({
        ...event,
        payload: { output: { chain_of_thought: "private" } },
      }).success,
    ).toBe(false);
  });
});
