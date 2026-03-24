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
import { useShallow } from "zustand/shallow";
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
  // Step 1: Get the source node IDs and their edge info (reactive to edge changes)
  const sourceEdges = useWorkflowStore(
    useShallow((state) =>
      state.edges
        .filter((e) => e.target === nodeId)
        .map((e) => ({
          sourceId: e.source,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
        }))
    )
  );

  const sourceNodeIds = useMemo(
    () => sourceEdges.map((e) => e.sourceId),
    [sourceEdges]
  );

  // Step 2: Subscribe to the upstream nodes' data (reactive to their data changes)
  // We extract just the fields we care about so we don't over-subscribe
  const upstreamOutputs = useWorkflowStore(
    useShallow((state) => {
      return sourceEdges.map((edge) => {
        const sourceNode = state.nodes.find((n) => n.id === edge.sourceId);
        if (!sourceNode) return { type: "text" as const, value: null };
        return getSourceOutput(sourceNode, edge.sourceHandle);
      });
    })
  );

  // Step 3: Aggregate into text and images
  const result = useMemo(() => {
    let text: string | null = null;
    const images: string[] = [];

    for (let i = 0; i < upstreamOutputs.length; i++) {
      const output = upstreamOutputs[i];
      const edge = sourceEdges[i];
      if (!output?.value) continue;

      if (output.type === "text") {
        text = output.value;
      } else if (output.type === "image") {
        images.push(output.value);
      }
    }

    return { text, images, sourceNodeIds };
  }, [upstreamOutputs, sourceEdges, sourceNodeIds]);

  return result;
}

/**
 * Reactively get just the upstream text for a node.
 * Lighter weight than useUpstreamData when you only need text.
 */
export function useUpstreamText(nodeId: string): string | null {
  const textEdges = useWorkflowStore(
    useShallow((state) =>
      state.edges
        .filter(
          (e) =>
            e.target === nodeId &&
            (e.targetHandle === "text" ||
              e.targetHandle?.startsWith("text") ||
              !e.targetHandle)
        )
        .map((e) => ({
          sourceId: e.source,
          sourceHandle: e.sourceHandle || null,
        }))
    )
  );

  const text = useWorkflowStore(
    useShallow((state) => {
      for (const edge of textEdges) {
        const sourceNode = state.nodes.find((n) => n.id === edge.sourceId);
        if (!sourceNode) continue;
        const output = getSourceOutput(sourceNode, edge.sourceHandle);
        if (output.type === "text" && output.value) {
          return output.value;
        }
      }
      return null;
    })
  );

  return text;
}

/**
 * Reactively get upstream images for a node.
 */
export function useUpstreamImages(nodeId: string): string[] {
  const imageEdges = useWorkflowStore(
    useShallow((state) =>
      state.edges
        .filter(
          (e) =>
            e.target === nodeId &&
            (e.targetHandle === "image" ||
              e.targetHandle?.startsWith("image") ||
              !e.targetHandle)
        )
        .map((e) => ({
          sourceId: e.source,
          sourceHandle: e.sourceHandle || null,
        }))
    )
  );

  const images = useWorkflowStore(
    useShallow((state) => {
      const result: string[] = [];
      for (const edge of imageEdges) {
        const sourceNode = state.nodes.find((n) => n.id === edge.sourceId) as WorkflowNode | undefined;
        if (!sourceNode) continue;

        // Special multi-image sources
        if (sourceNode.type === "imageFilter") {
          const filtered = (sourceNode.data as any).outputImages || [];
          result.push(...filtered);
          continue;
        }
        if (sourceNode.type === "webScraper") {
          const allImages = (sourceNode.data as any).outputImages || [];
          if (allImages.length > 0) result.push(...allImages);
          else if ((sourceNode.data as any).outputImage) result.push((sourceNode.data as any).outputImage);
          continue;
        }

        const output = getSourceOutput(sourceNode, edge.sourceHandle);
        if (output.type === "image" && output.value) {
          result.push(output.value);
        }
      }
      return result;
    })
  );

  return images;
}
