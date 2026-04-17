/**
 * useUpstreamData — Reactive hook that re-renders when upstream node data changes.
 *
 * The problem: Components calling `getConnectedInputs(nodeId)` only get a snapshot.
 * They don't re-render when the upstream prompt node's text changes because
 * they aren't subscribed to the upstream node's data in the Zustand store.
 *
 * This hook subscribes to the actual upstream node data fields so that
 * downstream node components re-render live as the user types.
 */

import { useMemo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { getSourceOutput } from "@/store/utils/connectedInputs";
import type { WorkflowNode } from "@/types";

interface UpstreamData {
  text: string | null;
  images: string[];
  /** All upstream source node IDs (for debugging) */
  sourceNodeIds: string[];
}

/**
 * Reactively get upstream text and images for a node.
 * Re-renders whenever any connected upstream node's output changes.
 */
export function useUpstreamData(nodeId: string): UpstreamData {
  // Single selector that computes a stable serialized key + the actual values.
  // We derive a string key from edges so React only re-renders when edges actually change.
  const edgeKey = useWorkflowStore((state) =>
    state.edges
      .filter((e) => e.target === nodeId)
      .map((e) => `${e.source}|${e.sourceHandle || ""}|${e.targetHandle || ""}`)
      .join(",")
  );

  const sourceEdges = useMemo(
    () =>
      edgeKey
        ? edgeKey.split(",").map((s) => {
            const [sourceId, sourceHandle, targetHandle] = s.split("|");
            return {
              sourceId,
              sourceHandle: sourceHandle || null,
              targetHandle: targetHandle || null,
            };
          })
        : [],
    [edgeKey]
  );

  const sourceNodeIds = useMemo(
    () => sourceEdges.map((e) => e.sourceId),
    [sourceEdges]
  );

  // Subscribe to upstream node outputs — returns a serialized key for stability
  const outputKey = useWorkflowStore((state) => {
    return sourceEdges
      .map((edge) => {
        const sourceNode = state.nodes.find((n) => n.id === edge.sourceId);
        if (!sourceNode) return "null";
        const output = getSourceOutput(sourceNode, edge.sourceHandle);
        // Return a short fingerprint: type + truncated value hash
        return `${output.type}:${output.value ? output.value.substring(0, 100) : ""}`;
      })
      .join("||");
  });

  // Aggregate into text and images — recalculates only when outputKey changes
  const result = useMemo(() => {
    let text: string | null = null;
    const images: string[] = [];

    const nodes = useWorkflowStore.getState().nodes;
    for (let i = 0; i < sourceEdges.length; i++) {
      const edge = sourceEdges[i];
      const sourceNode = nodes.find((n) => n.id === edge.sourceId);
      if (!sourceNode) continue;
      const output = getSourceOutput(sourceNode, edge.sourceHandle);
      if (!output?.value) continue;

      if (output.type === "text") {
        text = output.value;
      } else if (output.type === "image") {
        images.push(output.value);
      }
    }

    return { text, images, sourceNodeIds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputKey, sourceEdges, sourceNodeIds]);

  return result;
}

/**
 * Reactively get just the upstream text for a node.
 * Lighter weight than useUpstreamData when you only need text.
 */
export function useUpstreamText(nodeId: string): string | null {
  // Derive a stable string key from edge connections
  const edgeKey = useWorkflowStore((state) =>
    state.edges
      .filter(
        (e) =>
          e.target === nodeId &&
          (e.targetHandle === "text" ||
            e.targetHandle?.startsWith("text") ||
            !e.targetHandle)
      )
      .map((e) => `${e.source}|${e.sourceHandle || ""}`)
      .join(",")
  );

  const textEdges = useMemo(
    () =>
      edgeKey
        ? edgeKey.split(",").map((s) => {
            const [sourceId, sourceHandle] = s.split("|");
            return { sourceId, sourceHandle: sourceHandle || null };
          })
        : [],
    [edgeKey]
  );

  // Subscribe to the actual text value — returns a primitive string
  const text = useWorkflowStore((state) => {
    for (const edge of textEdges) {
      const sourceNode = state.nodes.find((n) => n.id === edge.sourceId);
      if (!sourceNode) continue;
      const output = getSourceOutput(sourceNode, edge.sourceHandle);
      if (output.type === "text" && output.value) {
        return output.value;
      }
    }
    return null;
  });

  return text;
}

/**
 * Reactively get upstream images for a node.
 */
export function useUpstreamImages(nodeId: string): string[] {
  // Derive a stable string key from edge connections
  const edgeKey = useWorkflowStore((state) =>
    state.edges
      .filter(
        (e) =>
          e.target === nodeId &&
          (e.targetHandle === "image" ||
            e.targetHandle?.startsWith("image") ||
            !e.targetHandle)
      )
      .map((e) => `${e.source}|${e.sourceHandle || ""}`)
      .join(",")
  );

  const imageEdges = useMemo(
    () =>
      edgeKey
        ? edgeKey.split(",").map((s) => {
            const [sourceId, sourceHandle] = s.split("|");
            return { sourceId, sourceHandle: sourceHandle || null };
          })
        : [],
    [edgeKey]
  );

  // Subscribe to image data — returns a stable string key for comparison
  const imageKey = useWorkflowStore((state) => {
    const parts: string[] = [];
    for (const edge of imageEdges) {
      const sourceNode = state.nodes.find((n) => n.id === edge.sourceId) as WorkflowNode | undefined;
      if (!sourceNode) continue;

      if (sourceNode.type === "imageFilter") {
        const filtered = (sourceNode.data as Record<string, unknown>).outputImages as string[] || [];
        parts.push(...filtered.map((img) => img.substring(0, 50)));
        continue;
      }
      if (sourceNode.type === "webScraper") {
        const allImages = (sourceNode.data as Record<string, unknown>).outputImages as string[] || [];
        if (allImages.length > 0) parts.push(...allImages.map((img) => img.substring(0, 50)));
        else {
          const single = (sourceNode.data as Record<string, unknown>).outputImage as string | undefined;
          if (single) parts.push(single.substring(0, 50));
        }
        continue;
      }

      const output = getSourceOutput(sourceNode, edge.sourceHandle);
      if (output.type === "image" && output.value) {
        parts.push(output.value.substring(0, 50));
      }
    }
    return parts.join("||");
  });

  // Compute actual images only when key changes
  const images = useMemo(() => {
    const result: string[] = [];
    const nodes = useWorkflowStore.getState().nodes;
    for (const edge of imageEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.sourceId) as WorkflowNode | undefined;
      if (!sourceNode) continue;

      if (sourceNode.type === "imageFilter") {
        const filtered = (sourceNode.data as Record<string, unknown>).outputImages as string[] || [];
        result.push(...filtered);
        continue;
      }
      if (sourceNode.type === "webScraper") {
        const allImages = (sourceNode.data as Record<string, unknown>).outputImages as string[] || [];
        if (allImages.length > 0) result.push(...allImages);
        else {
          const single = (sourceNode.data as Record<string, unknown>).outputImage as string | undefined;
          if (single) result.push(single);
        }
        continue;
      }

      const output = getSourceOutput(sourceNode, edge.sourceHandle);
      if (output.type === "image" && output.value) {
        result.push(output.value);
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey, imageEdges]);

  return images;
}
