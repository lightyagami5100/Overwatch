"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, BookOpen, Cpu, Wrench, PlayCircle } from "lucide-react";

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDemo: () => void;
}

export function ManualModal({ isOpen, onClose, onStartDemo }: ManualModalProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const pages = [
    {
      title: "System Brief",
      icon: <BookOpen className="w-5 h-5 text-indigo-400" />,
      content: (
        <div className="space-y-4 text-white/80 text-sm leading-relaxed">
          <p>
            <strong className="text-white">DeepTrace (Overwatch)</strong> is an advanced AI-powered Incident Command & OSINT Evidence Platform.
          </p>
          <p>
            Designed for cyber threat intelligence, it allows analysts to ingest target data (domains, IPs, emails) and perform rapid intelligence gathering using specialized tools.
          </p>
          <p>
            The system visualizes intelligence relationships in a live 3D Node Graph, turning fragmented data into actionable insights instantly.
          </p>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 mt-4">
            <h4 className="font-semibold text-white mb-2">Key Workflows:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Target Ingestion:</strong> Start by entering an IP or domain in the left sidebar.</li>
              <li><strong>Live Terminal:</strong> Monitor backend AI and OSINT execution in real-time.</li>
              <li><strong>Evidence Vault:</strong> Automatically saves structured case files for later review.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Technical Architecture",
      icon: <Cpu className="w-5 h-5 text-purple-400" />,
      content: (
        <div className="space-y-4 text-white/80 text-sm leading-relaxed">
          <p>
            The system is built on a high-performance decoupled architecture designed for rapid OSINT execution.
          </p>
          <div className="space-y-3 mt-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-white block mb-1">Frontend (Next.js & React)</strong>
              Utilizes Framer Motion for liquid-smooth animations, TailwindCSS for "Apple Glass" UI aesthetics, and specialized WebGL rendering for the 3D entity correlation graph.
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-white block mb-1">Backend (FastAPI & Python)</strong>
              Asynchronous Python backend that orchestrates plugin-based OSINT modules, executing multiple network tools in parallel to reduce scan times.
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-white block mb-1">AI Engine (Nova & Ollama)</strong>
              Integrates localized AI models to analyze data streams natively without exposing sensitive case files to external public APIs.
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Tools & Libraries",
      icon: <Wrench className="w-5 h-5 text-emerald-400" />,
      content: (
        <div className="space-y-4 text-white/80 text-sm leading-relaxed">
          <p>
            DeepTrace utilizes an array of powerful OSINT plugins and libraries to gather intelligence automatically:
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-indigo-300">Nmap</strong>
              <p className="text-xs mt-1">Network mapping and port scanning for attack surface analysis.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-emerald-300">Dig / NSLookup</strong>
              <p className="text-xs mt-1">Extracts DNS records, MX routing, and nameserver configurations.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-purple-300">WhatWeb</strong>
              <p className="text-xs mt-1">Fingerprints web technologies, CMS versions, and server headers.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-blue-300">Holehe</strong>
              <p className="text-xs mt-1">Cross-references email addresses across 100+ social media platforms.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 col-span-2">
              <strong className="text-pink-300">Traceroute & Wayback Machine</strong>
              <p className="text-xs mt-1">Maps physical network hops and retrieves historical web snapshots.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, pages.length - 1));
  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 0));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              {pages[currentPage].icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white apple-heading">{pages[currentPage].title}</h2>
              <p className="text-xs text-white/50 tracking-wider uppercase font-semibold">DeepTrace Operations Manual</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with Swipe/Pagination */}
        <div className="p-6 relative min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 p-6"
            >
              {pages[currentPage].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer & Controls */}
        <div className="flex items-center justify-between p-5 border-t border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentPage === 0}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-white/50 px-2">
              Page {currentPage + 1} of {pages.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === pages.length - 1}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              onStartDemo();
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105"
          >
            <PlayCircle className="w-4 h-4" />
            Start Live Demo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
