"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import {
  RotateCcw,
  Maximize2,
  Download,
  Search,
  Filter,
  Layers,
  Shield,
  Eye,
  Crosshair,
  Check
} from "lucide-react";
import type { GraphData, GraphNode, ThreatLevel, EntityType } from "@/lib/types";

interface GraphViewerInnerProps {
  graphData: GraphData;
  onNodeClick: (node: GraphNode) => void;
  width: number;
  height: number;
}

const THREAT_COLORS: Record<string, number> = {
  CRITICAL: 0xff3b30,   // iOS Red
  SUSPICIOUS: 0xff9f0a, // iOS Orange
  BENIGN: 0x34c759,     // iOS Green
};

const ENTITY_EMOJIS: Record<string, string> = {
  IP: "🌐",
  CIDR: "🖧",
  DOMAIN: "🔗",
  EMAIL: "📧",
  ORG: "🏢",
  PERSON: "👤",
  CVE: "⚠️",
  MITRE: "⚔️",
  HASH: "🔑",
  WALLET: "💰",
  FILE: "📁",
};

export function GraphViewerInner({
  graphData,
  onNodeClick,
  width,
  height,
}: GraphViewerInnerProps) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // Filter & Search states
  const [filterThreat, setFilterThreat] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [is2DMode, setIs2DMode] = useState<boolean>(false);
  const [exported, setExported] = useState<boolean>(false);

  // Filtered dataset
  const filteredData = useMemo(() => {
    let nodes = graphData.nodes.map((n) => ({ ...n }));
    if (filterThreat !== "ALL") {
      nodes = nodes.filter((n) => n.threat_level === filterThreat);
    }
    if (filterType !== "ALL") {
      nodes = nodes.filter((n) => n.entity_type === filterType);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.links
      .filter((l) => {
        const srcId = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
        const tgtId = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
        return nodeIds.has(srcId) && nodeIds.has(tgtId);
      })
      .map((l) => ({ ...l }));

    return { nodes, links };
  }, [graphData, filterThreat, filterType]);

  const handleNodeClick = useCallback(
    (node: object) => {
      const graphNode = node as GraphNode;
      onNodeClick(graphNode);

      // Fly camera to node
      if (fgRef.current && graphNode.x !== undefined) {
        const distance = is2DMode ? 200 : 120;
        const distRatio = 1 + distance / Math.hypot(graphNode.x!, graphNode.y!, graphNode.z || 1);
        fgRef.current.cameraPosition(
          {
            x: graphNode.x! * distRatio,
            y: graphNode.y! * distRatio,
            z: is2DMode ? 350 : (graphNode.z || 0) * distRatio,
          },
          { x: graphNode.x!, y: graphNode.y!, z: is2DMode ? 0 : graphNode.z || 0 },
          1000
        );
      }
    },
    [onNodeClick, is2DMode]
  );

  const handleResetView = useCallback(() => {
    fgRef.current?.cameraPosition({ x: 0, y: 0, z: is2DMode ? 400 : 300 }, { x: 0, y: 0, z: 0 }, 1000);
  }, [is2DMode]);

  const handleZoomToFit = useCallback(() => {
    fgRef.current?.zoomToFit(500, 60);
  }, []);

  const handleExportGraph = () => {
    const exportObj = {
      exported_at: new Date().toISOString(),
      nodes_count: filteredData.nodes.length,
      links_count: filteredData.links.length,
      nodes: filteredData.nodes,
      links: filteredData.links,
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `threat_graph_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const handleSearchFlyTo = (label: string) => {
    const found = filteredData.nodes.find((n) => n.label.toLowerCase().includes(label.toLowerCase()));
    if (found && fgRef.current && found.x !== undefined && found.y !== undefined) {
      onNodeClick(found);
      const targetZ = found.z ?? 0;
      fgRef.current.cameraPosition(
        { x: found.x * 1.5, y: found.y * 1.5, z: is2DMode ? 300 : targetZ * 1.5 },
        { x: found.x, y: found.y, z: is2DMode ? 0 : targetZ },
        1000
      );
    }
  };

  // Custom node rendering with Three.js
  const nodeThreeObject = useCallback((node: object) => {
    const n = node as GraphNode;
    const color = THREAT_COLORS[n.threat_level] || 0x007aff;
    const size = n.threat_level === "CRITICAL" ? 9 : n.threat_level === "SUSPICIOUS" ? 6.5 : 5;

    const group = new THREE.Group();

    // 1. Core Sphere
    const coreGeo = new THREE.SphereGeometry(size, 32, 32);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // 2. Halo ring for Critical nodes
    if (n.threat_level === "CRITICAL") {
      const ringGeo = new THREE.RingGeometry(size * 1.3, size * 1.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    // 3. Label Canvas Texture
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 512;
    canvas.height = 140;
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";

    const emoji = ENTITY_EMOJIS[n.entity_type] || "•";
    const text = `${emoji} ${n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label}`;

    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 10;
    ctx.fillText(text, 256, 70);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(65, 18, 1);
    sprite.position.set(0, size + 11, 0);
    group.add(sprite);

    return group;
  }, []);

  const linkColor = useCallback(() => "rgba(255, 255, 255, 0.25)", []);
  const linkWidth = useCallback(() => 1.5, []);

  const uniqueTypes = useMemo(() => {
    const types = new Set(graphData.nodes.map((n) => n.entity_type));
    return ["ALL", ...Array.from(types)];
  }, [graphData.nodes]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
            <Layers className="w-8 h-8 text-white/40" />
          </div>
          <p className="text-sm text-white/60 font-medium">No Entities Loaded in Active Graph</p>
          <p className="text-xs text-white/40">
            Submit intel or trigger an OSINT quick scan to map entities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={filteredData}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
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
        numDimensions={is2DMode ? 2 : 3}
        warmupTicks={40}
        cooldownTicks={100}
      />

      {/* Top Floating Filter Bar */}
      <div className="absolute top-4 left-6 right-20 flex items-center gap-2 overflow-x-auto custom-scrollbar z-20 pointer-events-auto pb-1">
        {/* Search Input in Graph */}
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Find entity..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) handleSearchFlyTo(e.target.value);
            }}
            className="h-8 bg-black/60 border border-white/15 backdrop-blur-md rounded-xl pl-8 pr-3 text-xs text-white placeholder:text-white/40 outline-none focus:border-indigo-500 w-36 md:w-48 shadow-lg font-medium"
          />
        </div>

        {/* Threat Level Filter Chips */}
        <div className="flex items-center gap-1 bg-black/60 border border-white/15 backdrop-blur-md p-1 rounded-xl shadow-lg shrink-0">
          {["ALL", "CRITICAL", "SUSPICIOUS", "BENIGN"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterThreat(t)}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterThreat === t
                  ? t === "CRITICAL"
                    ? "bg-red-500 text-white"
                    : t === "SUSPICIOUS"
                    ? "bg-amber-500 text-black"
                    : t === "BENIGN"
                    ? "bg-emerald-500 text-black"
                    : "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Entity Type Filter */}
        <div className="flex items-center gap-1 bg-black/60 border border-white/15 backdrop-blur-md p-1 rounded-xl shadow-lg shrink-0">
          {uniqueTypes.slice(0, 5).map((et) => (
            <button
              key={et}
              onClick={() => setFilterType(et)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                filterType === et
                  ? "bg-indigo-600 text-white font-bold shadow"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {et}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Control Buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 pointer-events-auto">
        <button
          onClick={handleResetView}
          title="Reset Camera View"
          className="p-2.5 bg-black/60 hover:bg-black/80 border border-white/15 text-white shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          onClick={handleZoomToFit}
          title="Zoom to Fit All Entities"
          className="p-2.5 bg-black/60 hover:bg-black/80 border border-white/15 text-white shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <button
          onClick={() => setIs2DMode(!is2DMode)}
          title={is2DMode ? "Switch to 3D Space" : "Switch to 2D Planar Projection"}
          className={`p-2.5 border border-white/15 shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95 font-bold text-xs ${
            is2DMode ? "bg-indigo-600 text-white" : "bg-black/60 hover:bg-black/80 text-white"
          }`}
        >
          {is2DMode ? "2D" : "3D"}
        </button>

        <button
          onClick={handleExportGraph}
          title="Export Graph to JSON"
          className="p-2.5 bg-black/60 hover:bg-black/80 border border-white/15 text-white shadow-lg backdrop-blur-md transition-all rounded-full active:scale-95"
        >
          {exported ? <Check className="h-4 w-4 text-green-400" /> : <Download className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
