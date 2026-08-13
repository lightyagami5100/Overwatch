"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Link as LinkIcon, Zap, Loader2, ShieldAlert } from "lucide-react";
import type { GraphNode, GraphLink, GraphData, ToolMeta, ToolCategoriesResponse } from "@/lib/types";
import { getToolCategories, executeTool } from "@/lib/api";

interface EntityInspectorProps {
  selectedNode: GraphNode | null;
  graphData: GraphData;
}

export function EntityInspector({
  selectedNode,
  graphData,
}: EntityInspectorProps) {
  const [toolCategories, setToolCategories] = useState<Record<string, ToolMeta[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState(false);
  
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
          setSelectedTool(res.categories[firstCategory][0].name);
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

  const allTools = Object.values(toolCategories).flat();

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-400" />
          <h2 className="text-base font-semibold tracking-tight apple-heading">
            Entity Inspector
          </h2>
        </div>
        <div className="text-xs font-mono text-white/50">{selectedNode.id.substring(0, 8)}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Entity Label</label>
            <div className="text-lg font-semibold mt-1 break-all">
              {selectedNode.label}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Class</label>
              <div className="mt-1 text-sm font-medium bg-white/10 rounded px-2 py-1 inline-block">
                {selectedNode.entity_type}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Threat Level</label>
              <div className="mt-1">
                <span
                  className={`
                    text-xs font-bold px-2 py-1 rounded inline-block uppercase
                    ${
                      selectedNode.threat_level === "CRITICAL"
                        ? "bg-red-500/20 text-red-400"
                        : selectedNode.threat_level === "SUSPICIOUS"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }
                  `}
                >
                  {selectedNode.threat_level}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Scans / Tool Results */}
        <AnimatePresence>
          {localToolResults && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10 mt-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Scan Results
                </h3>
              </div>
              <div className="text-xs font-mono text-white/80 bg-black/40 border border-white/10 p-3 rounded-xl whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar shadow-inner">
                {localToolResults}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Tool Execution */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <ShieldAlert className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Actions
            </h3>
          </div>

          {allTools.length === 0 ? (
            <p className="text-sm text-white/50 italic">
              No actions available for this entity type.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-white/50">Select OSINT Vector</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setSelectedCategory(cat);
                    setSelectedTool(toolCategories[cat][0].name);
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                >
                  {Object.keys(toolCategories).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExecute}
                disabled={isExecuting || !selectedCategory}
                className="w-full h-10 bg-white text-black hover:bg-gray-100 disabled:bg-white/20 disabled:text-white/40 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {isExecuting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Executing...</>
                ) : (
                  <><Zap className="h-4 w-4" /> Run {selectedCategory}</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Connected Entities */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <LinkIcon className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Connected Entities
            </h3>
          </div>
          {linkedNodes.length === 0 ? (
            <p className="text-sm text-white/50 italic">No connections found.</p>
          ) : (
            <ul className="space-y-2">
              {linkedNodes.map((item, idx) => (
                <li
                  key={idx}
                  className="text-xs bg-white/5 p-2 rounded-lg flex flex-col gap-1 border border-white/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white/90 truncate max-w-[150px]">
                      {item.node!.label}
                    </span>
                    <span className="text-[10px] text-white/50 font-medium px-1.5 py-0.5 bg-white/10 rounded">
                      {item.node!.entity_type}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/40 flex items-center gap-1">
                    {item.isSource ? "Outgoing:" : "Incoming:"}
                    <span className="text-blue-300 font-medium">{item.link.relationship}</span>
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
