"use client";

import { useState, useRef } from "react";
import { Loader2, Target, UploadCloud, FileText, Sparkles, FolderOpen, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface IngestionPanelProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

const SAMPLES = [
  {
    name: "APT-29 C2 Exfil",
    text: "INCIDENT REPORT: APT-29 Exfiltration detected from internal IP 10.0.14.55 communicating with C2 domain darknode-c2.ru on port 443. Credentials exfiltrated via admin@globecorp.com. Secondary beacon to 185.220.101.34 with payload hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. MITRE technique T1071.001."
  },
  {
    name: "Ransomware Lateral",
    text: "ALERT: Lateral movement observed across subnet 192.168.5.0/24. Source host 192.168.5.112 attempted 47 RDP sessions to 192.168.5.200. Account j.smith@internal.local compromised. Executable dropped: payload.exe with MD5 5d41402abc4b2a76b9719d911017c592. Attacker BTC wallet: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq."
  },
  {
    name: "OSINT Threat Actor",
    text: "TARGET DOSSIER: Threat actor handle cyber_phantom associated with domain breach-intel.xyz. Contact emails: shadow-sec@protonmail.com, operator@threat-vault.io. Infrastructure IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334. Exploiting CVE-2024-38077."
  }
];

export function IngestionPanel({ onSubmit, isProcessing }: IngestionPanelProps) {
  const [intelText, setIntelText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!intelText.trim() || isProcessing) return;
    onSubmit(intelText);
    setIntelText("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) setIntelText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold tracking-tight text-white/90">Target Intel</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.log,.json,.csv,.md"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors border border-white/10 flex items-center gap-1"
            title="Upload Log / Text File"
          >
            <FolderOpen className="w-3 h-3" />
            File
          </button>
        </div>
      </div>

      {/* Preset Samples */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2 mb-2 shrink-0">
        <span className="text-[10px] font-mono text-white/40 mr-1">Presets:</span>
        {SAMPLES.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setIntelText(s.text)}
            className="px-2 py-0.5 bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white rounded-md text-[10px] font-medium whitespace-nowrap transition-all"
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="flex-1 relative min-h-[140px]">
        <textarea
          value={intelText}
          onChange={(e) => setIntelText(e.target.value)}
          placeholder="Paste raw log data, incident reports, terminal dumps, or defanged IOCs..."
          className="w-full h-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-xs text-white/90 font-mono outline-none resize-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all custom-scrollbar shadow-inner"
          disabled={isProcessing}
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!intelText.trim() || isProcessing}
        className={twMerge(
          clsx(
            "mt-3 w-full h-11 flex items-center justify-center gap-2 font-bold text-xs rounded-xl transition-all active:scale-[0.98] uppercase tracking-wider shrink-0",
            isProcessing || !intelText.trim()
              ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/5 shadow-none"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          )
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            PROCESSING SWARM...
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            DISPATCH AI EXTRACTION SWARM
          </>
        )}
      </button>
    </div>
  );
}
