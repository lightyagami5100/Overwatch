/**
 * API client for interacting with the Overwatch FastAPI backend.
 * Provides resilient typed methods with error handling, connection fallbacks, and real-time SSE streaming.
 */

import type {
  CaseFile,
  CaseFileDetail,
  ProcessedIntel,
  AgentLog,
  ToolCategoriesResponse,
  ToolMeta,
  CorrelationItem,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const SERVER_BASE = API_BASE.replace(/\/api\/?$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Robust fetch wrapper with timeout, retry backoff for GETs, and graceful offline fallback.
 */
async function safeFetch<T>(
  url: string,
  options: RequestInit = {},
  fallback?: T,
  retries = 1,
  timeoutMs = 8000
): Promise<T> {
  const isGet = !options.method || options.method.toUpperCase() === "GET";
  const maxAttempts = isGet ? retries : 0;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new ApiError(res.status, errorText || `HTTP ${res.status}: ${res.statusText}`);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isLastAttempt = attempt === maxAttempts;
      if (!isLastAttempt) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }

      // If a fallback is provided and it was a network/offline error, return fallback quietly
      if (fallback !== undefined) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[Overwatch API] Backend unreachable for ${url} (using fallback state).`);
        }
        return fallback;
      }

      if (err.name === "AbortError") {
        throw new ApiError(408, `Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  return fallback as T;
}

/**
 * Check if the backend API is online and responding.
 */
export async function checkBackendHealth(): Promise<{ online: boolean; status?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${SERVER_BASE}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { online: true, status: data.status || "operational" };
    }
    return { online: false };
  } catch {
    return { online: false };
  }
}

/**
 * Submit raw intelligence text and stream logs + result via SSE.
 */
export function processIntelStream(
  rawText: string,
  onLog: (log: AgentLog) => void,
  onResult: (result: ProcessedIntel) => void,
  onError: (error: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE}/process-intel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new ApiError(response.status, `HTTP error ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/^event:\s*(\w+)/m);
          const dataMatch = block.match(/^data:\s*(.+)/m);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1];
            try {
              const data = JSON.parse(dataMatch[1]);
              if (eventType === "log") {
                onLog(data as AgentLog);
              } else if (eventType === "result") {
                onResult(data as ProcessedIntel);
              }
            } catch (parseErr) {
              console.warn("Failed to parse SSE event data:", parseErr);
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError(err.message || String(err));
      }
    });

  return () => controller.abort();
}

// Alias for useOverwatch hook compatibility
export const processIntel = processIntelStream;

/**
 * Upload log/data file for intelligence extraction.
 */
export async function uploadIntelFile(file: File): Promise<{
  case_file_id: string;
  filename: string;
  entity_count: number;
  threat_level: string;
  sha256_hash: string;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/intel/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new ApiError(res.status, errorText || res.statusText);
  }
  return res.json();
}

/**
 * Fetch all case files with fallback to empty array if backend is starting up.
 */
export async function getCaseFiles(): Promise<CaseFile[]> {
  return safeFetch<CaseFile[]>(`${API_BASE}/case-files`, {}, []);
}

/**
 * Fetch a single case file with full graph data.
 */
export async function getCaseFile(id: string): Promise<CaseFileDetail> {
  return safeFetch<CaseFileDetail>(`${API_BASE}/case-files/${id}`);
}

/**
 * Delete a case file by ID.
 */
export async function deleteCaseFile(id: string): Promise<{ status: string; id: string }> {
  return safeFetch<{ status: string; id: string }>(`${API_BASE}/case-files/${id}`, {
    method: "DELETE",
  });
}

/**
 * Export a cryptographically sealed case report.
 */
export async function exportCaseReport(id: string, format = "markdown"): Promise<string> {
  const res = await fetch(`${API_BASE}/case-files/${id}/export?format=${format}`);
  if (!res.ok) throw new Error("Export failed");
  return res.text();
}

/**
 * Fetch cross-case correlations.
 */
export async function getCrossCaseCorrelations(): Promise<{
  correlations: CorrelationItem[];
  total_overlapping_iocs: number;
}> {
  return safeFetch<{
    correlations: CorrelationItem[];
    total_overlapping_iocs: number;
  }>(`${API_BASE}/correlations`, {}, { correlations: [], total_overlapping_iocs: 0 });
}

/**
 * Fetch all tools grouped by category.
 */
export async function getToolCategories(entityType?: string): Promise<ToolCategoriesResponse> {
  const url = entityType
    ? `${API_BASE}/tools/categories?entity_type=${encodeURIComponent(entityType)}`
    : `${API_BASE}/tools/categories`;
  return safeFetch<ToolCategoriesResponse>(url, {}, { categories: {}, total_tools: 0 });
}

/**
 * Fetch all tools (cataloged + BlackArch) with graceful offline fallback.
 */
export async function getAllTools(): Promise<{
  tools: ToolMeta[];
  total: number;
  installed_count: number;
  categories: Record<string, ToolMeta[]>;
}> {
  const defaultTools = { tools: [], total: 0, installed_count: 0 };
  const defaultCats = { categories: {}, total_tools: 0 };

  const [allRes, catRes] = await Promise.all([
    safeFetch<{ tools: ToolMeta[]; total: number; installed_count: number }>(
      `${API_BASE}/tools/all`,
      {},
      defaultTools
    ),
    safeFetch<{ categories: Record<string, ToolMeta[]>; total_tools: number }>(
      `${API_BASE}/tools/categories`,
      {},
      defaultCats
    ),
  ]);

  return {
    tools: allRes.tools || [],
    total: allRes.total || 0,
    installed_count: allRes.installed_count || 0,
    categories: catRes.categories || {},
  };
}

/**
 * Search tools by query/category.
 */
export async function searchTools(
  query = "",
  category?: string,
  entityType?: string
): Promise<{ results: ToolMeta[]; count: number }> {
  const params = new URLSearchParams();
  if (query) params.append("q", query);
  if (category) params.append("category", category);
  if (entityType) params.append("entity_type", entityType);

  return safeFetch<{ results: ToolMeta[]; count: number }>(
    `${API_BASE}/tools/search?${params.toString()}`,
    {},
    { results: [], count: 0 }
  );
}

/**
 * Execute a tool with live SSE output streaming and optional timeout override.
 */
export function executeToolStream(
  toolName: string,
  target: string,
  customFlags: string | undefined,
  timeout: number | undefined,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE}/tools/execute-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool_name: toolName,
      target,
      custom_flags: customFlags,
      timeout,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Execution error: ${response.statusText}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;
          if (block.includes("[DONE]")) {
            onComplete();
            return;
          }
          const match = block.match(/^data:\s*(.+)/m);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.chunk) onChunk(parsed.chunk);
            } catch {
              onChunk(match[1]);
            }
          }
        }
      }
      onComplete();
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err);
    });

  return () => controller.abort();
}

/**
 * Register a custom tool recipe.
 */
export async function registerCustomTool(
  toolDef: Partial<ToolMeta>
): Promise<{ status: string; tool: ToolMeta }> {
  return safeFetch<{ status: string; tool: ToolMeta }>(`${API_BASE}/tools/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toolDef),
  });
}

/**
 * Execute a category of tools against a node.
 */
export async function executeTool(
  nodeId: string,
  category: string
): Promise<{ status: string; tool_results: string }> {
  return safeFetch<{ status: string; tool_results: string }>(`${API_BASE}/tools/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId, category }),
  });
}

/**
 * AI Threat Analyst Chat.
 */
export async function sendAIChat(
  prompt: string,
  caseFileId?: string
): Promise<{ response: string; model: string }> {
  return safeFetch<{ response: string; model: string }>(`${API_BASE}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, case_file_id: caseFileId }),
  });
}

