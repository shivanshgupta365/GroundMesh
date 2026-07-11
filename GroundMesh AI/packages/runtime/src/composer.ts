import { randomUUID } from "node:crypto";

import {
  CONTEXT_PACK_TTL_MS,
  CONTRACT_VERSION,
  ContextPackSchema,
  type Conflict,
  type ContextPack,
  type ContextPackRequest,
  type MemoryAtom,
  type SourceEvent,
} from "@groundmesh/core";

function normalizedTerms(values: Array<string | null>): string[] {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter((value) => value.length > 2);
}

function relevance(memory: MemoryAtom, terms: string[]): number {
  if (terms.length === 0) return 1;
  const haystack = [
    memory.subject,
    memory.predicate,
    memory.object_value,
    memory.claim,
    ...memory.entities,
    ...memory.applies_to,
  ]
    .join(" ")
    .toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export interface ComposeContextInput {
  workspaceId: string;
  request: ContextPackRequest;
  memories: MemoryAtom[];
  sources: SourceEvent[];
  conflicts: Conflict[];
  now?: Date;
}

export function composeContextPack(input: ComposeContextInput): ContextPack {
  const now = input.now ?? new Date();
  const terms = normalizedTerms([
    input.request.scope.customer,
    input.request.scope.project,
    input.request.scope.topic,
    input.request.task,
  ]);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const ranked = input.memories
    .filter((memory) => memory.status === "active")
    .map((memory) => ({ memory, relevance: relevance(memory, terms) }))
    .filter(({ relevance: score }) => score > 0)
    .sort(
      (left, right) =>
        right.relevance - left.relevance ||
        right.memory.authority_score - left.memory.authority_score ||
        right.memory.freshness_score - left.memory.freshness_score,
    )
    .slice(0, 12);

  const citationFor = (memory: MemoryAtom) => {
    const source = sourceById.get(memory.source_event_id);
    return {
      source_event_id: memory.source_event_id,
      memory_atom_id: memory.id,
      label: source?.title ?? `${memory.authority_role.replaceAll("_", " ")} source`,
      excerpt: source?.content.slice(0, 280) ?? memory.claim,
      source_timestamp: memory.source_timestamp,
    };
  };

  const policies = ranked.filter(({ memory }) => memory.memory_type === "policy");
  const facts = ranked.filter(({ memory }) => memory.memory_type !== "policy");
  const relevantMemoryIds = new Set(ranked.map(({ memory }) => memory.id));
  const relevantConflicts = input.conflicts.filter((conflict) =>
    conflict.memory_atom_ids.some((id) => relevantMemoryIds.has(id)),
  );
  const unresolvedHigh = relevantConflicts.some(
    (conflict) =>
      (conflict.severity === "high" || conflict.severity === "critical") &&
      (conflict.status === "open" || conflict.status === "needs_review"),
  );
  const confidence = ranked.length
    ? Math.min(
        0.99,
        ranked.reduce(
          (sum, item) =>
            sum +
            item.memory.confidence_score * 0.5 +
            item.memory.authority_score * 0.3 +
            item.memory.freshness_score * 0.2,
          0,
        ) / ranked.length,
      )
    : 0;

  const citations = ranked.map(({ memory }) => citationFor(memory));
  const recommendedMessage = policies.length
    ? "Share the verified status without promising an unapproved date."
    : "Use only the verified evidence in this Context Pack.";

  return ContextPackSchema.parse({
    schema_version: CONTRACT_VERSION,
    id: randomUUID(),
    workspace_id: input.workspaceId,
    status: unresolvedHigh || ranked.length === 0 ? "needs_review" : confidence >= 0.9 ? "verified" : "verified_with_warning",
    requesting_agent: input.request.requesting_agent,
    task: input.request.task,
    scope: input.request.scope,
    verified_facts: facts.slice(0, 8).map(({ memory }) => ({
      memory_atom_id: memory.id,
      claim: memory.claim,
      confidence: memory.confidence_score,
      citations: [citationFor(memory)],
    })),
    applicable_policies: policies.map(({ memory }) => ({
      memory_atom_id: memory.id,
      policy: memory.claim,
      effect: memory.object_value.toLowerCase().includes("prohibited") ? "block" : "require_approval",
      pattern: {
        subject: memory.subject,
        predicate: memory.predicate.replace(/^external_/, "").replace(/_prohibition$/, ""),
        value: "next month",
        match: "exact",
      },
      citations: [citationFor(memory)],
    })),
    known_conflicts: relevantConflicts.map((conflict) => ({
      conflict_id: conflict.id,
      summary: conflict.explanation,
      severity: conflict.severity,
      status: conflict.status,
    })),
    blocked_claims: policies
      .filter(({ memory }) => memory.object_value.toLowerCase().includes("prohibited"))
      .map(({ memory }) => ({
        claim: `${memory.subject} will launch next month.`,
        reason: memory.claim,
        pattern: {
          subject: memory.subject,
          predicate: memory.predicate.replace(/^external_/, "").replace(/_prohibition$/, ""),
          value: "next month",
          match: "exact",
        },
        policy_memory_id: memory.id,
        citations: [citationFor(memory)],
      })),
    recommended_action: { type: "evidence_safe_reply", message: recommendedMessage },
    citations: citations.length
      ? citations
      : [
          {
            source_event_id: input.sources[0]?.id ?? randomUUID(),
            memory_atom_id: null,
            label: "No verified evidence",
            excerpt: "No matching active organizational memory was found.",
            source_timestamp: input.sources[0]?.source_timestamp ?? now.toISOString(),
          },
        ],
    confidence,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CONTEXT_PACK_TTL_MS).toISOString(),
    invalidated_at: null,
  });
}
