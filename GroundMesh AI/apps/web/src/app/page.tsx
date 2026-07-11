"use client";

import Link from "next/link";
import { ArrowRight, FileText, Play, ShieldAlert, CheckCircle2, Loader2, DatabaseZap, Network, ShieldCheck, Sparkles, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050505] text-[#f5f5f5] overflow-hidden font-sans selection:bg-[#ccff00] selection:text-black">
      {/* Interactive Cursor Glow */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        animate={{
          background: `radial-gradient(circle 600px at ${mousePos.x}px ${mousePos.y}px, rgba(204,255,0,0.06), transparent 80%)`,
        }}
      />

      {/* Dynamic Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-r from-violet-900/10 to-blue-900/10 blur-[150px] mix-blend-screen animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-r from-emerald-900/10 to-[#ccff00]/10 blur-[150px] mix-blend-screen animate-[pulse_12s_ease-in-out_infinite_alternate]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full"
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowDemo(false)}>
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ccff00]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Network className="w-5 h-5 text-[#ccff00] relative z-10" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">GroundMesh</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/docs" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <FileText className="w-4 h-4" /> Documentation
          </Link>
          <button 
            onClick={() => setShowDemo(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all backdrop-blur-md text-white"
          >
            <Play className="w-4 h-4" /> Live Demo
          </button>
        </div>
      </motion.nav>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 max-w-6xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!showDemo ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -50, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="text-center w-full flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/5 backdrop-blur-xl shadow-[0_0_30px_rgba(204,255,0,0.1)]">
                <Sparkles className="w-4 h-4 text-[#ccff00]" />
                <span className="text-xs font-bold tracking-widest uppercase text-[#ccff00]">GroundMesh AI Platform</span>
              </div>

              <h1 className="text-6xl sm:text-7xl lg:text-[6rem] font-black tracking-tighter leading-[1.1] drop-shadow-2xl">
                Context that heals <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/30">itself in real-time.</span>
              </h1>
              
              <p className="max-w-2xl mt-8 text-lg sm:text-2xl font-medium leading-relaxed text-white/50 tracking-tight">
                The deterministic reality layer for autonomous agents. Transform fragmented data into structured memory and physically block unsafe actions.
              </p>

              <div className="flex items-center gap-5 mt-12">
                <button
                  onClick={() => setShowDemo(true)}
                  className="group relative inline-flex h-16 items-center justify-center gap-3 rounded-full bg-[#ccff00] px-10 text-lg font-bold text-black shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:shadow-[0_0_60px_rgba(204,255,0,0.4)] transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/30 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300" />
                  <span className="relative z-10">Experience the Demo</span>
                  <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-2" />
                </button>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full text-left">
                {[
                  { icon: BrainCircuit, title: "Self-Healing Memory", desc: "Agents constantly audit and resolve conflicting facts." },
                  { icon: DatabaseZap, title: "Graph Engine", desc: "Data is stored as a deterministic graph of proven claims." },
                  { icon: ShieldCheck, title: "Action Guard", desc: "Physically blocks external actions that violate policy." }
                ].map((feature, idx) => (
                  <div key={idx} className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-md hover:bg-white/[0.04] transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-[#ccff00]/10 flex items-center justify-center mb-6">
                      <feature.icon className="w-6 h-6 text-[#ccff00]" />
                    </div>
                    <h3 className="font-bold text-xl mb-3 text-white">{feature.title}</h3>
                    <p className="text-white/40 font-medium">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="demo"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-4xl"
            >
              <HardcodedDemo />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const SCENARIOS = [
  {
    id: "sso-delay",
    label: "Scenario 1: Policy Conflict",
    input: `"Enterprise SSO is delayed. Do not commit a date externally."`,
    maya: "Enterprise SSO release is delayed.",
    rook: { found: true, message: `"Sales team promised Q3 release for SSO."` },
    vera: "The conflict is high-risk. External action must be blocked.",
    outcome: "BLOCKED",
    override: `"Enterprise SSO is delayed while security review remains open. We do not have a committed release date yet, and we will share an update as soon as the review is complete."`
  },
  {
    id: "pricing-update",
    label: "Scenario 2: Pricing Discrepancy",
    input: `"We are increasing the Pro tier price from $20 to $25 starting next month."`,
    maya: "Pro tier price increases to $25 next month.",
    rook: { found: true, message: `"Marketing campaign states 'Lock in $20 forever'."` },
    vera: "High risk. Pricing discrepancy violates existing marketing commitments. Blocked.",
    outcome: "BLOCKED",
    override: `"Pro tier will be $25 for new customers. Existing customers keep their $20 'forever' rate."`
  },
  {
    id: "server-outage",
    label: "Scenario 3: Safe Status Update",
    input: `"EU-West server is down for emergency maintenance. ETA 2 hours."`,
    maya: "EU-West server is down, 2h ETA.",
    rook: { found: false, message: "No conflicting memory found." },
    vera: "Low risk. Status update is safe to dispatch.",
    outcome: "ALLOWED",
    override: null
  }
];

function HardcodedDemo() {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const scenario = SCENARIOS[activeScenarioIdx];

  const runDemo = () => {
    setIsRunning(true);
    setStep(1); // Show input message
    setTimeout(() => setStep(2), 2000); // Maya extracting fact
    setTimeout(() => setStep(3), 5000); // Rook finding conflict
    setTimeout(() => setStep(4), 8000); // Vera deciding
    setTimeout(() => {
      setStep(5); // Final outcome
      setIsRunning(false);
    }, 11000);
  };

  const resetDemo = () => {
    setStep(0);
    setIsRunning(false);
  };

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Demo Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-6 border-b border-white/5 bg-white/[0.02] gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="text-[#ccff00] w-6 h-6" />
            Interactive Agent Flow
          </h2>
          <div className="flex gap-2 mt-3">
             {SCENARIOS.map((s, idx) => (
                <button
                  key={s.id}
                  disabled={isRunning || step > 0}
                  onClick={() => {
                    setActiveScenarioIdx(idx);
                    resetDemo();
                  }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                    idx === activeScenarioIdx 
                      ? 'bg-white/20 text-white border border-white/30' 
                      : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 disabled:opacity-30'
                  }`}
                >
                  {s.label}
                </button>
             ))}
          </div>
        </div>
        <div>
          {step === 0 ? (
            <button 
              onClick={runDemo}
              className="px-6 py-2.5 bg-[#ccff00] text-black font-bold rounded-full hover:bg-[#bbee00] transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
            >
              <Play className="w-4 h-4 fill-current" /> Run Simulation
            </button>
          ) : (
            <button 
              onClick={resetDemo}
              disabled={isRunning}
              className="px-6 py-2.5 bg-white/10 text-white font-medium rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              Reset Demo
            </button>
          )}
        </div>
      </div>

      {/* Demo Body */}
      <div className="p-8 space-y-8 min-h-[500px] relative">
        {step === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
            <BrainCircuit className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Click "Run Simulation" to begin.</p>
          </div>
        )}

        {/* Step 1: The Input */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 p-5 rounded-2xl">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">1. Incoming Message</div>
                <p className="text-white text-lg font-medium">{scenario.input}</p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Maya */}
          {step >= 2 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 ml-8">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shrink-0">
                {step === 2 ? <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /> : <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
              </div>
              <div className="flex-1 bg-cyan-950/20 border border-cyan-500/20 p-5 rounded-2xl">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">2. Maya (Extraction Agent)</div>
                {step === 2 ? (
                  <p className="text-white/60 animate-pulse">Reading message and extracting facts...</p>
                ) : (
                  <div className="text-white">
                    <p>Extracted Fact: <span className="font-bold text-cyan-200">{scenario.maya}</span></p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Rook */}
          {step >= 3 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 ml-16">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 border border-pink-500/50 flex items-center justify-center shrink-0">
                {step === 3 ? <Loader2 className="w-5 h-5 text-pink-400 animate-spin" /> : (scenario.rook.found ? <ShieldAlert className="w-5 h-5 text-pink-400" /> : <CheckCircle2 className="w-5 h-5 text-pink-400" />)}
              </div>
              <div className="flex-1 bg-pink-950/20 border border-pink-500/20 p-5 rounded-2xl">
                <div className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2">3. Rook (Conflict Agent)</div>
                {step === 3 ? (
                  <p className="text-white/60 animate-pulse">Scanning graph memory for contradictions...</p>
                ) : (
                  <div className="text-white">
                    {scenario.rook.found ? (
                       <p className="text-pink-300 font-medium">⚠️ Conflict Detected!</p>
                    ) : (
                       <p className="text-pink-300 font-medium">✅ Clear! No Conflicts.</p>
                    )}
                    <p className="text-white/70 text-sm mt-1">Graph memory context: {scenario.rook.message}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Vera & Guard */}
          {step >= 4 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 ml-24">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/50 flex items-center justify-center shrink-0">
                {step === 4 ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" /> : <ShieldCheck className="w-5 h-5 text-violet-400" />}
              </div>
              <div className="flex-1 bg-violet-950/20 border border-violet-500/20 p-5 rounded-2xl">
                <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">4. Vera (Resolution Agent)</div>
                {step === 4 ? (
                  <p className="text-white/60 animate-pulse">Evaluating safety and resolution...</p>
                ) : (
                  <div className="text-white">
                    <p className="text-violet-200">Decision: {scenario.vera}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 5: Final Outcome */}
          {step >= 5 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8">
              {scenario.outcome === "BLOCKED" ? (
                <div className="bg-red-950/40 border border-red-500/50 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.15)] relative overflow-hidden">
                  <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4 relative z-10">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-red-400 mb-2 relative z-10">Action Guard: BLOCKED</h3>
                  <p className="text-white/80 relative z-10 mb-6">The system successfully prevented an external commitment that violates graph memory.</p>
                  
                  {step === 5 && scenario.override && (
                    <button 
                      onClick={() => setStep(6)}
                      className="relative z-10 px-6 py-2.5 bg-white text-red-950 font-bold rounded-full hover:bg-red-100 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                      Human Override: Approve Safe Fallback
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
                  <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 relative z-10">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-emerald-400 mb-2 relative z-10">Action Guard: ALLOWED</h3>
                  <p className="text-white/80 relative z-10">The system confirmed the action is safe and dispatched it immediately.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 6: Approved Fallback (If blocked and overridden) */}
          {step >= 6 && scenario.override && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 mt-8">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 bg-emerald-950/20 border border-emerald-500/20 p-5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">5. Human Override (Approved)</div>
                <p className="text-emerald-100 font-medium">{scenario.override}</p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Safe response dispatched</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
