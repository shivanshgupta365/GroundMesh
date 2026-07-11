import { describe, expect, it } from "vitest";

import { clientEvent } from "./runtime-api";

describe("clientEvent", () => {
  it("normalizes persisted run events for the UI", () => {
    expect(
      clientEvent({
        schema_version: "1.0",
        id: "90000000-0000-4000-8000-000000000001",
        workspace_id: "10000000-0000-4000-8000-000000000001",
        run_id: "20000000-0000-4000-8000-000000000001",
        sequence: 1,
        event_type: "source_received",
        occurred_at: "2026-07-11T09:30:00.000Z",
        execution_mode: "cached_demo",
        agent: "orchestrator",
        safe_summary: "Source accepted.",
        payload: {},
      }),
    ).toMatchObject({
      type: "source_received",
      eventType: "source_received",
      createdAt: "2026-07-11T09:30:00.000Z",
      runId: "20000000-0000-4000-8000-000000000001",
    });
  });
});
