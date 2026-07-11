import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--ink)] p-4" aria-busy="true" aria-label="Loading GroundMesh Situation Room">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex h-16 items-center justify-between border-b border-[var(--line)]">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-3 py-3 lg:grid-cols-[280px_minmax(0,1fr)_290px]">
          <Skeleton className="h-[720px]" />
          <div className="space-y-3">
            <Skeleton className="h-[470px]" />
            <Skeleton className="h-[238px]" />
          </div>
          <Skeleton className="h-[720px]" />
        </div>
      </div>
    </main>
  );
}
