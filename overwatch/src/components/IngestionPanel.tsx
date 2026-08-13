"use client";

import { useState } from "react";
import { Loader2, Target, UploadCloud } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface IngestionPanelProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

export function IngestionPanel({ onSubmit, isProcessing }: IngestionPanelProps) {
  const [intelText, setIntelText] = useState("");

  const handleSubmit = () => {
    if (!intelText.trim() || isProcessing) return;
    onSubmit(intelText);
    setIntelText("");
  };

  const loadSample = () => {
    setIntelText(
      "We are searching a person who has the email abdulrahmang5100@gmail.com and username gilan1090.x"
    );
  };

  return (
    <div className="flex flex-col h-full text-white">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold tracking-tight apple-heading">Target Intel</h2>
        </div>
        <button
          onClick={loadSample}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-[10px] font-semibold rounded-md uppercase tracking-wider transition-colors border border-white/5"
        >
          Load Sample
        </button>
      </div>

      <div className="flex-1 relative">
        <textarea
          value={intelText}
          onChange={(e) => setIntelText(e.target.value)}
          placeholder="Enter intelligence report, logs, or raw text here..."
          className="w-full h-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white/90 outline-none resize-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all custom-scrollbar shadow-inner"
          disabled={isProcessing}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!intelText.trim() || isProcessing}
        className={twMerge(
          clsx(
            "mt-4 w-full h-12 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl transition-all active:scale-[0.98]",
            isProcessing || !intelText.trim()
              ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/5 shadow-none"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
          )
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            PROCESSING...
          </>
        ) : (
          <>
            <UploadCloud className="w-5 h-5" />
            INITIATE NLP PROCESSING
          </>
        )}
      </button>
    </div>
  );
}
