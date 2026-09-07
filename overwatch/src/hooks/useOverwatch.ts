/**
 * Central state management hook for the DeepTrace / Overwatch dashboard.
 * Manages graph data, terminal logs, vault files, entity inspection, and connection state.
 */

"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  processIntel,
  getCaseFiles,
  getCaseFile,
  deleteCaseFile,
  checkBackendHealth,
} from "@/lib/api";
import { speakSummary } from "@/lib/speech";
import type {
  AgentLog,
  CaseFile,
  GraphData,
  GraphNode,
  ProcessedIntel,
} from "@/lib/types";

export function useOverwatch() {
  // Graph state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<AgentLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Vault state
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  // Error & Connectivity state
  const [error, setError] = useState<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const prevConnectedRef = useRef<boolean>(true);

  /**
   * Load case files from the vault.
   */
  const loadCaseFiles = useCallback(async () => {
    try {
      const files = await getCaseFiles();
      setCaseFiles(files);
    } catch (err: any) {
      console.warn("[Overwatch] Note: Could not load case files:", err?.message || err);
    }
  }, []);

  /**
   * Initial load & health monitor to auto-reconnect when backend comes online.
   */
  useEffect(() => {
    loadCaseFiles();

    const checkHealth = async () => {
      const health = await checkBackendHealth();
      setIsBackendConnected(health.online);

      // If transition from offline to online, reload vault data
      if (health.online && !prevConnectedRef.current) {
        loadCaseFiles();
      }
      prevConnectedRef.current = health.online;
    };

    checkHealth();
    const interval = setInterval(checkHealth, isBackendConnected ? 15000 : 4000);
    return () => clearInterval(interval);
  }, [loadCaseFiles, isBackendConnected]);

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
    } catch (err: any) {
      console.warn("[Overwatch] Could not load case graph:", err?.message || err);
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
    } catch (err: any) {
      console.warn("[Overwatch] Could not delete case file:", err?.message || err);
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
    isBackendConnected,
    loadCaseFiles,

    // Actions
    submitIntel,
    selectNode,
    loadCaseGraph,
    removeCaseFile,
  };
}

