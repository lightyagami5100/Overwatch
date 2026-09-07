"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Search,
  Zap,
  Play,
  Square,
  Copy,
  Check,
  Plus,
  Filter,
  Shield,
  Layers,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Sliders,
  Flame,
  Clock,
  Download,
  AlertTriangle,
  FolderOpen,
  Bot
} from "lucide-react";
import { getAllTools, searchTools, executeToolStream, registerCustomTool } from "@/lib/api";
import type { ToolMeta } from "@/lib/types";

interface OmniToolHubProps {
  onIngestOutput?: (output: string) => void;
  onSendToNova?: (prompt: string) => void;
  initialToolName?: string;
  initialTarget?: string;
}

const TIMEOUT_OPTIONS = [
  { label: "Auto (Recommended)", value: 0 },
  { label: "30s (Quick)", value: 30 },
  { label: "60s (1 min)", value: 60 },
  { label: "120s (2 min)", value: 120 },
  { label: "300s (5 min - Deep Recon)", value: 300 },
  { label: "600s (10 min - Full Audit)", value: 600 },
];

export function OmniToolHub({ onIngestOutput, onSendToNova, initialToolName, initialTarget }: OmniToolHubProps) {
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [categories, setCategories] = useState<Record<string, ToolMeta[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<ToolMeta | null>(null);

  // Execution parameters
  const [targetInput, setTargetInput] = useState<string>(initialTarget || "127.0.0.1");
  const [customFlags, setCustomFlags] = useState<string>("");
  const [selectedTimeout, setSelectedTimeout] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [sentToNova, setSentToNova] = useState<boolean>(false);
  const abortExecutionRef = useRef<(() => void) | null>(null);

  // Custom tool creation modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDisplay, setCustomDisplay] = useState("");
  const [customCategory, setCustomCategory] = useState("Custom Suite");
  const [customCommand, setCustomCommand] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch all tools on mount
  useEffect(() => {
    getAllTools()
      .then((res) => {
        setTools(res.tools);
        setCategories(res.categories);
        if (initialToolName) {
          const found = res.tools.find((t) => t.name === initialToolName);
          if (found) setSelectedTool(found);
        } else if (res.tools.length > 0 && !selectedTool) {
          setSelectedTool(res.tools[0]);
        }
      })
      .catch(console.error);
  }, [initialToolName]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalOutput]);

  // Filtered tools
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      if (selectedCategory !== "ALL" && t.category !== selectedCategory) return false;
      if (
        selectedEntityType !== "ALL" &&
        !t.entity_type.includes(selectedEntityType) &&
        !t.entity_type.includes("TEXT")
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          t.display_name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [tools, selectedCategory, selectedEntityType, searchQuery]);

  const handleRunTool = () => {
    if (!selectedTool || !targetInput.trim() || isRunning) return;

    setIsRunning(true);
    setTerminalOutput("");

    const timeoutSec = selectedTimeout > 0 ? selectedTimeout : undefined;

    const abortFn = executeToolStream(
      selectedTool.name,
      targetInput.trim(),
      customFlags.trim() || undefined,
      timeoutSec,
      (chunk) => {
        setTerminalOutput((prev) => prev + chunk);
      },
      () => {
        setIsRunning(false);
        abortExecutionRef.current = null;
      },
      (err) => {
        setTerminalOutput((prev) => prev + `\n[ERROR]: ${err.message}\n`);
        setIsRunning(false);
        abortExecutionRef.current = null;
      }
    );

    abortExecutionRef.current = abortFn;
  };

  const handleStopTool = () => {
    if (abortExecutionRef.current) {
      abortExecutionRef.current();
      setTerminalOutput((prev) => prev + "\n[!] Execution terminated by user.\n");
      setIsRunning(false);
      abortExecutionRef.current = null;
    }
  };

  const handleSendToNova = () => {
    if (!terminalOutput || !selectedTool) return;
    const prompt = `Please analyze the following security tool output from ${selectedTool.display_name} (target: ${targetInput}):\n\n\`\`\`\n${terminalOutput}\n\`\`\`\n\nProvide: 1. Threat severity evaluation, 2. Key security observations, 3. Recommended investigation next steps.`;
    navigator.clipboard.writeText(prompt);
    setSentToNova(true);
    setTimeout(() => setSentToNova(false), 2500);
    if (onSendToNova) onSendToNova(prompt);
  };

  const handleSaveCustomTool = async () => {
    if (!customName || !customCommand) return;
    try {
      const res = await registerCustomTool({
        name: customName,
        display_name: customDisplay || customName,
        category: customCategory,
        command: customCommand,
        description: customDesc,
        entity_type: ["TEXT", "IP", "DOMAIN"],
      });
      setTools((prev) => [res.tool, ...prev]);
      setSelectedTool(res.tool);
      setIsCustomModalOpen(false);
      setCustomName("");
      setCustomCommand("");
      setCustomDesc("");
    } catch (e) {
      console.error(e);
    }
  };

  const copyTerminalOutput = () => {
    navigator.clipboard.writeText(terminalOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allCategoryNames = useMemo(() => {
    return ["ALL", ...Object.keys(categories)];
  }, [categories]);

  const entityTypes = ["ALL", "IP", "DOMAIN", "EMAIL", "HASH", "FILE", "PERSON", "CIDR", "URL"];

  return (
    <div className="w-full h-full flex flex-col apple-glass rounded-3xl overflow-hidden shadow-2xl border border-white/10 text-white">
      {/* Top Bar */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Omni-Tool Cyber Hub
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-mono rounded uppercase tracking-wider border border-purple-500/30">
                {tools.length} Tools Cataloged
              </span>
            </h2>
            <p className="text-xs text-white/50">High-concurrency streaming execution for native OSINT and security tools</p>
          </div>
        </div>

        <button
          onClick={() => setIsCustomModalOpen(true)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          New Custom Recipe
        </button>
      </div>

      {/* Main Grid: Left Directory & Right Execution Terminal */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        
        {/* Left Side: Search & Tool Selector (width 380px) */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col p-4 min-h-0 bg-black/20 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search 1,000+ tools (e.g. nmap, amass, dig, nikto)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 text-xs text-white outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs">
            {allCategoryNames.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all text-[11px] ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/30"
                    : "bg-white/5 hover:bg-white/10 text-white/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Entity Type Chips */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 text-[10px] font-mono text-white/60">
            <span className="text-white/30 mr-1">Target:</span>
            {entityTypes.map((et) => (
              <button
                key={et}
                onClick={() => setSelectedEntityType(et)}
                className={`px-2 py-0.5 rounded transition-all ${
                  selectedEntityType === et
                    ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                    : "bg-white/5 text-white/40 hover:text-white"
                }`}
              >
                {et}
              </button>
            ))}
          </div>

          {/* Tool List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[220px]">
            {filteredTools.length === 0 ? (
              <div className="p-8 text-center text-white/40 text-xs font-mono">
                No matching cybersecurity tools found.
              </div>
            ) : (
              filteredTools.map((tool) => {
                const isSelected = selectedTool?.name === tool.name;
                return (
                  <div
                    key={tool.name}
                    onClick={() => {
                      setSelectedTool(tool);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-purple-600/20 border-purple-500/60 shadow-lg shadow-purple-500/10"
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[200px]">
                        {tool.display_name}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          tool.installed
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {tool.installed ? "READY" : "SCRIPT"}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/50 line-clamp-1">{tool.description}</p>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                      <span className="px-1.5 py-0.5 bg-white/5 rounded text-white/60">{tool.category}</span>
                      <span>{tool.speed}</span>
                      {tool.timeout && (
                        <span className="text-purple-300/80">({tool.timeout}s)</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Command Execution & Live Terminal */}
        <div className="flex-1 flex flex-col p-5 min-h-0 bg-black/40 gap-4">
          
          {/* Tool Header & Parameter Customizer */}
          {selectedTool ? (
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {selectedTool.display_name}
                    <code className="text-xs font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {selectedTool.name}
                    </code>
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">{selectedTool.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/40">Entities:</span>
                  {selectedTool.entity_type.map((et) => (
                    <span key={et} className="text-[10px] font-mono px-2 py-0.5 bg-white/10 rounded text-white/70">
                      {et}
                    </span>
                  ))}
                </div>
              </div>

              {/* Target, Flags, and Timeout Selector Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-mono text-white/50 uppercase tracking-widest block mb-1">
                    Scan Target (IP, Domain, Email, Hash, File)
                  </label>
                  <input
                    type="text"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRunTool()}
                    placeholder="Enter scan target..."
                    className="w-full h-10 bg-black/60 border border-white/10 rounded-xl px-3 text-xs font-mono text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-white/50 uppercase tracking-widest block mb-1">
                    Extra Flags (Optional)
                  </label>
                  <input
                    type="text"
                    value={customFlags}
                    onChange={(e) => setCustomFlags(e.target.value)}
                    placeholder="e.g. -p 80,443 -v"
                    className="w-full h-10 bg-black/60 border border-white/10 rounded-xl px-3 text-xs font-mono text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-white/50 uppercase tracking-widest block mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-purple-400" />
                    Timeout Limit
                  </label>
                  <select
                    value={selectedTimeout}
                    onChange={(e) => setSelectedTimeout(Number(e.target.value))}
                    className="w-full h-10 bg-black/60 border border-white/10 rounded-xl px-3 text-xs font-mono text-white outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {isRunning ? (
                  <button
                    onClick={handleStopTool}
                    className="h-10 px-6 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20 active:scale-95 uppercase tracking-wider"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Terminate Process
                  </button>
                ) : (
                  <button
                    onClick={handleRunTool}
                    disabled={!targetInput.trim()}
                    className="h-10 px-6 bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 active:scale-95 uppercase tracking-wider disabled:shadow-none"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Execute Tool Stream
                  </button>
                )}

                {terminalOutput && (
                  <button
                    onClick={handleSendToNova}
                    className="h-10 px-4 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    title="Send output directly to Nova AI Chatbot"
                  >
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    {sentToNova ? "Copied & Sent to Nova!" : "Send Output to Nova AI"}
                  </button>
                )}

                {onIngestOutput && terminalOutput && (
                  <button
                    onClick={() => onIngestOutput(terminalOutput)}
                    className="h-10 px-4 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all ml-auto"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Extract Entities & Pipe to 3D Graph
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center text-white/50 text-xs font-mono">
              Select a tool from the catalog on the left to configure parameters
            </div>
          )}

          {/* Live Terminal Output Window */}
          <div className="flex-1 bg-black/60 rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-inner min-h-[250px]">
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-mono text-xs text-white/60">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span className="uppercase font-bold tracking-widest text-[10px]">
                  Real-time Subprocess Output Feed
                </span>
                {isRunning && (
                  <span className="flex items-center gap-1 text-[10px] text-purple-400 font-bold px-2 py-0.5 bg-purple-500/20 rounded-full animate-pulse border border-purple-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Streaming
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyTerminalOutput}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80 flex items-center gap-1 transition-all"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setTerminalOutput("")}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/60 hover:text-white transition-all"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed text-green-400 whitespace-pre-wrap break-all">
              {terminalOutput ? (
                <>
                  {terminalOutput}
                  <div ref={terminalEndRef} />
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-white/20 font-mono text-xs">
                  [ WAITING FOR EXECUTION DISPATCH ]
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Creating Custom Recipe */}
      <AnimatePresence>
        {isCustomModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
              onClick={() => setIsCustomModalOpen(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-gray-950 border border-white/20 rounded-3xl p-6 shadow-2xl pointer-events-auto flex flex-col gap-4"
              >
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-400" />
                  Create Custom Tool Recipe
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-white/60 mb-1 font-mono">Tool Identifier (lowercase)</label>
                    <input
                      type="text"
                      placeholder="e.g. rustscan_fast"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 mb-1 font-mono">Display Title</label>
                    <input
                      type="text"
                      placeholder="e.g. RustScan Fast Port Audit"
                      value={customDisplay}
                      onChange={(e) => setCustomDisplay(e.target.value)}
                      className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 mb-1 font-mono">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Network & Packet Analysis"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 mb-1 font-mono">Command Template (use {"{target}"})</label>
                    <input
                      type="text"
                      placeholder="e.g. rustscan -a {target} -- -sV"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 mb-1 font-mono">Description</label>
                    <textarea
                      placeholder="Explain what this tool does..."
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      className="w-full h-16 bg-black/60 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-2">
                  <button
                    onClick={() => setIsCustomModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCustomTool}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20"
                  >
                    Save & Index Recipe
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
