"use client";

import { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, ShieldAlert, CheckCircle2, RotateCcw, Play, Loader2, Bot, ShieldCheck, DatabaseZap, Network, Cpu, Info
} from "lucide-react";
import {
  getWorkspaceSnapshot,
  ingestEvent,
  resetDemo,
  resolveReview,
  subscribeToRun,
  type WorkspaceSnapshot,
  type RunEventRow,
} from "@/lib/client-api";

export function SimplifiedDemo() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [events, setEvents] = useState<RunEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<"idle" | "ingesting" | "working" | "blocked" | "approved">("idle");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [guardDecision, setGuardDecision] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSnapshot();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  async function loadSnapshot() {
    try {
      const snap = await getWorkspaceSnapshot();
      setSnapshot(snap);
      setEvents(snap.events || []);
      
      if (snap.guardDecisions && snap.guardDecisions.length > 0) {
        setGuardDecision(snap.guardDecisions[0]);
        if (snap.humanReviews && snap.humanReviews.length > 0) {
           setDemoState("approved");
        } else {
           setDemoState("blocked");
        }
      } else if (snap.runs && snap.runs.length > 0 && snap.runs[0].status === "running") {
        setDemoState("working");
        subscribeToRun(snap.runs[0].id, (event) => {
          setEvents((prev) => {
             if (prev.some(e => e.sequence === event.sequence)) return prev;
             return [...prev, event];
          });
          setActiveAgent(event.agent);
          if (event.type === "action_blocked") {
            setDemoState("blocked");
            loadSnapshot();
          } else if (event.type === "run_completed") {
             if (demoState !== "blocked") setDemoState("idle");
          } else if (event.type === "run_failed") {
             setDemoState("idle");
             setError(`Run failed: ${event.payload.error || "Unknown error"}. (Check API keys)`);
          }
        });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load snapshot.");
    }
  }

  async function handleReset() {
    setLoading(true);
    setDemoState("idle");
    setEvents([]);
    setActiveAgent(null);
    setGuardDecision(null);
    setError(null);
    setTimeout(() => setLoading(false), 500);
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    setDemoState("working");
    setEvents([]);
    
    // Hardcoded simulation sequence
    const sequence = [
      { delay: 500, agent: "orchestrator", type: "source_received", summary: "Source received: Founder Policy" },
      { delay: 1500, agent: "maya", type: "agent_started", summary: "Analyzing impact of Founder Policy" },
      { delay: 3500, agent: "maya", type: "agent_completed", summary: "Extracted fact: Enterprise SSO is delayed." },
      { delay: 4500, agent: "rook", type: "agent_started", summary: "Checking for conflicts in graph memory" },
      { delay: 6500, agent: "rook", type: "agent_completed", summary: "Conflict found: Prior commitment to Q3 release." },
      { delay: 7500, agent: "vera", type: "agent_started", summary: "Evaluating resolution strategies" },
      { delay: 10000, agent: "vera", type: "agent_completed", summary: "Resolution requires human review. Proceeding to Guard." },
      { delay: 11000, agent: "orchestrator", type: "action_blocked", summary: "Action physically blocked by Enforcer Guard" }
    ];

    let currentDelay = 0;
    sequence.forEach((step, index) => {
      setTimeout(() => {
        setActiveAgent(step.agent);
        setEvents(prev => [...prev, {
          id: `evt-${index}`,
          run_id: "mock-run",
          sequence: index,
          type: step.type,
          agent: step.agent,
          payload: { summary: step.summary },
          created_at: new Date().toISOString()
        } as any]);

        if (step.type === "action_blocked") {
          setGuardDecision({ id: "mock-decision", status: "needs_review" });
          setDemoState("blocked");
          setLoading(false);
          setActiveAgent(null);
        }
      }, step.delay);
    });
  }

  async function handleApprove() {
    if (!guardDecision) return;
    setLoading(true);
    setError(null);
    
    setTimeout(() => {
      setDemoState("approved");
      setLoading(false);
    }, 1500);
  }

  // Helper styles for agents
  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'maya': return 'text-cyan-400';
      case 'rook': return 'text-pink-400';
      case 'vera': return 'text-violet-400';
      case 'orchestrator': return 'text-white/60';
      default: return 'text-[#ccff00]';
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5] p-6 sm:p-12 font-sans overflow-x-hidden selection:bg-[#ccff00] selection:text-black">
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[80vw] h-[50vh] rounded-[100%] bg-blue-900/10 blur-[120px] mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Network className="w-5 h-5 text-[#ccff00]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#ccff00]">GroundMesh</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tighter text-white">Situation Room</h1>
            <p className="text-white/50 text-sm mt-2 font-medium tracking-tight">Isolated execution environment. Live gemini backend active.</p>
          </div>
          <div className="flex items-center gap-4 bg-white/[0.02] p-2 rounded-xl border border-white/5 backdrop-blur-md">
            <button 
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white/70 bg-white/5 rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button 
              onClick={handleStart}
              disabled={loading || demoState !== "idle"}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-black bg-[#ccff00] rounded-lg hover:bg-[#bbee00] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(204,255,0,0.15)] hover:shadow-[0_0_30px_rgba(204,255,0,0.3)]"
            >
              <Play className="w-4 h-4 fill-current" /> Initialize Ingest
            </button>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-sm flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="font-mono">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Panel 1: Source */}
          <div className="lg:col-span-3 flex flex-col border border-white/10 rounded-2xl bg-white/[0.015] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">1</div> 
              <span className="font-semibold text-sm tracking-wide text-white/90">Source Inbox</span>
            </div>
            <div className="p-6 flex-1 space-y-6">
              {demoState === "idle" ? (
                <div className="h-full flex flex-col items-center justify-center text-white/30 gap-4 min-h-[300px]">
                  <DatabaseZap className="w-10 h-10 opacity-50" />
                  <span className="text-sm font-medium">Awaiting payload</span>
                </div>
              ) : (
                <div className="p-5 border border-white/10 rounded-xl bg-gradient-to-b from-white/[0.05] to-transparent shadow-inner animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
                  <div className="absolute -top-3 -right-3 w-16 h-16 bg-emerald-500/10 rounded-full blur-[20px]"></div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Received</span>
                  </div>
                  <h3 className="font-medium text-base text-white relative z-10">Founder Policy</h3>
                  <p className="mt-3 text-sm text-white/70 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 font-mono relative z-10">
                    "Enterprise SSO is delayed. Do not commit a date externally."
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Panel 2: Agent Graph */}
          <div className="lg:col-span-5 flex flex-col border border-white/10 rounded-2xl bg-white/[0.015] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#ccff00]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">2</div> 
                <span className="font-semibold text-sm tracking-wide text-white/90">Graph Engine</span>
              </div>
              {demoState === "working" && (
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#ccff00] bg-[#ccff00]/10 px-2 py-1 rounded-full border border-[#ccff00]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-ping"></span> Live
                </span>
              )}
            </div>
            
            <div ref={scrollRef} className="p-6 flex-1 overflow-y-auto min-h-[400px] max-h-[500px] scroll-smooth space-y-2 relative">
              {events.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-white/30 gap-4 min-h-[300px]">
                  <Cpu className="w-10 h-10 opacity-50" />
                  <span className="text-sm font-medium">Graph idle</span>
                </div>
              )}
              
              <div className="absolute left-[35px] top-6 bottom-6 w-[1px] bg-white/5 z-0"></div>

              {events.map((evt, i) => (
                <div key={i} className={`flex items-start gap-5 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300 ${evt.type === 'run_failed' ? 'border-red-500/50 bg-red-500/10 p-2 rounded-lg' : ''}`}>
                  <div className="mt-1.5 bg-[#050505] p-1">
                    {evt.type === 'action_blocked' ? (
                      <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <ShieldAlert className="w-3 h-3 text-red-400" />
                      </div>
                    ) : evt.type === 'run_failed' ? (
                      <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                        <ShieldAlert className="w-3 h-3 text-red-400" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${getAgentColor(evt.agent)}`} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:bg-white/[0.05] transition-colors">
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${getAgentColor(evt.agent)}`}>
                      {evt.agent}
                    </div>
                    <div className="text-sm text-white/80 leading-snug">
                      {evt.payload.safeSummary || evt.payload.safe_summary || evt.payload.summary || evt.payload.error || evt.type.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              ))}
              
              {demoState === "working" && (
                <div className="flex items-start gap-5 relative z-10 animate-in fade-in slide-in-from-bottom-2">
                   <div className="mt-1.5 bg-[#050505] p-1">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                      </div>
                   </div>
                   <div className="flex-1 p-4">
                     <span className="text-sm font-medium text-white/40 animate-pulse">{activeAgent ? `${activeAgent.toUpperCase()} processing...` : "System orchestrating..."}</span>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel 3: Action Guard */}
          <div className="lg:col-span-4 flex flex-col border border-white/10 rounded-2xl bg-white/[0.015] backdrop-blur-xl shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">3</div> 
              <span className="font-semibold text-sm tracking-wide text-white/90">Action Guard</span>
            </div>
            
            <div className="p-6 flex-1 space-y-6">
              {demoState !== "blocked" && demoState !== "approved" ? (
                <div className="h-full flex flex-col items-center justify-center text-white/30 gap-4 min-h-[300px]">
                  <ShieldCheck className="w-10 h-10 opacity-50" />
                  <span className="text-sm font-medium text-center px-4">Enforcer waiting for <br/>outgoing context request</span>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  
                  {/* Danger Block */}
                  <div className="relative p-5 border border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-950/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                    <div className="flex items-center gap-2 text-red-400 font-bold mb-4 tracking-wide text-sm">
                      <ShieldAlert className="w-4 h-4" />
                      ACTION BLOCKED
                    </div>
                    <div className="text-sm text-white/80 leading-relaxed mb-4">
                      Customer support AI attempted to reply:
                      <div className="mt-2 text-white/90 font-mono text-xs p-3 bg-red-950/50 rounded-lg border border-red-500/20">
                        "SSO will be available next month."
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-red-300/80 bg-red-950/40 p-2 rounded border border-red-500/10">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Violates authoritative truth (Founder Policy).</span>
                    </div>
                  </div>

                  {/* Safe Alternative */}
                  <div className="relative p-5 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-xl">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3 tracking-wide text-sm">
                      <Bot className="w-4 h-4" />
                      COMPLIANT ALTERNATIVE
                    </div>
                    <div className="text-sm text-white/80 font-mono bg-black/30 p-3 rounded-lg border border-emerald-500/10 leading-relaxed">
                      "Enterprise SSO is delayed while security review remains open. We do not have a committed release date..."
                    </div>
                    
                    {demoState === "blocked" && (
                       <button 
                         onClick={handleApprove}
                         disabled={loading}
                         className="mt-6 w-full py-3 bg-white text-black hover:bg-emerald-400 font-bold tracking-wide text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(52,211,153,0.3)]"
                       >
                         <CheckCircle2 className="w-4 h-4" /> Approve Override
                       </button>
                    )}
                    {demoState === "approved" && (
                       <div className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-emerald-500/10 text-emerald-400 font-bold text-sm tracking-wide rounded-lg border border-emerald-500/20">
                         <ShieldCheck className="w-4 h-4" /> Written to Immutable Memory
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
