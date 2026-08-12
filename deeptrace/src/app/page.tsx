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

  const togglePanel = (panel: "ingestion" | "terminal" | "quickscan") => {
    setActivePanel(prev => (prev === panel ? null : panel));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden apple-mesh-bg">
      <TopNav />

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
                  ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                  : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              }`}
              title="Target Intel Input"
            >
              <UploadCloud className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => togglePanel("terminal")}
              className={`p-3 rounded-full transition-all ${
                activePanel === "terminal"
                  ? "bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]" 
                  : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              }`}
              title="Live Terminal Feed"
            >
              <Terminal className="w-5 h-5" />
            </button>

            <button
              onClick={() => togglePanel("quickscan")}
              className={`p-3 rounded-full transition-all ${
                activePanel === "quickscan"
                  ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]" 
                  : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
              }`}
              title="OSINT Quick Scan"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsChatbotOpen(true)}
              className="p-3 rounded-full transition-all bg-white/10 hover:bg-white/20 text-white/70 hover:text-white mt-auto"
              title="Nova AI Assistant"
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
        <div className="flex-1 flex flex-col min-w-0 apple-glass rounded-3xl overflow-hidden shadow-xl relative">
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
          <div className="apple-glass rounded-3xl flex flex-col h-[40%] p-0 overflow-hidden shadow-xl">
            <EvidenceVault
              caseFiles={caseFiles}
              activeCaseId={activeCaseId}
              onSelectCase={loadCaseGraph}
              onDeleteCase={removeCaseFile}
            />
          </div>
          <div className="apple-glass rounded-3xl flex flex-col h-[60%] p-0 overflow-hidden shadow-xl">
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-4 md:inset-10 z-[101] flex flex-col apple-glass shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/10"
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
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
