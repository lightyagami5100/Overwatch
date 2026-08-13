"use client";

import { FileText, Database, ShieldCheck, Trash2 } from "lucide-react";
import type { CaseFile } from "@/lib/types";

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
  return (
    <div className="flex flex-col h-full text-white">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold tracking-tight apple-heading">
            Evidence Vault
          </h2>
        </div>
        <div className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded uppercase tracking-widest border border-indigo-500/20">
          SHA-256 SECURED
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {caseFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <ShieldCheck className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Vault Empty</p>
          </div>
        ) : (
          caseFiles.map((cf) => {
            const isActive = cf.id === activeCaseId;
            return (
              <div
                key={cf.id}
                onClick={() => onSelectCase(cf.id)}
                className={`
                  relative group cursor-pointer border rounded-2xl p-4 transition-all duration-300
                  ${
                    isActive
                      ? "bg-indigo-600/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-white/60"}`} />
                    <span className="text-sm font-semibold truncate text-white/90">
                      {cf.filename}
                    </span>
                  </div>
                  <span
                    className={`
                      text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider
                      ${
                        cf.threat_level === "CRITICAL"
                          ? "bg-red-500/20 text-red-400"
                          : cf.threat_level === "SUSPICIOUS"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }
                    `}
                  >
                    {cf.threat_level}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-white/50 truncate">
                  <ShieldCheck className="w-3 h-3 text-white/30" />
                  {cf.sha256_hash}
                </div>

                {/* Delete button appears on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCase(cf.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400/0 group-hover:text-red-400 rounded-full transition-all duration-200"
                  title="Destroy Evidence"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
