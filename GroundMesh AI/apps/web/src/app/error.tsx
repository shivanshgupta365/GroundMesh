"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/primitives";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GroundMesh route error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--ink)] p-6">
      <section className="w-full max-w-md rounded-2xl border border-[var(--line-strong)] bg-[var(--panel-solid)] p-7">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime-soft)]">GroundMesh · safe failure</span>
        <TriangleAlert className="mt-12 size-7 text-[var(--red-soft)]" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold tracking-[-0.035em]">This surface stopped safely.</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          No source or action was lost. Reconnect to the persisted workspace and replay the latest run.
        </p>
        {error.digest && <p className="mt-3 font-mono text-[9px] text-[var(--text-tertiary)]">Reference {error.digest}</p>}
        <Button className="mt-6" variant="secondary" onClick={reset}>
          <RefreshCw className="size-4" /> Reconnect
        </Button>
      </section>
    </main>
  );
}
