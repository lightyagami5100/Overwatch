"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  X,
  Sparkles,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Zap,
  Terminal,
  Cpu,
  Layers
} from "lucide-react";
import { sendAIChat } from "@/lib/api";
import type { AIChatMessage, GraphData, CaseFile } from "@/lib/types";

interface AiAnalystModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCaseId: string | null;
  graphData: GraphData;
  activeCase?: CaseFile | null;
}

export function AiAnalystModal({
  isOpen,
  onClose,
  activeCaseId,
  graphData,
  activeCase,
}: AiAnalystModalProps) {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: "initial",
      role: "analyst",
      content:
        "Greetings Commander. I am **Nova**, your local autonomous Cyber Threat Analyst and Incident Commander. I have analyzed your active case graph and stand ready to synthesize threat vectors, map MITRE ATT&CK techniques, and plan pivoting actions.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim() || isTyping) return;

    const userMsg: AIChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setIsTyping(true);

    try {
      const res = await sendAIChat(promptToSend, activeCaseId || undefined);
      const botMsg: AIChatMessage = {
        id: String(Date.now() + 1),
        role: "analyst",
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      const errBotMsg: AIChatMessage = {
        id: String(Date.now() + 1),
        role: "analyst",
        content: `[ERROR] AI analysis failed: ${e.message}. Please ensure Ollama is accessible or check local fallback.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errBotMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-3 md:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="w-full max-w-4xl h-[90vh] apple-glass border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
      >
        {/* Header */}
        <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between backdrop-blur-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Nova AI Threat Analyst
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-mono rounded uppercase tracking-wider border border-indigo-500/30">
                  Zero-Trust Local Engine
                </span>
              </h2>
              <p className="text-xs text-white/50">
                {activeCase
                  ? `Correlated with Case: ${activeCase.filename} (${graphData.nodes.length} nodes)`
                  : "General Defensive Intelligence Mode"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Pivot Prompt Chips */}
        <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 text-xs">
          <span className="text-white/40 font-mono text-[10px] uppercase tracking-wider mr-1">
            Pivots:
          </span>
          <button
            onClick={() => handleSend("Summarize the primary attack vectors, affected assets, and severity level based on the graph entities.")}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 whitespace-nowrap text-xs transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3 h-3 text-red-400" />
            Threat Summary
          </button>
          <button
            onClick={() => handleSend("Map all extracted IOCs and domains in this case to MITRE ATT&CK Enterprise Matrix techniques.")}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 whitespace-nowrap text-xs transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3 h-3 text-purple-400" />
            MITRE ATT&CK Mapping
          </button>
          <button
            onClick={() => handleSend("Provide a 5-step Incident Response remediation playbook to isolate and contain these compromised indicators.")}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 whitespace-nowrap text-xs transition-all flex items-center gap-1.5"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            Containment Playbook
          </button>
          <button
            onClick={() => handleSend("Which specific native OSINT/Recon tools should I execute next to pivot on the discovered IP addresses and domains?")}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 whitespace-nowrap text-xs transition-all flex items-center gap-1.5"
          >
            <Terminal className="w-3 h-3 text-cyan-400" />
            Recommended Tools
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4 bg-black/30">
          {messages.map((msg) => {
            const isAnalyst = msg.role === "analyst";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAnalyst ? "justify-start" : "justify-end"}`}
              >
                {isAnalyst && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative group max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-lg ${
                    isAnalyst
                      ? "bg-white/10 border border-white/10 text-white/95"
                      : "bg-indigo-600 text-white rounded-br-none"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[10px] text-white/40 font-mono">
                    <span className="font-bold text-white/70">
                      {isAnalyst ? "NOVA ANALYST" : "COMMANDER"}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {/* Copy snippet button */}
                  <button
                    onClick={() => copyText(msg.content, msg.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-black/40 hover:bg-black/60 rounded-md text-white/50 hover:text-white transition-opacity"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 items-center text-white/40 text-xs font-mono">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <span className="flex items-center gap-1">
                Nova is synthesizing threat intelligence
                <span className="animate-pulse">...</span>
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-black/50 border-t border-white/10 flex items-center gap-3 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Nova about threats, IOCs, pivots, or containment actions..."
            className="flex-1 h-11 bg-black/60 border border-white/10 rounded-2xl px-4 text-xs text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
          />

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="h-11 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 uppercase tracking-wider"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Transmit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
