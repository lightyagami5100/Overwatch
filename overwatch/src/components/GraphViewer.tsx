/**
 * GraphViewer — Dynamic wrapper that imports the 3D graph with ssr: false.
 * This prevents hydration errors from react-force-graph-3d's WebGL dependency.
 */

"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode } from "@/lib/types";

const GraphViewerInner = dynamic(
  () => import("./GraphViewerInner").then((mod) => mod.GraphViewerInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-cyan-500/40 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-cyan-500/20" />
          </div>
          <p className="text-xs text-slate-500 font-mono">Initializing WebGL renderer...</p>
        </div>
      </div>
    ),
  }
);

interface GraphViewerProps {
  graphData: GraphData;
  onNodeClick: (node: GraphNode) => void;
}

export function GraphViewer({ graphData, onNodeClick }: GraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <GraphViewerInner
        graphData={graphData}
        onNodeClick={onNodeClick}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
}
