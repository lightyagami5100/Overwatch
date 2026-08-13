"use client";

import { useState } from "react";
import { Search, Shield, Zap, Image as ImageIcon, ChevronDown, Book } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TopNavProps {
  wallpapers: string[];
  currentWallpaper: string;
  onWallpaperChange: (wp: string) => void;
  onOpenManual: () => void;
}

export function TopNav({ wallpapers, currentWallpaper, onWallpaperChange, onOpenManual }: TopNavProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <>
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
          <h1 className="text-2xl tracking-tight text-white font-caesar">
            Overwatch
          </h1>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs font-medium">
            v3.2
          </span>
        </div>

        <div className="w-px h-6 bg-white/10" />
      </div>

      {/* Right: Customization & Creator */}
      <div className="flex items-center gap-4">
        
        {/* Manual & Demo Toggle */}
        <button
          onClick={onOpenManual}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all text-sm font-medium"
          title="Operations Manual"
        >
          <Book className="w-4 h-4" />
          <span>Manual</span>
        </button>

        {/* Wallpaper Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all text-sm font-medium"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="max-w-[100px] truncate">{currentWallpaper || "Theme"}</span>
            <ChevronDown className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Liquid Glass Bubble for Creator */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/20 shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
          <span className="text-xs font-bold text-white/60 tracking-widest uppercase">CREATED BY</span>
          <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Abdul Rahman Gilani
          </span>
        </div>

      </div>
    </header>
    
    <AnimatePresence>
      {isDropdownOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-[72px] right-6 w-64 max-h-[70vh] overflow-y-auto custom-scrollbar apple-glass border border-white/20 rounded-2xl shadow-2xl p-2 z-[9999]"
        >
          <div className="text-xs font-bold text-white/50 uppercase tracking-wider px-2 mb-2">Wallpapers</div>
          {wallpapers.map((wp) => (
            <button
              key={wp}
              onClick={() => {
                onWallpaperChange(wp);
                setIsDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all truncate ${
                currentWallpaper === wp ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-white/80 hover:bg-white/10 border border-transparent"
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
