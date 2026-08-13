/**
 * TypeScript interfaces matching backend Pydantic schemas.
 * Used throughout the frontend for type-safe data handling.
 */

export interface GraphNode {
  id: string;
  label: string;
  entity_type: "IP" | "EMAIL" | "DOMAIN" | "ORG" | "PERSON" | "GPE" | "CVE" | "HASH";
  threat_level: "CRITICAL" | "SUSPICIOUS" | "BENIGN";
  group: number;
  tool_results?: string;
  // react-force-graph adds these at runtime
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relationship: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ProcessedIntel {
  nodes: GraphNode[];
  links: GraphLink[];
  report_hash: string;
  case_file_id: string;
  filename: string;
  threat_level: "CRITICAL" | "SUSPICIOUS" | "BENIGN";
  created_at: string;
}

export interface CaseFile {
  id: string;
  filename: string;
  sha256_hash: string;
  threat_level: "CRITICAL" | "SUSPICIOUS" | "BENIGN";
  created_at: string;
  node_count: number;
  link_count: number;
}

export interface CaseFileDetail {
  id: string;
  filename: string;
  content: string;
  sha256_hash: string;
  threat_level: "CRITICAL" | "SUSPICIOUS" | "BENIGN";
  created_at: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface AgentLog {
  timestamp: string;
  agent: string;
  message: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}

export type ThreatLevel = "CRITICAL" | "SUSPICIOUS" | "BENIGN";

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: "#ef4444",
  SUSPICIOUS: "#fbbf24",
  BENIGN: "#22d3ee",
};

export const THREAT_GLOW: Record<ThreatLevel, string> = {
  CRITICAL: "0 0 15px rgba(239,68,68,0.5)",
  SUSPICIOUS: "0 0 15px rgba(251,191,36,0.5)",
  BENIGN: "0 0 15px rgba(34,211,238,0.5)",
};

export const ENTITY_ICONS: Record<string, string> = {
  IP: "🌐",
  EMAIL: "📧",
  DOMAIN: "🔗",
  ORG: "🏢",
  PERSON: "👤",
  GPE: "📍",
  CVE: "⚠️",
  HASH: "🔑",
};

export interface ToolMeta {
  name: string;
  display_name: string;
  category: string;
  speed: "fast" | "medium" | "slow";
  danger_level: "safe" | "caution" | "dangerous";
  description: string;
  entity_type: string[];
}

export interface ToolCategoriesResponse {
  categories: Record<string, ToolMeta[]>;
  total_tools: number;
}
