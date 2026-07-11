import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CANONICAL_SSO_INGEST_REQUEST } from "@groundmesh/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabase, getStore } from "../src/index";

const workspaceId = "11111111-1111-4111-8111-111111111111";

describe("GroundMeshStore", () => {
  beforeAll(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "groundmesh-runtime-test-"));
    process.env.GROUNDMESH_DB_PATH = path.join(dir, "db");
    await closeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("resets an isolated workspace with canonical fixture data", async () => {
    const store = await getStore();
    const snapshot = await store.resetWorkspace(workspaceId, { seed: true });

    expect(snapshot.sources).toHaveLength(4);
    expect(snapshot.memories).toHaveLength(4);
    expect(snapshot.runs).toHaveLength(1);
    expect(snapshot.workspace.truthStatus).toBe("verified");
  }, 15_000);

  it("ingests idempotently and appends ordered events", async () => {
    const store = await getStore();
    const first = await store.ingestSource(workspaceId, CANONICAL_SSO_INGEST_REQUEST, "idem-test");
    const second = await store.ingestSource(workspaceId, CANONICAL_SSO_INGEST_REQUEST, "idem-test");

    expect(second.deduplicated).toBe(true);
    expect(second.run.id).toBe(first.run.id);

    await store.appendRunEvent(workspaceId, first.run.id, {
      event_type: "agent_started",
      agent: "maya",
      safe_summary: "Maya started.",
      payload: { agent: "maya" },
    });
    const events = await store.listRunEvents(workspaceId, first.run.id);

    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(events[1]?.event_type).toBe("agent_started");
  });
});
