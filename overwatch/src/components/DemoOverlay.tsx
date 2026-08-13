"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X, MousePointer2 } from "lucide-react";

interface DemoOverlayProps {
  isActive: boolean;
  onClose: () => void;
}

export function DemoOverlay({ isActive, onClose }: DemoOverlayProps) {
  const [demoInfo, setDemoInfo] = useState<{ title: string; desc: string } | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDemoInfo(null);
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Look for the closest element with a data-demo-title attribute
      const demoElement = target.closest("[data-demo-title]");
      
      if (demoElement) {
        const title = demoElement.getAttribute("data-demo-title");
        const desc = demoElement.getAttribute("data-demo-desc");
        if (title && desc) {
          setDemoInfo({ title, desc });
        }
      }
    };

    // Use capture phase to ensure we intercept the click even if the element stops propagation
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed bottom-6 right-6 z-[9999] w-80 bg-black/80 backdrop-blur-3xl border border-indigo-500/30 shadow-[0_0_40px_rgba(79,70,229,0.2)] rounded-3xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-indigo-500/10">
            <div className="flex items-center gap-2 text-indigo-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <h3 className="font-bold text-sm tracking-wide">LIVE DEMO MODE</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 min-h-[120px] flex flex-col justify-center">
            {demoInfo ? (
              <motion.div
                key={demoInfo.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-bold text-white text-sm">{demoInfo.title}</h4>
                </div>
                <p className="text-white/70 text-xs leading-relaxed">
                  {demoInfo.desc}
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center opacity-50 space-y-3">
                <MousePointer2 className="w-8 h-8 text-white animate-bounce" />
                <p className="text-xs text-white">
                  Demo Mode Active.<br />Click any UI element to see its explanation.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
