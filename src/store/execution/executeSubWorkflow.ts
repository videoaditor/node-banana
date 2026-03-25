/**
 * Sub-Workflow Executor
 *
 * Loads a team workflow from .shared-workflows/ and runs it headlessly,
 * mapping the SubWorkflow node's connected inputs to the sub-workflow's
 * app-input nodes, then returning the outputs.
 *
 * Supported node types in sub-workflows:
 *   prompt, imageInput, llmGenerate, nanoBanana, output, outputGallery,
 *   promptConcatenator, promptConstructor
 */

import type { NodeExecutionContext } from "./types";
import type { SubWorkflowNodeData } from "@/types";
import { buildLlmHeaders, buildGenerateHeaders } from "@/store/utils/buildApiHeaders";

interface SubWorkflowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface SubWorkflowEdge {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
}

interface SubWorkflowFile {
  nodes: SubWorkflowNode[];
  edges: SubWorkflowEdge[];
  name?: string;
}

/** Simple topological sort for a node graph */
function topoSort(nodes: SubWorkflowNode[], edges: SubWorkflowEdge[]): SubWorkflowNode[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const result: SubWorkflowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighborId of adjacency.get(node.id) ?? []) {
      const newDegree = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) {
        const neighbor = nodes.find((n) => n.id === neighborId);
        if (neighbor) queue.push(neighbor);
      }
    }
  }

  return result;
}

/** Get the first text/image output from upstream nodes for a given node id */
function getUpstreamText(nodeId: string, edges: SubWorkflowEdge[], nodeOutputs: Map<string, { text?: string; image?: string }>): string | null {
  const incoming = edges.filter((e) => e.target === nodeId && (e.targetHandle === "text" || !e.targetHandle));
  for (const edge of incoming) {
    const out = nodeOutputs.get(edge.source);
    if (out?.text) return out.text;
  }
  return null;
}

function getUpstreamImages(nodeId: string, edges: SubWorkflowEdge[], nodeOutputs: Map<string, { text?: string; image?: string }>): string[] {
  const images: string[] = [];
  const incoming = edges.filter((e) => e.target === nodeId && (e.targetHandle === "image" || e.targetHandle === "reference"));
  for (const edge of incoming) {
    const out = nodeOutputs.get(edge.source);
    if (out?.image) images.push(out.image);
  }
  return images;
}

export async function executeSubWorkflowNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, providerSettings, signal } = ctx;
  const data = node.data as unknown as SubWorkflowNodeData;

  if (!data.selectedWorkflowFilename) {
    updateNodeData(node.id, { status: "error", error: "No workflow selected" });
    return;
  }

  updateNodeData(node.id, { status: "loading", error: null, outputText: null, outputImage: null });

  try {
    // Load the sub-workflow JSON
    const listRes = await fetch("/api/team-workflows", { signal });
    const listData = await listRes.json();
    if (!listData.success) throw new Error("Failed to list team workflows");

    const workflowMeta = (listData.workflows as Array<{ filename: string; path: string }>)
      .find((w) => w.filename === data.selectedWorkflowFilename);

    if (!workflowMeta) {
      throw new Error(`Team workflow "${data.selectedWorkflowFilename}" not found`);
    }

    const workflowRes = await fetch(`/api/workflow?path=${encodeURIComponent(workflowMeta.path)}`, { signal });
    const workflowData = await workflowRes.json();
    if (!workflowData.success || !workflowData.workflow) throw new Error("Failed to load sub-workflow");

    const subWorkflow: SubWorkflowFile = workflowData.workflow;
    const subNodes: SubWorkflowNode[] = subWorkflow.nodes || [];
    const subEdges: SubWorkflowEdge[] = subWorkflow.edges || [];

    // Get connected inputs from the parent workflow
    const connected = getConnectedInputs(node.id);
    const inputText = connected.text;
    const inputImages = connected.images;

    // Build a map of node outputs (start with app-input values)
    const nodeOutputs = new Map<string, { text?: string; image?: string }>();

    // Inject inputs into app-input nodes
    for (const subNode of subNodes) {
      if (subNode.type === "prompt" && subNode.data.isAppInput) {
        const promptText = inputText ?? (subNode.data.prompt as string) ?? "";
        nodeOutputs.set(subNode.id, { text: promptText });
        subNode.data = { ...subNode.data, prompt: promptText };
      } else if (subNode.type === "imageInput" && subNode.data.isAppInput) {
        const img = inputImages[0] ?? null;
        if (img) nodeOutputs.set(subNode.id, { image: img });
        subNode.data = { ...subNode.data, image: img };
      } else if (subNode.type === "prompt") {
        // Non-app-input prompt nodes output their stored text
        const promptText = (subNode.data.prompt as string) ?? "";
        nodeOutputs.set(subNode.id, { text: promptText });
      } else if (subNode.type === "imageInput") {
        // Non-app-input imageInput nodes output their stored image
        const img = subNode.data.image as string | null;
        if (img) nodeOutputs.set(subNode.id, { image: img });
      }
    }

    // Topological execution
    const sorted = topoSort(subNodes, subEdges);

    let finalText: string | null = null;
    let finalImage: string | null = null;

    for (const subNode of sorted) {
      if (signal?.aborted) throw new Error("Cancelled");

      // Skip nodes already handled (prompt, imageInput)
      if (subNode.type === "prompt" || subNode.type === "imageInput") continue;

      if (subNode.type === "llmGenerate") {
        const upText = getUpstreamText(subNode.id, subEdges, nodeOutputs) ?? (subNode.data.inputPrompt as string);
        const upImages = getUpstreamImages(subNode.id, subEdges, nodeOutputs);
        if (!upText) continue;

        const headers = buildLlmHeaders();
        const res = await fetch("/api/llm", {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: upText,
            images: upImages,
            provider: subNode.data.provider ?? "google",
            model: subNode.data.model ?? "gemini-2.5-flash",
            temperature: subNode.data.temperature ?? 0.7,
            maxTokens: subNode.data.maxTokens ?? 1024,
          }),
          signal,
        });
        const result = await res.json();
        if (result.success && result.text) {
          nodeOutputs.set(subNode.id, { text: result.text });
          finalText = result.text;
        }

      } else if (subNode.type === "nanoBanana") {
        const upText = getUpstreamText(subNode.id, subEdges, nodeOutputs) ?? (subNode.data.prompt as string);
        const upImages = getUpstreamImages(subNode.id, subEdges, nodeOutputs);

        const selectedModel = subNode.data.selectedModel as { provider: string; modelId: string; displayName: string } | undefined;
        const provider = selectedModel?.provider ?? "gemini";
        const headers = buildGenerateHeaders();

        const res = await fetch("/api/generate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: upText ?? "",
            images: upImages,
            selectedModel,
            aspectRatio: subNode.data.aspectRatio,
            resolution: subNode.data.resolution,
          }),
          signal,
        });
        const result = await res.json();
        if (result.success && result.image) {
          nodeOutputs.set(subNode.id, { image: result.image });
          finalImage = result.image;
        }

      } else if (subNode.type === "output") {
        const upImage = getUpstreamImages(subNode.id, subEdges, nodeOutputs)[0];
        if (upImage) {
          nodeOutputs.set(subNode.id, { image: upImage });
          finalImage = upImage;
        }

      } else if (subNode.type === "outputGallery") {
        const upImage = getUpstreamImages(subNode.id, subEdges, nodeOutputs)[0];
        if (upImage) {
          nodeOutputs.set(subNode.id, { image: upImage });
          finalImage = upImage;
        }

      } else if (subNode.type === "promptConcatenator") {
        const texts: string[] = [];
        for (const edge of subEdges.filter((e) => e.target === subNode.id)) {
          const out = nodeOutputs.get(edge.source);
          if (out?.text) texts.push(out.text);
        }
        const separator = (subNode.data.separator as string) ?? "\n";
        const combined = texts.join(separator);
        if (combined) {
          nodeOutputs.set(subNode.id, { text: combined });
          finalText = combined;
        }

      } else if (subNode.type === "annotation") {
        // Pass through the source image
        const upImage = getUpstreamImages(subNode.id, subEdges, nodeOutputs)[0];
        const outputImage = (subNode.data.outputImage as string) ?? upImage;
        if (outputImage) {
          nodeOutputs.set(subNode.id, { image: outputImage });
          finalImage = outputImage;
        }
      }
    }

    updateNodeData(node.id, {
      outputText: finalText,
      outputImage: finalImage,
      status: "complete",
      error: null,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sub-workflow execution failed";
    updateNodeData(node.id, { status: "error", error: msg });
    throw err;
  }
}
