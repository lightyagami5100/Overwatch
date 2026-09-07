"use client";

import { useState } from "react";
import {
  Network,
  Sliders,
  Binary,
  Bot,
  Search,
  Command,
  Image as ImageIcon,
  ChevronDown,
  Book,
  Shield,
  Zap,
  Activity,
  Radio
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TopNavProps {
  activeMode: "graph" | "tools" | "ciphers";
  onModeChange: (mode: "graph" | "tools" | "ciphers") => void;
  onOpenCommandPalette: () => void;
  onOpenAiAnalyst: () => void;
  wallpapers: string[];
  currentWallpaper: string;
  onWallpaperChange: (wp: string) => void;
  onOpenManual: () => void;
  toolCount: number;
  isBackendConnected?: boolean;
}

export function TopNav({
  activeMode,
  onModeChange,
  onOpenCommandPalette,
  onOpenAiAnalyst,
  wallpapers,
  currentWallpaper,
  onWallpaperChange,
  onOpenManual,
  toolCount,
  isBackendConnected = true,
}: TopNavProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <>
      <header className="h-16 apple-glass sticky top-0 z-50 flex items-center justify-between px-4 lg:px-6 rounded-none border-t-0 border-x-0 border-b border-white/10 backdrop-blur-3xl bg-black/40">
        
        {/* Left: Brand + Navigation Mode Selector */}
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-600/30 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] backdrop-blur-md border border-indigo-500/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" stroke="#818cf8" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="12" cy="12" r="3" fill="#818cf8" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-caesar leading-none">
                  Overwatch
                </h1>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                  v4.0
                </span>
              </div>
              <span className="text-[10px] text-white/40 font-mono flex items-center gap-1.5">
                {isBackendConnected ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LOCAL ENGINE OPERATIONAL</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-amber-300">BACKEND CONNECTING...</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-6 bg-white/10" />

          {/* Workspace Mode Tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => onModeChange("graph")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeMode === "graph"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden md:inline">3D Threat Graph</span>
              <span className="md:hidden">Graph</span>
            </button>

            <button
              onClick={() => onModeChange("tools")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeMode === "tools"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Omni-Tool Hub</span>
              <span className="md:hidden">Tools</span>
              {toolCount > 0 && (
                <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded font-mono ml-0.5">
                  {toolCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onModeChange("ciphers")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeMode === "ciphers"
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cipher & Matrix Lab</span>
              <span className="md:hidden">Ciphers</span>
            </button>
          </div>
        </div>

        {/* Right: Quick Search Cmd+K, AI Analyst, Wallpaper, Creator */}
        <div className="flex items-center gap-2 lg:gap-3">
          
          {/* Quick Command Palette Button */}
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all text-xs font-medium shadow-inner"
            title="Quick Command Palette (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden lg:inline">Command Palette</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-black/40 rounded text-[9px] font-mono text-white/40 border border-white/10">
              ⌘K
            </kbd>
          </button>

          {/* AI Threat Analyst Button */}
          <button
            onClick={onOpenAiAnalyst}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 transition-all text-xs font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            title="Nova AI Threat Analyst"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Nova AI Analyst</span>
          </button>

          {/* Operations Manual */}
          <button
            onClick={onOpenManual}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all text-xs font-medium"
            title="Operations Manual"
          >
            <Book className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Manual</span>
          </button>

          {/* Wallpaper Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all text-xs font-medium"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline max-w-[80px] truncate">{currentWallpaper || "Theme"}</span>
              <ChevronDown className="w-3 h-3 text-white/50" />
            </button>
          </div>

          {/* Creator Badge */}
          <div className="hidden 2xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/20 shadow-[0_0_15px_rgba(168,85,247,0.3)] backdrop-blur-xl relative overflow-hidden group">
            <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase font-caesar">CREATED BY</span>
            <span className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 font-caesar">
              Abdul Rahman Gilani
            </span>
          </div>

        </div>
      </header>

      {/* Wallpaper Menu Modal */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[70px] right-4 lg:right-6 w-64 max-h-[70vh] overflow-y-auto custom-scrollbar apple-glass border border-white/20 rounded-2xl shadow-2xl p-2 z-[9999]"
          >
            <div className="text-xs font-bold text-white/50 uppercase tracking-wider px-2 mb-2">Wallpapers</div>
            {wallpapers.map((wp) => (
              <button
                key={wp}
                onClick={() => {
                  onWallpaperChange(wp);
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all truncate ${
                  currentWallpaper === wp
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold"
                    : "text-white/80 hover:bg-white/10 border border-transparent"
                }`}
              >
                {wp}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
