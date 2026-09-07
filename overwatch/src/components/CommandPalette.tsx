"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sliders,
  Binary,
  Bot,
  Database,
  Network,
  Command,
  ArrowRight,
  Shield,
  FileText,
  KeyRound,
  Terminal,
} from "lucide-react";
import type { ToolMeta, CaseFile, GraphNode } from "@/lib/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolMeta[];
  caseFiles: CaseFile[];
  nodes: GraphNode[];
  onSelectMode: (mode: "graph" | "tools" | "ciphers" | "vault" | "ai") => void;
  onSelectTool: (tool: ToolMeta) => void;
  onSelectCase: (caseId: string) => void;
  onSelectNode: (node: GraphNode) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  tools,
  caseFiles,
  nodes,
  onSelectMode,
  onSelectTool,
  onSelectCase,
  onSelectNode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset query on open
  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  const navActions = [
    { id: "graph", title: "Switch to 3D Threat Graph", category: "Navigation", icon: Network, mode: "graph" },
    { id: "tools", title: "Open Omni-Tool Hub (1000+ Tools)", category: "Navigation", icon: Sliders, mode: "tools" },
    { id: "ciphers", title: "Open Cyber Matrix & Cipher Lab", category: "Navigation", icon: Binary, mode: "ciphers" },
    { id: "ai", title: "Launch Nova AI Threat Analyst", category: "Navigation", icon: Bot, mode: "ai" },
    { id: "vault", title: "Inspect Evidence Vault", category: "Navigation", icon: Database, mode: "vault" },
  ];

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return {
        nav: navActions,
        tools: tools.slice(0, 5),
        cases: caseFiles.slice(0, 3),
        nodes: nodes.slice(0, 4),
      };
    }

    const nav = navActions.filter((n) => n.title.toLowerCase().includes(q));
    const matchedTools = tools
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.display_name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
    const matchedCases = caseFiles
      .filter((c) => c.filename.toLowerCase().includes(q) || c.sha256_hash.includes(q))
      .slice(0, 4);
    const matchedNodes = nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.entity_type.toLowerCase().includes(q))
      .slice(0, 5);

    return { nav, tools: matchedTools, cases: matchedCases, nodes: matchedNodes };
  }, [query, tools, caseFiles, nodes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[130] flex items-start justify-center pt-20 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        className="w-full max-w-2xl apple-glass border border-white/10 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden text-white flex flex-col max-h-[75vh]"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-black/40">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command, tool name (nmap, whois), entity, or case file..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none font-medium"
          />
          <kbd className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-mono text-white/50 border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          
          {/* Navigation Section */}
          {filteredItems.nav.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 px-3 mb-1 font-bold">
                Navigation & Views
              </div>
              <div className="space-y-1">
                {filteredItems.nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectMode(item.mode as any);
                        onClose();
                      }}
                      className="px-3 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
                        <span className="text-xs font-semibold text-white/90">{item.title}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/80 transition-transform group-hover:translate-x-1" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tools Section */}
          {filteredItems.tools.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 px-3 mb-1 font-bold">
                Cyber Tools Catalog ({tools.length})
              </div>
              <div className="space-y-1">
                {filteredItems.tools.map((t) => (
                  <div
                    key={t.name}
                    onClick={() => {
                      onSelectTool(t);
                      onSelectMode("tools");
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl hover:bg-purple-600/20 hover:border-purple-500/30 border border-transparent flex items-center justify-between cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-bold text-white/90">{t.display_name}</span>
                        <span className="text-[11px] text-white/40 ml-2 font-mono">{t.name}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-white/5 rounded text-purple-300">
                      {t.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graph Entities Section */}
          {filteredItems.nodes.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 px-3 mb-1 font-bold">
                Active Graph Entities
              </div>
              <div className="space-y-1">
                {filteredItems.nodes.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      onSelectNode(n);
                      onSelectMode("graph");
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-white/90 truncate">{n.label}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-white/10 rounded text-white/60">
                      {n.entity_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Case Files Section */}
          {filteredItems.cases.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 px-3 mb-1 font-bold">
                Evidence Vault Cases
              </div>
              <div className="space-y-1">
                {filteredItems.cases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCase(c.id);
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-white/90 truncate">{c.filename}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">{c.sha256_hash.slice(0, 12)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40 font-mono">
          <span>Navigate with arrows or mouse</span>
          <div className="flex items-center gap-2">
            <span>Open:</span>
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px]">↵</kbd>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
