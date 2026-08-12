"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type { AgentLog } from "@/lib/types";

interface TerminalFeedProps {
  logs: AgentLog[];
}

export function TerminalFeed({ logs }: TerminalFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full text-white">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold tracking-tight apple-heading">Terminal Feed</h2>
        </div>
        <div className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded uppercase tracking-widest border border-green-500/20 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Live
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-black/60 border border-white/10 p-4 rounded-2xl custom-scrollbar shadow-inner relative"
      >
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/30 font-mono text-sm">
            [ SYSTEM IDLE ]
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="font-mono text-xs leading-relaxed break-words text-gray-300">
                <span className="text-white/40">{log.timestamp}</span>{" "}
                <span className="text-blue-400 font-semibold">[{log.agent}]</span>{" "}
                <span
                  className={
                    log.level === "ERROR"
                      ? "text-red-400 font-semibold"
                      : log.level === "WARNING"
                      ? "text-yellow-400 font-semibold"
                      : log.level === "SUCCESS"
                      ? "text-green-400 font-semibold"
                      : "text-gray-300"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
