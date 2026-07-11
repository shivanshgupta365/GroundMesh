import { createHash } from "node:crypto";

import {
  CACHED_SSO_WORKFLOW_OUTPUT,
  SSO_FIXTURE_IDS,
  SSO_RESOLVED_CONFLICT,
  type CachedWorkflowOutput,
  type Conflict,
  type ContextPack,
  type HumanReview,
  type MemoryAtom,
  type RunEvent,
  type SourceEvent,
} from "@groundmesh/core";

/**
 * Produces stable UUIDs for a browser-session workspace without letting fixture
 * primary keys collide across isolated demo clones.
 */
export function scopedFixtureId(workspaceId: string, fixtureId: string): string {
  if (fixtureId === SSO_FIXTURE_IDS.workspace) return workspaceId;
  const bytes = Buffer.from(
    createHash("sha256").update(`groundmesh:${workspaceId}:${fixtureId}`).digest().subarray(0, 16),
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function collectFixtureIds(): string[] {
  const values: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        values.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(CACHED_SSO_WORKFLOW_OUTPUT);
  visit(SSO_RESOLVED_CONFLICT);
  visit(SSO_FIXTURE_IDS);
  return [...new Set(values)];
}

const FIXTURE_IDS = collectFixtureIds();

function remapValue(
  value: unknown,
  mapping: ReadonlyMap<string, string>,
): unknown {
  if (typeof value === "string") return mapping.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => remapValue(item, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        remapValue(item, mapping),
      ]),
    );
  }
  return value;
}

export interface FixtureScopeOverrides {
  sourceId?: string;
  runId?: string;
  receivedAt?: string;
}

export function fixtureIdMap(
  workspaceId: string,
  overrides: FixtureScopeOverrides = {},
): ReadonlyMap<string, string> {
  const mapping = new Map<string, string>(
    FIXTURE_IDS.map((fixtureId) => [fixtureId, scopedFixtureId(workspaceId, fixtureId)]),
  );
  mapping.set(SSO_FIXTURE_IDS.workspace, workspaceId);
  if (overrides.sourceId) mapping.set(SSO_FIXTURE_IDS.sources.founder, overrides.sourceId);
  if (overrides.runId) mapping.set(SSO_FIXTURE_IDS.founderRun, overrides.runId);
  return mapping;
}

export function scopeFixtureValue<T>(
  value: T,
  workspaceId: string,
  overrides: FixtureScopeOverrides = {},
): T {
  const scoped = remapValue(value, fixtureIdMap(workspaceId, overrides)) as T;
  if (!overrides.receivedAt) return scoped;
  return replaceFixtureTimes(scoped, overrides.receivedAt);
}

function replaceFixtureTimes<T>(value: T, anchor: string): T {
  const anchorMs = Date.parse(anchor);
  const fixtureAnchorMs = Date.parse("2026-07-11T09:30:01.000Z");
  const visit = (item: unknown): unknown => {
    if (typeof item === "string" && /^2026-07-11T09:3\d:/.test(item)) {
      const delta = Date.parse(item) - fixtureAnchorMs;
      return new Date(anchorMs + Math.max(0, delta)).toISOString();
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).map(([key, nested]) => [key, visit(nested)]),
      );
    }
    return item;
  };
  return visit(value) as T;
}

export function scopeCachedWorkflow(
  workspaceId: string,
  sourceId: string,
  runId: string,
  receivedAt = new Date().toISOString(),
): CachedWorkflowOutput {
  return scopeFixtureValue(CACHED_SSO_WORKFLOW_OUTPUT, workspaceId, {
    sourceId,
    runId,
    receivedAt,
  });
}

export function scopeSource(source: SourceEvent, workspaceId: string): SourceEvent {
  return scopeFixtureValue(source, workspaceId);
}

export function scopeMemory(memory: MemoryAtom, workspaceId: string): MemoryAtom {
  return scopeFixtureValue(memory, workspaceId);
}

export function scopeConflict(conflict: Conflict, workspaceId: string): Conflict {
  return scopeFixtureValue(conflict, workspaceId);
}

export function scopeContextPack(pack: ContextPack, workspaceId: string): ContextPack {
  return scopeFixtureValue(pack, workspaceId);
}

export function scopeRunEvent(event: RunEvent, workspaceId: string): RunEvent {
  return scopeFixtureValue(event, workspaceId);
}

export function scopeReview(review: HumanReview, workspaceId: string): HumanReview {
  return scopeFixtureValue(review, workspaceId);
}
