/**
 * LLM Generate Executor
 *
 * Unified executor for llmGenerate (text generation) nodes.
 * Used by both executeWorkflow and regenerateNode.
 */

import type { LLMGenerateNodeData } from "@/types";
import { buildLlmHeaders } from "@/store/utils/buildApiHeaders";
import type { NodeExecutionContext } from "./types";

export interface LlmGenerateOptions {
  /** When true, falls back to stored inputImages/inputPrompt if no connections provide them. */
  useStoredFallback?: boolean;
}

export async function executeLlmGenerate(
  ctx: NodeExecutionContext,
  options: LlmGenerateOptions = {}
): Promise<void> {
  const {
    node,
    getConnectedInputs,
    updateNodeData,
    getEdges,
    getNodes,
    signal,
    providerSettings,
  } = ctx;

  const { useStoredFallback = false } = options;

  const inputs = getConnectedInputs(node.id);
  const nodeData = node.data as LLMGenerateNodeData;

  // Determine images and text
  let images: string[];
  let text: string | null;

  if (useStoredFallback) {
    images = inputs.images.length > 0 ? inputs.images : nodeData.inputImages;
    text = inputs.text ?? nodeData.inputPrompt;
  } else {
    images = inputs.images;
    text = inputs.text ?? nodeData.inputPrompt;
  }

  // Get system prompt from "system" handle connection or from node's own field
  // Check for connected system prompt via edges
  let systemPrompt: string | null = nodeData.systemPrompt || null;
  const edges = getEdges();
  const nodes = getNodes();
  const systemEdge = edges.find(
    (e) => e.target === node.id && e.targetHandle === "system"
  );
  if (systemEdge) {
    const sourceNode = nodes.find((n) => n.id === systemEdge.source);
    if (sourceNode) {
      const d = sourceNode.data as Record<string, unknown>;
      // Extract text from common text-producing node types
      const connectedSystemText =
        (d.prompt as string | null) ??
        (d.outputText as string | null) ??
        (d.currentText as string | null) ??
        (d.currentItem as string | null) ??
        null;
      if (connectedSystemText) systemPrompt = connectedSystemText;
    }
  }

  if (!text) {
    updateNodeData(node.id, {
      status: "error",
      error: "Missing text input - connect a prompt node or set internal prompt",
    });
    throw new Error("Missing text input");
  }

  updateNodeData(node.id, {
    inputPrompt: text,
    inputImages: images,
    status: "loading",
    error: null,
  });

  const headers = buildLlmHeaders(nodeData.provider, providerSettings);

  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: text,
        ...(systemPrompt && { systemPrompt }),
        ...(images.length > 0 && { images }),
        provider: nodeData.provider,
        model: nodeData.model,
        temperature: nodeData.temperature,
        maxTokens: nodeData.maxTokens,
      }),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        if (errorText) errorMessage += ` - ${errorText.substring(0, 200)}`;
      }
      updateNodeData(node.id, {
        status: "error",
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (result.success && result.text) {
      const existingHistory = nodeData.outputHistory ?? [];
      updateNodeData(node.id, {
        outputText: result.text,
        outputHistory: [...existingHistory, result.text],
        selectedHistoryIndex: -1,
        status: "complete",
        error: null,
      });
    } else {
      updateNodeData(node.id, {
        status: "error",
        error: result.error || "LLM generation failed",
      });
      throw new Error(result.error || "LLM generation failed");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    let errorMessage = "LLM generation failed";
    if (error instanceof TypeError && error.message.includes("NetworkError")) {
      errorMessage = "Network error. Check your connection and try again.";
    } else if (error instanceof TypeError) {
      errorMessage = `Network error: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    updateNodeData(node.id, {
      status: "error",
      error: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
