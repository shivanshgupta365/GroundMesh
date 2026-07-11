import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] font-sans antialiased p-8 sm:p-16 selection:bg-[var(--lime)] selection:text-black">
      <div className="max-w-3xl mx-auto space-y-12">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <header className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">GroundMesh Documentation</h1>
          <p className="text-lg text-[var(--text-secondary)]">Verified context for every human and agent.</p>
        </header>

        <section className="space-y-6">
          <h2 className="text-2xl font-medium tracking-tight">What is GroundMesh?</h2>
          <p className="leading-relaxed text-[var(--text-secondary)]">
            GroundMesh is a self-healing organizational context layer for companies that employ both humans and AI agents. It transforms fragmented company information into structured, source-backed Memory Atoms.
          </p>
          <p className="leading-relaxed text-[var(--text-secondary)]">
            Instead of simply providing a generic Retrieval-Augmented Generation (RAG) chatbot, GroundMesh acts as an orchestration engine. It detects stale or contradictory knowledge, verifies authoritative context, composes task-specific Context Packs, and prevents unsafe actions through a deterministic Action Guard.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-medium tracking-tight">How the Demo Works</h2>
          <p className="leading-relaxed text-[var(--text-secondary)]">
            The interactive demo simulates a critical scenario: an outdated "Enterprise SSO" commitment. 
          </p>
          <ol className="list-decimal list-inside space-y-4 text-[var(--text-secondary)] ml-4 marker:text-[var(--text)] marker:font-medium">
            <li><strong>Ingestion:</strong> A new Founder decision arrives: <em>"Enterprise SSO is delayed. Do not commit a date externally."</em></li>
            <li><strong>Maya (Extraction):</strong> The source text is broken down into structured "Memory Atoms".</li>
            <li><strong>Rook (Audit):</strong> Existing knowledge is challenged. An old CRM note saying "SSO launches next month" is flagged as a conflict.</li>
            <li><strong>Vera (Resolution):</strong> Vera ranks the evidence and establishes the Founder's decision as the authoritative truth, marking the CRM note as superseded.</li>
            <li><strong>Action Guard:</strong> When a support agent attempts to send the outdated "next month" promise to a customer, the deterministic guard blocks the action and offers a corrected safe reply.</li>
            <li><strong>Human Review:</strong> You, the human, can approve the corrected reply, writing the outcome back into the organizational memory for future use.</li>
          </ol>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-medium tracking-tight">Architecture</h2>
          <p className="leading-relaxed text-[var(--text-secondary)]">
            GroundMesh is built using a modern stack:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] ml-4 marker:text-[var(--text)]">
            <li><strong>Next.js 15 & React 19:</strong> For the web frontend and API routes.</li>
            <li><strong>Tailwind CSS 4 & shadcn/ui:</strong> For styling and accessible components.</li>
            <li><strong>Supabase (PostgreSQL & pgvector):</strong> For durable memory storage and semantic retrieval.</li>
            <li><strong>Google Gemini & Antigravity:</strong> For managed agent investigations, evidence resolution, and structured output normalization.</li>
          </ul>
        </section>

        <footer className="pt-8 border-t border-[var(--border)]">
          <Link 
            href="/demo"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--text)] px-8 text-sm font-medium text-[var(--background)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Start the Interactive Demo
          </Link>
        </footer>
      </div>
    </div>
  );
}
