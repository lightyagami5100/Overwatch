"use client";

import { useState } from "react";
import { Search, Shield, Zap } from "lucide-react";
import { QuickScanPanel } from "./QuickScanPanel";

export function TopNav() {
  const [isQuickScanOpen, setIsQuickScanOpen] = useState(false);

  return (
    <header className="h-16 apple-glass sticky top-0 z-50 flex items-center justify-between px-6 rounded-none border-t-0 border-x-0 border-b border-white/10 backdrop-blur-3xl bg-black/40">
      
      {/* Left: Logo & Actions */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shadow-sm backdrop-blur-md border border-white/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="12" cy="12" r="3" fill="white" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white apple-heading">
            Overwatch
          </h1>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs font-medium">
            v3.2
          </span>
        </div>

        <div className="w-px h-6 bg-white/10" />
      </div>

      {/* Right: Empty for now (future system status) */}
      <div className="flex items-center gap-4">
      </div>
    </header>
  );
}
