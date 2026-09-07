"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Link as LinkIcon, Zap, Loader2, ShieldAlert, Bot, Check, Copy } from "lucide-react";
import type { GraphNode, GraphLink, GraphData, ToolMeta, ToolCategoriesResponse } from "@/lib/types";
import { getToolCategories, executeTool } from "@/lib/api";

interface EntityInspectorProps {
  selectedNode: GraphNode | null;
  graphData: GraphData;
  onSendToNova?: (prompt: string) => void;
}

export function EntityInspector({
  selectedNode,
  graphData,
  onSendToNova,
}: EntityInspectorProps) {
  const [toolCategories, setToolCategories] = useState<Record<string, ToolMeta[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("Reconnaissance");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentToNova, setSentToNova] = useState(false);
  
  const [localToolResults, setLocalToolResults] = useState<string | null>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalToolResults(selectedNode.tool_results || null);
    } else {
      setLocalToolResults(null);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedNode) {
      setToolCategories({});
      return;
    }

    getToolCategories(selectedNode.entity_type)
      .then((res: ToolCategoriesResponse) => {
        setToolCategories(res.categories);
        const firstCategory = Object.keys(res.categories)[0];
        if (firstCategory) {
          setSelectedCategory(firstCategory);
          setSelectedTool(res.categories[firstCategory][0]?.name || "");
        }
      })
      .catch((err) => console.error("Failed to fetch tool categories:", err));
  }, [selectedNode]);

  const handleExecute = useCallback(async () => {
    if (!selectedNode || !selectedCategory) return;
    setIsExecuting(true);
    try {
      const res = await executeTool(selectedNode.id, selectedCategory);
      setLocalToolResults(res.tool_results);
      selectedNode.tool_results = res.tool_results;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setLocalToolResults((prev) => (prev ? prev + "\n\n" : "") + `[ERROR] ${errMsg}`);
    } finally {
      setIsExecuting(false);
    }
  }, [selectedNode, selectedCategory]);

  const handleSendNodeToNova = () => {
    if (!selectedNode) return;
    const connections = graphData.links
      .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
      .map((l) => {
        const otherId = l.source === selectedNode.id ? l.target : l.source;
        const other = graphData.nodes.find((n) => n.id === otherId);
        return `${other?.label || otherId} (${l.relationship})`;
      })
      .join(", ");

    const prompt = `SECURITY DOSSIER FOR TARGET ENTITY:
- Label / Identifier: ${selectedNode.label}
- Entity Type: ${selectedNode.entity_type}
- Threat Classification: ${selectedNode.threat_level}
- Connected Entities: ${connections || "None"}
- Scan Findings / Output:
${localToolResults || "No previous active scan output recorded."}

Please assess:
1. Threat severity and potential attack vectors.
2. Alignment with known threat actor TTPs.
3. Recommended containment and pivoting actions.`;

    navigator.clipboard.writeText(prompt);
    setSentToNova(true);
    setTimeout(() => setSentToNova(false), 2500);
    if (onSendToNova) onSendToNova(prompt);
  };

  if (!selectedNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/40 p-6 text-center">
        <Target className="h-10 w-10 mb-3 opacity-50" />
        <p className="font-medium text-sm">Select a node in the graph to inspect</p>
      </div>
    );
  }

  const linkedNodes = graphData.links
    .filter(
      (l) => l.source === selectedNode.id || l.target === selectedNode.id
    )
    .map((l) => {
      const isSource = l.source === selectedNode.id;
      const otherNodeId = isSource ? l.target : l.source;
      const otherNode = graphData.nodes.find((n) => n.id === otherNodeId);
      return { link: l, node: otherNode, isSource };
    })
    .filter((obj) => obj.node !== undefined);

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold tracking-tight text-white/90">
            Entity Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendNodeToNova}
            className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all"
            title="Send full entity dossier to Nova AI"
          >
            <Bot className="w-3 h-3 text-indigo-400" />
            {sentToNova ? "Sent to Nova!" : "Send to Nova AI"}
          </button>
          <span className="text-[10px] font-mono text-white/40">{selectedNode.id.substring(0, 8)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* Node Profile Card */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40">
              {selectedNode.entity_type}
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                selectedNode.threat_level === "CRITICAL"
                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                  : selectedNode.threat_level === "SUSPICIOUS"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              }`}
            >
              {selectedNode.threat_level}
            </span>
          </div>

          <div className="text-sm font-bold text-white break-all font-mono">
            {selectedNode.label}
          </div>
        </div>

        {/* Scan & Actions */}
        {Object.keys(toolCategories).length > 0 && (
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-white/50 uppercase tracking-widest block">
              Automated OSINT Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
            >
              {Object.keys(toolCategories).map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({toolCategories[cat].length} tools)
                </option>
              ))}
            </select>

            <button
              onClick={handleExecute}
              disabled={isExecuting || !selectedCategory}
              className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 active:scale-95 uppercase tracking-wider"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running {selectedCategory}...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Run {selectedCategory}
                </>
              )}
            </button>
          </div>
        )}

        {/* Scan Output Box */}
        {localToolResults && (
          <div className="p-3 bg-black/60 rounded-xl border border-white/10 text-xs font-mono text-green-400 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] text-white/40 mb-1 border-b border-white/10 pb-1 flex items-center justify-between">
              <span>SCAN OUTPUT</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(localToolResults);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-white/60 hover:text-white"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {localToolResults}
          </div>
        )}

        {/* Connected Entities */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-white/10">
            <LinkIcon className="h-3.5 w-3.5 text-indigo-400" />
            <h3 className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
              Connected Graph Entities ({linkedNodes.length})
            </h3>
          </div>
          {linkedNodes.length === 0 ? (
            <p className="text-xs text-white/40 italic">No connections found in current graph.</p>
          ) : (
            <ul className="space-y-1.5">
              {linkedNodes.map((item, idx) => (
                <li
                  key={idx}
                  className="text-xs bg-white/5 p-2 rounded-xl flex flex-col gap-1 border border-white/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white/90 truncate max-w-[170px] font-mono">
                      {item.node!.label}
                    </span>
                    <span className="text-[9px] text-white/50 font-medium px-1.5 py-0.5 bg-white/10 rounded">
                      {item.node!.entity_type}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/40 flex items-center gap-1">
                    {item.isSource ? "Outgoing:" : "Incoming:"}
                    <span className="text-indigo-300 font-medium">{item.link.relationship}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
