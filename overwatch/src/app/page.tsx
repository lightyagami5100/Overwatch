"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Terminal,
  X,
  Search,
  Bot,
  Network,
  Sliders,
  Binary,
  Database,
  ExternalLink,
  Sparkles,
  Shield,
  Layers,
  Copy,
  Check,
  FileText,
  FileCheck,
  Zap,
  Activity
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { IngestionPanel } from "@/components/IngestionPanel";
import { TerminalFeed } from "@/components/TerminalFeed";
import { QuickScanPanel } from "@/components/QuickScanPanel";
import { GraphViewer } from "@/components/GraphViewer";
import { EntityInspector } from "@/components/EntityInspector";
import { EvidenceVault } from "@/components/EvidenceVault";
import { OmniToolHub } from "@/components/OmniToolHub";
import { CipherLab } from "@/components/CipherLab";
import { CommandPalette } from "@/components/CommandPalette";
import { useOverwatch } from "@/hooks/useOverwatch";
import { ManualModal } from "@/components/ManualModal";
import { DemoOverlay } from "@/components/DemoOverlay";
import { getAllTools } from "@/lib/api";
import type { ToolMeta, GraphNode } from "@/lib/types";

const WALLPAPERS = [
  "Purple (Dark).jpg",
  "102738435239242554.jpg",
  "1134555331150821854.jpg",
  "1139410774493628087.jpg",
  "2040762329295531.jpg",
  "583779170485896804.jpg",
  "691935930286943025.jpg",
  "912964155750623758.jpg",
  "Cat -NO, I'M NOT A HUMAN.jpg",
  "Facebook.jpg",
  "Green08.jpg",
  "Jelly dessert.jpg",
  "ff40e9be579443299206f027e2a64a69.jpg",
  "meowl windows oboi.jpg",
  "wp11435508-attack-on-titan-ocean-wallpapers.jpg"
];

export default function DashboardPage() {
  const {
    graphData,
    selectedNode,
    terminalLogs,
    isProcessing,
    caseFiles,
    activeCaseId,
    isBackendConnected,
    submitIntel,
    selectNode,
    loadCaseFiles,
    loadCaseGraph,
    removeCaseFile,
  } = useOverwatch();

  // Active Workspace Mode
  const [activeMode, setActiveMode] = useState<"graph" | "tools" | "ciphers">("graph");

  // Sidebar toggle state in graph mode
  const [activePanel, setActivePanel] = useState<"ingestion" | "terminal" | "quickscan" | null>(null);

  // Command Palette & Chatbot Modal state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Toast / Notification state for clipboard sending
  const [novaToast, setNovaToast] = useState<string | null>(null);

  // Tools catalog cache
  const [allTools, setAllTools] = useState<ToolMeta[]>([]);
  const [selectedToolForHub, setSelectedToolForHub] = useState<string | undefined>(undefined);

  // Wallpaper state
  const [currentWallpaper, setCurrentWallpaper] = useState<string>("Purple (Dark).jpg");

  // Manual & Demo state
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    getAllTools()
      .then((res) => {
        if (res && res.tools) setAllTools(res.tools);
      })
      .catch((err) => {
        console.warn("[Overwatch] Note: Tools catalog refresh deferred:", err?.message || err);
      });
  }, [isBackendConnected]);

  const togglePanel = (panel: "ingestion" | "terminal" | "quickscan") => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const handlePipeToGraph = async (text: string) => {
    setActiveMode("graph");
    await submitIntel(text);
  };

  const showNovaNotification = (msg: string) => {
    setNovaToast(msg);
    setTimeout(() => setNovaToast(null), 3500);
  };

  const handleSendPromptToNova = (promptText: string) => {
    navigator.clipboard.writeText(promptText);
    showNovaNotification("Report copied! Ready to paste into Nova chat.");
    setIsChatbotOpen(true);
  };

  const activeCase = caseFiles.find((c) => c.id === activeCaseId) || null;

  // Quick Dispatch Presets for Nova Modal
  const dispatchCaseSummary = () => {
    if (!activeCase) {
      handleSendPromptToNova("Please provide a comprehensive cyber threat briefing on our active network scope.");
      return;
    }
    const iocList = graphData.nodes.map((n) => `• [${n.entity_type}] ${n.label} (${n.threat_level})`).join("\n");
    const prompt = `INCIDENT REPORT BRIEFING FOR NOVA:
Case Identifier: ${activeCase.id}
Filename: ${activeCase.filename}
Overall Threat Level: ${activeCase.threat_level}
Total Entities Discovered: ${graphData.nodes.length}
Total Correlation Links: ${graphData.links.length}

Observed Indicators of Compromise (IOCs):
${iocList}

Please analyze this case, identify the probable threat actor tactics, and prioritize containment actions.`;
    handleSendPromptToNova(prompt);
  };

  const dispatchMitreMapping = () => {
    const iocs = graphData.nodes.map((n) => `${n.entity_type}: ${n.label}`).slice(0, 15).join(", ");
    const prompt = `MITRE ATT&CK CORRELATION REQUEST:
Observed network artifacts: ${iocs || "Active network scan telemetry"}

Please:
1. Map these indicators to specific MITRE ATT&CK Enterprise Matrix techniques (e.g. T1071, T1059, T1190).
2. Detail the typical Kill Chain phase.
3. Recommend corresponding Sigma detection rules.`;
    handleSendPromptToNova(prompt);
  };

  const dispatchPlaybook = () => {
    const prompt = `INCIDENT RESPONSE PLAYBOOK REQUEST:
Context: Case ${activeCase?.filename || "Active Network Security Incident"} (Threat Level: ${activeCase?.threat_level || "ELEVATED"}).

Draft an emergency 4-phase Incident Response Playbook:
Phase 1: Immediate Network & Host Containment
Phase 2: Eradication & Forensic Preservation
Phase 3: Service Recovery & Verification
Phase 4: Post-Incident Lessons & Defensive Hardening`;
    handleSendPromptToNova(prompt);
  };

  return (
    <div
      className={`flex flex-col h-screen overflow-hidden ${
        !currentWallpaper ? "apple-mesh-bg" : "bg-cover bg-center bg-no-repeat transition-all duration-700"
      }`}
      style={currentWallpaper ? { backgroundImage: `url('/wallpapers/${currentWallpaper}')` } : {}}
    >
      <TopNav
        activeMode={activeMode}
        onModeChange={setActiveMode}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAiAnalyst={() => setIsChatbotOpen(true)}
        wallpapers={WALLPAPERS}
        currentWallpaper={currentWallpaper}
        onWallpaperChange={setCurrentWallpaper}
        onOpenManual={() => setIsManualOpen(true)}
        toolCount={allTools.length}
        isBackendConnected={isBackendConnected}
      />

      <main className="flex-1 p-3 lg:p-5 flex gap-4 lg:gap-6 min-h-0 relative z-10 w-full overflow-hidden">
        
        {/* VIEW 1: 3D THREAT GRAPH COMMAND CENTER */}
        {activeMode === "graph" && (
          <div className="flex-1 flex gap-4 lg:gap-6 min-h-0 w-full">
            {/* Expandable Left Sidebar */}
            <motion.div
              initial={false}
              animate={{ width: activePanel ? 400 : 80 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="relative flex flex-col h-full apple-glass rounded-3xl overflow-hidden shadow-xl shrink-0"
            >
              {/* Sidebar Navigation Dock */}
              <div className="absolute left-0 top-0 bottom-0 w-[80px] bg-black/20 border-r border-white/5 flex flex-col items-center gap-5 py-6 z-20">
                <button
                  onClick={() => togglePanel("ingestion")}
                  className={`p-3 rounded-2xl transition-all ${
                    activePanel === "ingestion"
                      ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                  }`}
                  title="Target Intel Input"
                >
                  <UploadCloud className="w-5 h-5" />
                </button>

                <button
                  onClick={() => togglePanel("terminal")}
                  className={`p-3 rounded-2xl transition-all ${
                    activePanel === "terminal"
                      ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                      : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                  }`}
                  title="Swarm Execution Terminal"
                >
                  <Terminal className="w-5 h-5" />
                </button>

                <button
                  onClick={() => togglePanel("quickscan")}
                  className={`p-3 rounded-2xl transition-all ${
                    activePanel === "quickscan"
                      ? "bg-white text-indigo-900 shadow-[0_0_15px_rgba(255,255,255,0.5)] font-bold"
                      : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                  }`}
                  title="OSINT Quick Scan"
                >
                  <Search className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setIsChatbotOpen(true)}
                  className="p-3 rounded-2xl transition-all bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 mt-auto"
                  title="Nova AI Assistant"
                >
                  <Bot className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Expanded Content */}
              <div className="absolute left-[80px] top-0 bottom-0 w-[320px] p-4 z-10">
                <AnimatePresence mode="wait">
                  {activePanel === "ingestion" && (
                    <motion.div
                      key="ingestion"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold font-mono text-white/80 uppercase tracking-widest">
                          Ingest Intelligence
                        </h3>
                        <button
                          onClick={() => setActivePanel(null)}
                          className="p-1 text-white/40 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <IngestionPanel onSubmit={submitIntel} isProcessing={isProcessing} />
                      </div>
                    </motion.div>
                  )}

                  {activePanel === "terminal" && (
                    <motion.div
                      key="terminal"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold font-mono text-white/80 uppercase tracking-widest">
                          Swarm System Logs
                        </h3>
                        <button
                          onClick={() => setActivePanel(null)}
                          className="p-1 text-white/40 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <TerminalFeed logs={terminalLogs} />
                      </div>
                    </motion.div>
                  )}

                  {activePanel === "quickscan" && (
                    <motion.div
                      key="quickscan"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-full flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold font-mono text-white/80 uppercase tracking-widest">
                          Quick Recon Scan
                        </h3>
                        <button
                          onClick={() => setActivePanel(null)}
                          className="p-1 text-white/40 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <QuickScanPanel
                          onScanComplete={async (caseId) => {
                            await loadCaseFiles();
                            await loadCaseGraph(caseId);
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Center: 3D Force Graph */}
            <div className="flex-1 flex flex-col min-w-0 apple-glass rounded-3xl overflow-hidden shadow-xl relative">
              <div className="flex-1 relative z-10 w-full h-full">
                <GraphViewer graphData={graphData} onNodeClick={selectNode} />
              </div>
            </div>

            {/* Right: Evidence Vault (top) & Entity Inspector (bottom) */}
            <div className="w-[320px] lg:w-[380px] shrink-0 flex flex-col gap-4 min-h-0">
              <div className="apple-glass rounded-3xl flex flex-col h-[42%] p-0 overflow-hidden shadow-xl">
                <EvidenceVault
                  caseFiles={caseFiles}
                  activeCaseId={activeCaseId}
                  onSelectCase={loadCaseGraph}
                  onDeleteCase={removeCaseFile}
                />
              </div>
              <div className="apple-glass rounded-3xl flex flex-col h-[58%] p-0 overflow-hidden shadow-xl">
                <EntityInspector
                  selectedNode={selectedNode}
                  graphData={graphData}
                  onSendToNova={handleSendPromptToNova}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: OMNI-TOOL CYBER HUB (1000+ TOOLS) */}
        {activeMode === "tools" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 w-full h-full min-h-0"
          >
            <OmniToolHub
              onIngestOutput={handlePipeToGraph}
              onSendToNova={handleSendPromptToNova}
              initialToolName={selectedToolForHub}
            />
          </motion.div>
        )}

        {/* VIEW 3: CIPHER & MATRIX LAB */}
        {activeMode === "ciphers" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 w-full h-full min-h-0"
          >
            <CipherLab onSendToGraph={handlePipeToGraph} />
          </motion.div>
        )}
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tools={allTools}
        caseFiles={caseFiles}
        nodes={graphData.nodes}
        onSelectMode={(mode) => {
          if (mode === "ai") setIsChatbotOpen(true);
          else setActiveMode(mode as any);
        }}
        onSelectTool={(tool) => {
          setSelectedToolForHub(tool.name);
          setActiveMode("tools");
        }}
        onSelectCase={(caseId) => {
          loadCaseGraph(caseId);
          setActiveMode("graph");
        }}
        onSelectNode={(node) => {
          selectNode(node);
          setActiveMode("graph");
        }}
      />

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {novaToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[200] px-4 py-2.5 rounded-2xl bg-indigo-600/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl border border-indigo-400/40 flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-300" />
            {novaToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nova AI Assistant Fullscreen Overlay (Original Rich Ollama Chatbot on port 3001) */}
      <AnimatePresence>
        {isChatbotOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
              onClick={() => setIsChatbotOpen(false)}
            />
            <div className="fixed inset-3 md:inset-6 z-[101] pointer-events-none flex">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="flex-1 w-full flex flex-col apple-glass shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/10 pointer-events-auto"
              >
                {/* Header */}
                <div className="p-3 bg-white/5 border-b border-white/10 backdrop-blur-3xl shrink-0 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white apple-heading leading-tight flex items-center gap-2">
                          Nova AI Assistant
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-mono rounded uppercase tracking-wider border border-indigo-500/30">
                            Zero-Trust Ollama Matrix
                          </span>
                        </h2>
                        <p className="text-[11px] text-white/50 font-medium">
                          {activeCase
                            ? `Active Case Attached: ${activeCase.filename} (${graphData.nodes.length} nodes)`
                            : "Full Model Selection, Temperature & Custom System Prompts"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href="http://localhost:3001"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Open in external window"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => setIsChatbotOpen(false)}
                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Context & Dispatch Bar */}
                  <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-1 text-xs">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest shrink-0">
                      ⚡ Quick Dispatch:
                    </span>
                    <button
                      onClick={dispatchCaseSummary}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white/80 hover:text-white text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5"
                    >
                      <FileText className="w-3 h-3 text-indigo-400" />
                      Copy Case Intel
                    </button>
                    <button
                      onClick={dispatchMitreMapping}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white/80 hover:text-white text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5"
                    >
                      <Shield className="w-3 h-3 text-amber-400" />
                      MITRE ATT&CK Matrix
                    </button>
                    <button
                      onClick={dispatchPlaybook}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white/80 hover:text-white text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5"
                    >
                      <Zap className="w-3 h-3 text-cyan-400" />
                      IR Playbook
                    </button>
                  </div>
                </div>

                {/* Nova Embedded Chatbot */}
                <div className="flex-1 w-full bg-black relative">
                  <iframe
                    src="http://localhost:3001"
                    className="w-full h-full border-none absolute inset-0"
                    title="Nova Chatbot"
                    allow="microphone"
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Manual & Demo Modal */}
      <ManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onStartDemo={() => setIsDemoMode(true)}
      />

      <DemoOverlay isActive={isDemoMode} onClose={() => setIsDemoMode(false)} />
    </div>
  );
}
