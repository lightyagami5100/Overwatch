"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2, Terminal, ChevronDown } from "lucide-react";
import { getAllTools } from "@/lib/api";
import type { ToolMeta } from "@/lib/types";

interface QuickScanPanelProps {
  onScanComplete?: (caseId: string) => void;
}

export function QuickScanPanel({ onScanComplete }: QuickScanPanelProps) {
  const [categories, setCategories] = useState<Record<string, ToolMeta[]>>({});
  
  const [selectedToolName, setSelectedToolName] = useState<string>("");
  const [targetInput, setTargetInput] = useState<string>("");
  
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [results, setResults] = useState<string>("");

  useEffect(() => {
    getAllTools().then(res => {
      setCategories(res.categories);
      // Auto-select the first tool if none selected
      if (!selectedToolName) {
        const firstCat = Object.values(res.categories)[0];
        if (firstCat && firstCat.length > 0) {
          setSelectedToolName(firstCat[0].name);
        }
      }
    }).catch(console.error);
  }, []);

  const allToolsFlat = useMemo(() => {
    return Object.values(categories).flat();
  }, [categories]);

  const selectedTool = useMemo(() => {
    return allToolsFlat.find(t => t.name === selectedToolName) || null;
  }, [selectedToolName, allToolsFlat]);

  const handleScan = async () => {
    if (!selectedTool || !targetInput) return;
    
    setExecutingTool(selectedTool.name);
    setResults(`$ ${selectedTool.name} ${targetInput}\nInitializing scan sequence...\n`);
    
    try {
      const entityType = selectedTool.entity_type[0] || "DOMAIN";
      
      const res = await fetch(`http://localhost:8000/api/tools/execute-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          target: targetInput, 
          entity_type: entityType, 
          category: selectedTool.category
        }),
      });
      
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(prev => prev + "\n" + data.tool_results);
      
      if (data.case_file_id && onScanComplete) {
        onScanComplete(data.case_file_id);
      }
    } catch (e: any) {
      setResults(prev => prev + `\n[ERROR] ${e.message}`);
    } finally {
      setExecutingTool(null);
    }
  };

  const getPlaceholder = (tool: ToolMeta | null) => {
    if (!tool) return "Select a tool first...";
    if (tool.entity_type.includes("PERSON")) return "Enter Username...";
    if (tool.entity_type.includes("IP")) return "Enter IP Address...";
    if (tool.entity_type.includes("DOMAIN")) return "Enter Domain...";
    if (tool.entity_type.includes("EMAIL")) return "Enter Email Address...";
    return "Enter Target...";
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 shrink-0">
        
        {/* Tool Dropdown */}
        <div className="relative">
          <select
            value={selectedToolName}
            onChange={(e) => {
              setSelectedToolName(e.target.value);
              setTargetInput("");
            }}
            className="w-full h-10 appearance-none bg-black/40 border border-white/10 rounded-xl px-3 py-0 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold cursor-pointer shadow-inner"
          >
            {Object.entries(categories).map(([catName, tools]) => (
              <optgroup key={catName} label={catName} className="bg-gray-900 text-white/50 font-semibold">
                {tools.map(tool => (
                  <option key={tool.name} value={tool.name} className="text-white bg-black">
                    {tool.display_name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>

        {/* Target Input */}
        <div className="relative">
          <input 
            type="text"
            placeholder={getPlaceholder(selectedTool)}
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 py-0 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono shadow-inner"
          />
        </div>

        {selectedTool && (
          <div className="px-1 text-xs text-white/40 font-medium">
            {selectedTool.description}
          </div>
        )}

        {/* Scan Action */}
        <button
          onClick={handleScan}
          disabled={!!executingTool || !targetInput || !selectedTool}
          className="h-10 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:shadow-none uppercase tracking-wider"
        >
          {executingTool ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {executingTool ? "Scanning..." : "Execute Scan"}
        </button>
      </div>

      {/* Terminal Expansion Area */}
      <div className="flex-1 bg-black/40 rounded-xl border border-white/10 flex flex-col overflow-hidden min-h-[200px]">
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-white/40" />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              Execution Logs
            </span>
          </div>
          {executingTool && (
            <div className="flex items-center gap-2 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-wider">
              <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
              Running
            </div>
          )}
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
          {results ? (
            <pre className="text-[11px] leading-relaxed font-mono text-green-400 whitespace-pre-wrap break-words">
              {results}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-white/20 font-mono text-xs">
              [ WAITING FOR EXECUTION ]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
