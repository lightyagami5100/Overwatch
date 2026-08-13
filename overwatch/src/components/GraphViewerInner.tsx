"use client";

import { useCallback, useMemo, useRef } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import { RotateCcw, Maximize2, Download } from "lucide-react";
import type { GraphData, GraphNode } from "@/lib/types";

interface GraphViewerInnerProps {
  graphData: GraphData;
  onNodeClick: (node: GraphNode) => void;
  width: number;
  height: number;
}

// Apple minimalist palette
const THREAT_COLORS: Record<string, number> = {
  CRITICAL: 0xff3b30,    // iOS Red
  SUSPICIOUS: 0xff9f0a,  // iOS Orange
  BENIGN: 0x34c759,      // iOS Green
};

export function GraphViewerInner({
  graphData,
  onNodeClick,
  width,
  height,
}: GraphViewerInnerProps) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // Memoize graph data to prevent unnecessary re-renders
  const data = useMemo(
    () => ({
      nodes: graphData.nodes.map((n) => ({ ...n })),
      links: graphData.links.map((l) => ({ ...l })),
    }),
    [graphData]
  );

  const handleNodeClick = useCallback(
    (node: object) => {
      const graphNode = node as GraphNode;
      onNodeClick(graphNode);

      // Fly camera to node
      if (fgRef.current && graphNode.x !== undefined) {
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(graphNode.x!, graphNode.y!, graphNode.z!);
        fgRef.current.cameraPosition(
          {
            x: graphNode.x! * distRatio,
            y: graphNode.y! * distRatio,
            z: graphNode.z! * distRatio,
          },
          { x: graphNode.x!, y: graphNode.y!, z: graphNode.z! },
          1000
        );
      }
    },
    [onNodeClick]
  );

  const handleResetView = useCallback(() => {
    fgRef.current?.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
  }, []);

  const handleZoomToFit = useCallback(() => {
    fgRef.current?.zoomToFit(500, 50);
  }, []);

  // Custom node rendering with Three.js — Clean minimalist geometry
  const nodeThreeObject = useCallback((node: object) => {
    const n = node as GraphNode;
    const color = THREAT_COLORS[n.threat_level] || 0x007aff; // Default to iOS Blue
    const size = n.threat_level === "CRITICAL" ? 8 : n.threat_level === "SUSPICIOUS" ? 6 : 4.5;

    const group = new THREE.Group();

    // 1. Inner Core (Solid, Smooth)
    const coreGeo = new THREE.SphereGeometry(size, 32, 32);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      emissive: color,
      emissiveIntensity: 0.2,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Add text label
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 128;
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw label - Apple style (clean sans-serif, white)
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    const text = n.label.length > 25 ? n.label.slice(0, 23) + "…" : n.label;
    
    // Add subtle shadow for legibility
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(60, 15, 1);
    sprite.position.set(0, size + 10, 0);
    group.add(sprite);

    return group;
  }, []);

  // Custom link rendering
  const linkColor = useCallback(() => "rgba(255, 255, 255, 0.2)", []); 
  const linkWidth = useCallback(() => 1.5, []);

  if (data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
            <svg
              className="w-8 h-8 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
          </div>
          <p className="text-sm text-white/60 font-medium">No entities loaded</p>
          <p className="text-xs text-white/40">
            Submit an intelligence report to map entities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)" // Transparent to see background image
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={handleNodeClick}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.4}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => "#ffffff"} 
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        warmupTicks={50}
        cooldownTicks={100}
      />

      {/* Floating Controls - Apple Glass Style */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleResetView}
          title="Reset View"
          className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomToFit}
          title="Zoom to Fit"
          className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          title="Export Graph"
          className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
