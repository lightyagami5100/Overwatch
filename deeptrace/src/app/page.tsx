"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Terminal, X, Search, Bot } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { IngestionPanel } from "@/components/IngestionPanel";
import { TerminalFeed } from "@/components/TerminalFeed";
import { QuickScanPanel } from "@/components/QuickScanPanel";
import { GraphViewer } from "@/components/GraphViewer";
import { EntityInspector } from "@/components/EntityInspector";
import { EvidenceVault } from "@/components/EvidenceVault";
import { useDeepTrace } from "@/hooks/useDeepTrace";
import { ManualModal } from "@/components/ManualModal";
import { DemoOverlay } from "@/components/DemoOverlay";

const WALLPAPERS = [
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
  "Purple (Dark).jpg",
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
    submitIntel,
    selectNode,
    loadCaseFiles,
    loadCaseGraph,
    removeCaseFile,
  } = useDeepTrace();

  // Sidebar toggle state
  const [activePanel, setActivePanel] = useState<"ingestion" | "terminal" | "quickscan" | null>(null);
  
  // Chatbot modal state
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Wallpaper state
  const [currentWallpaper, setCurrentWallpaper] = useState<string>("Purple (Dark).jpg");

  // Manual & Demo state
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const togglePanel = (panel: "ingestion" | "terminal" | "quickscan") => {
    setActivePanel(prev => (prev === panel ? null : panel));
  };

  return (
    <div 
      className={`flex flex-col h-screen overflow-hidden ${!currentWallpaper ? "apple-mesh-bg" : "bg-cover bg-center bg-no-repeat transition-all duration-700"}`}
      style={currentWallpaper ? { backgroundImage: `url('/wallpapers/${currentWallpaper}')` } : {}}
    >
      <TopNav 
        wallpapers={WALLPAPERS} 
        currentWallpaper={currentWallpaper} 
        onWallpaperChange={setCurrentWallpaper} 
        onOpenManual={() => setIsManualOpen(true)}
      />

      <main className="flex-1 p-4 lg:p-6 flex gap-4 lg:gap-6 min-h-0 relative z-10 w-full overflow-hidden">
        
        {/* Expandable Left Sidebar */}
        <motion.div 
          initial={false}
          animate={{ width: activePanel ? 400 : 80 }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          className="relative flex flex-col h-full apple-glass rounded-3xl overflow-hidden shadow-xl shrink-0"
        >
          {/* Sidebar Navigation / Dock (always visible, on the left edge of the sidebar) */}
          <div className="absolute left-0 top-0 bottom-0 w-[80px] bg-black/20 border-r border-white/5 flex flex-col items-center gap-6 py-6 z-20">
            <button
              onClick={() => togglePanel("ingestion")}
              className={`p-3 rounded-full transition-all ${
                activePanel === "ingestion"
                  ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                  : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              }`}
              title="Target Intel Input"
              data-demo-title="Intelligence Ingestion"
              data-demo-desc="Upload or enter raw intel (IPs, domains, emails). DeepTrace will automatically parse the data and prepare it for active OSINT scanning."
            >
              <UploadCloud className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => togglePanel("terminal")}
              className={`p-3 rounded-full transition-all ${
                activePanel === "terminal"
                  ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]" 
                  : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              }`}
              title="Live Terminal Feed"
              data-demo-title="Live Terminal"
              data-demo-desc="Watch backend tasks execute in real-time. This terminal streams stdout from the Python OSINT engine directly to your dashboard."
            >
              <Terminal className="w-5 h-5" />
            </button>

            <button
              onClick={() => togglePanel("quickscan")}
              className={`p-3 rounded-full transition-all ${
                activePanel === "quickscan"
                  ? "bg-white text-indigo-900 shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                  : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              }`}
              title="OSINT Quick Scan"
              data-demo-title="OSINT Engine"
              data-demo-desc="Trigger parallelized OSINT modules (Nmap, Dig, WhatWeb) against your targets and automatically compile the intelligence."
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsChatbotOpen(true)}
              className="p-3 rounded-full transition-all bg-white/10 hover:bg-white/20 text-white/70 hover:text-white mt-auto"
              title="Nova AI Assistant"
              data-demo-title="Nova AI Analyst"
              data-demo-desc="A fully localized AI agent powered by Ollama. Connects to your Evidence Vault to answer specific queries about your ongoing cases without leaving the network."
            >
              <Bot className="w-5 h-5 text-indigo-400" />
            </button>
          </div>

          {/* Sidebar Content Area (revealed when expanded) */}
          <div className="absolute left-[80px] top-0 bottom-0 w-[320px] p-5 z-10">
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
                    <h3 className="text-sm font-semibold text-white/90">Submit Intel</h3>
                    <button onClick={() => setActivePanel(null)} className="p-1 text-white/40 hover:text-white transition-colors">
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
                    <h3 className="text-sm font-semibold text-white/90">System Logs</h3>
                    <button onClick={() => setActivePanel(null)} className="p-1 text-white/40 hover:text-white transition-colors">
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
                    <h3 className="text-sm font-semibold text-white/90">Quick Scan</h3>
                    <button onClick={() => setActivePanel(null)} className="p-1 text-white/40 hover:text-white transition-colors">
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

        {/* Center Column: 3D Graph Viewer (flex-1 expands to fill space) */}
        <div 
          className="flex-1 flex flex-col min-w-0 apple-glass rounded-3xl overflow-hidden shadow-xl relative"
          data-demo-title="3D Correlation Engine"
          data-demo-desc="Uses Force-Directed WebGL rendering to visualize intelligence targets and their relationships in a 3D physical space, making large datasets easy to comprehend instantly."
        >
          <div className="absolute top-6 left-6 z-20 pointer-events-none">
            <h2 className="text-xl font-semibold text-white apple-heading">
              Entity Correlation Graph
            </h2>
            <p className="text-sm text-white/50 mt-1 font-medium">Live NLP Mapping Engine</p>
          </div>
          
          <div className="flex-1 relative z-10 w-full h-full mt-12">
            <GraphViewer
              graphData={graphData}
              onNodeClick={selectNode}
            />
          </div>
        </div>

        {/* Right Column: Evidence Vault & Inspector (fixed width) */}
        <div className="w-[320px] lg:w-[380px] shrink-0 flex flex-col gap-4 lg:gap-6 min-h-0">
          <div 
            className="apple-glass rounded-3xl flex flex-col h-[40%] p-0 overflow-hidden shadow-xl"
            data-demo-title="Evidence Vault"
            data-demo-desc="A secure local storage database. All OSINT scans are automatically saved here as immutable case files for later review and correlation without re-scanning."
          >
            <EvidenceVault
              caseFiles={caseFiles}
              activeCaseId={activeCaseId}
              onSelectCase={loadCaseGraph}
              onDeleteCase={removeCaseFile}
            />
          </div>
          <div 
            className="apple-glass rounded-3xl flex flex-col h-[60%] p-0 overflow-hidden shadow-xl"
            data-demo-title="Entity Inspector"
            data-demo-desc="Click on any node in the 3D graph to inspect it here. The inspector decodes raw API outputs and JSON responses into human-readable intel."
          >
            <EntityInspector
              selectedNode={selectedNode}
              graphData={graphData}
            />
          </div>
        </div>
      </main>

      {/* Chatbot Fullscreen Overlay */}
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
            <div className="fixed inset-4 md:inset-10 z-[101] pointer-events-none flex">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="flex-1 w-full flex flex-col apple-glass shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/10 pointer-events-auto"
              >
                <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 backdrop-blur-3xl shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white apple-heading leading-tight">Nova AI Assistant</h2>
                      <p className="text-[11px] text-white/50 font-medium tracking-wide uppercase">DeepTrace Integration</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsChatbotOpen(false)}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
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

      <ManualModal 
        isOpen={isManualOpen} 
        onClose={() => setIsManualOpen(false)} 
        onStartDemo={() => setIsDemoMode(true)} 
      />
      
      <DemoOverlay 
        isActive={isDemoMode} 
        onClose={() => setIsDemoMode(false)} 
      />
    </div>
  );
}
