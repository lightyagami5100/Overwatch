/**
 * Central state management hook for the DeepTrace dashboard.
 * Manages graph data, terminal logs, vault files, and entity inspection.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { processIntel, getCaseFiles, getCaseFile, deleteCaseFile } from "@/lib/api";
import { speakSummary } from "@/lib/speech";
import type {
  AgentLog,
  CaseFile,
  GraphData,
  GraphNode,
  ProcessedIntel,
} from "@/lib/types";

export function useDeepTrace() {
  // Graph state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<AgentLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Vault state
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  /**
   * Load case files from the vault on mount.
   */
  const loadCaseFiles = useCallback(async () => {
    try {
      const files = await getCaseFiles();
      setCaseFiles(files);
    } catch (err) {
      console.error("Failed to load case files:", err);
    }
  }, []);

  useEffect(() => {
    loadCaseFiles();
  }, [loadCaseFiles]);

  /**
   * Submit raw intelligence text for processing.
   * Streams agent logs in real-time, then updates graph and vault.
   */
  const submitIntel = useCallback(async (rawText: string) => {
    setIsProcessing(true);
    setError(null);
    setTerminalLogs([]);
    setSelectedNode(null);

    await processIntel(
      rawText,
      // onLog: append each agent log line
      (log: AgentLog) => {
        setTerminalLogs((prev) => [...prev, log]);
      },
      // onResult: update graph data and refresh vault
      (result: ProcessedIntel) => {
        setGraphData({
          nodes: result.nodes,
          links: result.links,
        });
        setActiveCaseId(result.case_file_id);
        // Refresh vault list
        loadCaseFiles();
        
        // Speak the summary when done
        speakSummary(result.threat_level, result.nodes.length, result.links.length);
      },
      // onError
      (errorMsg: string) => {
        setError(errorMsg);
        setTerminalLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString().slice(11, 19),
            agent: "SYSTEM",
            message: `ERROR: ${errorMsg}`,
            level: "ERROR" as const,
          },
        ]);
      }
    );

    setIsProcessing(false);
  }, [loadCaseFiles]);

  /**
   * Load a specific case file's graph data.
   */
  const loadCaseGraph = useCallback(async (caseFileId: string) => {
    try {
      const detail = await getCaseFile(caseFileId);
      setGraphData({
        nodes: detail.nodes,
        links: detail.links,
      });
      setActiveCaseId(caseFileId);
      setSelectedNode(null);
      
      // Speak summary when loading from vault
      speakSummary(detail.threat_level, detail.nodes.length, detail.links.length);
    } catch (err) {
      console.error("Failed to load case graph:", err);
    }
  }, []);

  /**
   * Delete a case file and refresh vault.
   */
  const removeCaseFile = useCallback(async (caseFileId: string) => {
    try {
      await deleteCaseFile(caseFileId);
      if (activeCaseId === caseFileId) {
        setGraphData({ nodes: [], links: [] });
        setActiveCaseId(null);
      }
      await loadCaseFiles();
    } catch (err) {
      console.error("Failed to delete case file:", err);
    }
  }, [activeCaseId, loadCaseFiles]);

  /**
   * Select a node for inspection.
   */
  const selectNode = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  return {
    // State
    graphData,
    selectedNode,
    terminalLogs,
    isProcessing,
    caseFiles,
    activeCaseId,
    error,
    loadCaseFiles,

    // Actions
    submitIntel,
    selectNode,
    loadCaseGraph,
    removeCaseFile,
  };
}
