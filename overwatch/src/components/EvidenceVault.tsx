"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Database,
  ShieldCheck,
  Trash2,
  Download,
  Search,
  Layers,
  ExternalLink,
  ShieldAlert,
  ChevronDown
} from "lucide-react";
import type { CaseFile } from "@/lib/types";
import { exportCaseReport } from "@/lib/api";

interface EvidenceVaultProps {
  caseFiles: CaseFile[];
  activeCaseId: string | null;
  onSelectCase: (id: string) => void;
  onDeleteCase: (id: string) => void;
}

export function EvidenceVault({
  caseFiles,
  activeCaseId,
  onSelectCase,
  onDeleteCase,
}: EvidenceVaultProps) {
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    if (!search.trim()) return caseFiles;
    const q = search.toLowerCase();
    return caseFiles.filter(
      (c) =>
        c.filename.toLowerCase().includes(q) ||
        c.sha256_hash.toLowerCase().includes(q) ||
        c.threat_level.toLowerCase().includes(q)
    );
  }, [caseFiles, search]);

  const handleExport = async (
    e: React.MouseEvent,
    id: string,
    filename: string,
    format: "markdown" | "stix2" | "json"
  ) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setExportingId(id);
    try {
      const content = await exportCaseReport(id, format);
      let mimeType = "text/markdown";
      let ext = "_REPORT.md";

      if (format === "stix2") {
        mimeType = "application/json";
        ext = "_STIX2.json";
      } else if (format === "json") {
        mimeType = "application/json";
        ext = "_EVIDENCE.json";
      }

      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename.replace(/\.[^/.]+$/, "")}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold tracking-tight apple-heading">
            Evidence Vault
          </h2>
        </div>
        <div className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded uppercase tracking-widest border border-indigo-500/20">
          STIX 2.1 & SHA-256
        </div>
      </div>

      {/* Quick Search */}
      <div className="p-3 border-b border-white/5 bg-black/20 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter cases or hash..."
            className="w-full h-8 bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar min-h-0">
        {filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 py-8">
            <ShieldCheck className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">No Case Files Found</p>
          </div>
        ) : (
          filteredCases.map((cf) => {
            const isActive = cf.id === activeCaseId;
            const isMenuOpen = activeMenuId === cf.id;
            return (
              <div
                key={cf.id}
                onClick={() => onSelectCase(cf.id)}
                className={`
                  relative group cursor-pointer border rounded-2xl p-3.5 transition-all duration-300
                  ${
                    isActive
                      ? "bg-indigo-600/25 border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 truncate max-w-[190px]">
                    <FileText className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-400" : "text-white/60"}`} />
                    <span className="text-xs font-bold truncate text-white/90">
                      {cf.filename}
                    </span>
                  </div>
                  <span
                    className={`
                      text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider
                      ${
                        cf.threat_level === "CRITICAL"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : cf.threat_level === "SUSPICIOUS"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }
                    `}
                  >
                    {cf.threat_level}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/50 mt-2">
                  <div className="flex items-center gap-1 truncate max-w-[170px]">
                    <ShieldCheck className="w-3 h-3 text-white/30 shrink-0" />
                    <span className="truncate">{cf.sha256_hash}</span>
                  </div>
                  <span>{cf.node_count} nodes</span>
                </div>

                {/* Actions on Hover / Active */}
                <div className="flex items-center gap-1 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : cf.id);
                      }}
                      className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-full transition-all flex items-center gap-0.5"
                      title="Export Options"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {/* Export Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-8 z-30 w-44 bg-black/90 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl p-1.5 space-y-1">
                        <button
                          onClick={(e) => handleExport(e, cf.id, cf.filename, "markdown")}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/90 hover:bg-indigo-600 hover:text-white flex items-center justify-between"
                        >
                          <span>Markdown Report</span>
                          <span className="text-[9px] font-mono text-white/40">.md</span>
                        </button>
                        <button
                          onClick={(e) => handleExport(e, cf.id, cf.filename, "stix2")}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:bg-emerald-600 hover:text-white flex items-center justify-between"
                        >
                          <span>STIX 2.1 Bundle</span>
                          <span className="text-[9px] font-mono text-white/40">.json</span>
                        </button>
                        <button
                          onClick={(e) => handleExport(e, cf.id, cf.filename, "json")}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:bg-white/10 flex items-center justify-between"
                        >
                          <span>Raw Incident JSON</span>
                          <span className="text-[9px] font-mono text-white/40">.json</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCase(cf.id);
                    }}
                    className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-full transition-all"
                    title="Destroy Evidence"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
