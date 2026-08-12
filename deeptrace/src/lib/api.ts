/**
 * API client for the DeepTrace backend.
 * Includes typed fetch wrappers and SSE stream reader for real-time logs.
 */

import type { AgentLog, CaseFile, CaseFileDetail, ProcessedIntel, ToolCategoriesResponse } from "./types";

const API_BASE = "http://localhost:8000/api";

/**
 * Process raw intelligence text via SSE streaming.
 * Yields agent logs in real-time, then returns the final processed result.
 */
export async function processIntel(
  rawText: string,
  onLog: (log: AgentLog) => void,
  onResult: (result: ProcessedIntel) => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/process-intel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errStr = errorData.detail || `HTTP ${response.status}`;
      if (Array.isArray(errStr)) {
        errStr = errStr.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      } else if (typeof errStr === "object") {
        errStr = JSON.stringify(errStr);
      }
      throw new Error(errStr);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from the buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the incomplete last line

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (currentEvent === "log") {
              onLog(parsed as AgentLog);
            } else if (currentEvent === "result") {
              onResult(parsed as ProcessedIntel);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    onError?.(message);
  }
}

/**
 * Fetch all case files from the evidence vault.
 */
export async function getCaseFiles(): Promise<CaseFile[]> {
  const response = await fetch(`${API_BASE}/case-files`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Fetch a single case file with its full graph data.
 */
export async function getCaseFile(id: string): Promise<CaseFileDetail> {
  const response = await fetch(`${API_BASE}/case-files/${id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Delete a case file from the vault.
 */
export async function deleteCaseFile(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/case-files/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/**
 * Execute a specific category of tools against a node.
 */
export async function executeTool(nodeId: string, category: string): Promise<{ status: string, tool_results: string }> {
  const response = await fetch(`${API_BASE}/tools/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId, category }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch available tool categories, optionally filtered by entity type.
 */
export async function getToolCategories(entityType?: string): Promise<ToolCategoriesResponse> {
  const params = entityType ? `?entity_type=${encodeURIComponent(entityType)}` : '';
  const response = await fetch(`${API_BASE}/tools/categories${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Fetch all tools available in the system, grouped by category.
 */
export async function getAllTools(): Promise<ToolCategoriesResponse> {
  const response = await fetch(`${API_BASE}/tools`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
