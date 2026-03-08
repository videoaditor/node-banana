/**
 * Simple Node Executors
 *
 * Executors for node types that don't call external APIs:
 * annotation, prompt, promptConstructor, output, outputGallery, imageCompare.
 *
 * These are used by executeWorkflow (and some by regenerateNode).
 */

import type {
  AnnotationNodeData,
  PromptConstructorNodeData,
  PromptConcatenatorNodeData,
  PromptNodeData,
  OutputNodeData,
  OutputGalleryNodeData,
  WebScraperNodeData,
  WorkflowNode,
  LLMGenerateNodeData,
} from "@/types";
import type { NodeExecutionContext } from "./types";

/**
 * Annotation node: receives upstream image as source, passes through if no annotations.
 */
export async function executeAnnotation(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  try {
    const { images } = getConnectedInputs(node.id);
    const image = images[0] || null;
    if (image) {
      const nodeData = node.data as AnnotationNodeData;
      updateNodeData(node.id, { sourceImage: image, sourceImageRef: undefined });
      // Pass through the image if no annotations exist, or if the previous
      // output was itself a pass-through of the old source image
      if (!nodeData.outputImage || nodeData.outputImage === nodeData.sourceImage) {
        updateNodeData(node.id, { outputImage: image, outputImageRef: undefined });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Workflow] Annotation node ${node.id} failed:`, message);
    updateNodeData(node.id, { error: message });
  }
}

/**
 * Prompt node: receives upstream text and updates its prompt field.
 */
export async function executePrompt(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  try {
    const { text: connectedText } = getConnectedInputs(node.id);
    if (connectedText !== null) {
      const data = node.data as PromptNodeData;
      const prompts = data.prompts?.length ? [...data.prompts] : [data.prompt || ""];
      const idx = data.activePromptIndex ?? 0;
      const safeIdx = Math.min(idx, prompts.length - 1);
      prompts[safeIdx] = connectedText;
      updateNodeData(node.id, { prompt: connectedText, prompts });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Workflow] Prompt node ${node.id} failed:`, message);
    updateNodeData(node.id, { error: message });
  }
}

/**
 * PromptConstructor node: concatenates multiple labeled text inputs with optional static text.
 * Also supports @variable interpolation from connected prompt nodes (backward compatibility).
 */
export async function executePromptConstructor(ctx: NodeExecutionContext): Promise<void> {
  const { node, updateNodeData, getFreshNode, getEdges, getNodes } = ctx;
  try {
    // Get fresh node data from store
    const freshNode = getFreshNode(node.id);
    const nodeData = (freshNode?.data || node.data) as PromptConstructorNodeData;
    const template = nodeData.template || "";
    const staticText = nodeData.staticText || "";
    const inputCount = nodeData.inputCount || 2;

    const edges = getEdges();
    const nodes = getNodes();

    // Collect text from ALL connected input handles.
    // Primary: look for text_input_N handles (labeled inputs).
    // Fallback: collect ANY incoming edge whose source outputs text (handles text, text-*, text_input_*, prompt, etc.)
    const seenSourceIds = new Set<string>();
    const inputTexts: string[] = [];

    // Helper: extract text output from any source node.
    // For prompt nodes, prefer `prompt` (user-editable value) over any stale execution outputText.
    // For other nodes, prefer `outputText` (execution result).
    function extractSourceText(sourceNode: WorkflowNode): string | null {
      const d = sourceNode.data as Record<string, unknown>;
      let val: string | null;
      if (sourceNode.type === "prompt") {
        val = (d.prompt as string | null) ?? null;
      } else {
        val = (d.outputText as string | null) ?? (d.prompt as string | null) ?? null;
      }
      return val && String(val).trim() ? String(val).trim() : null;
    }

    // Pass 1: collect from labeled text_input_N handles (ordered)
    for (let i = 1; i <= inputCount; i++) {
      const handleId = `text_input_${i}`;
      const edge = edges.find((e) => e.target === node.id && e.targetHandle === handleId);
      if (edge) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          const text = extractSourceText(sourceNode);
          if (text) { inputTexts.push(text); seenSourceIds.add(sourceNode.id); }
        }
      }
    }

    // Pass 2: collect from ANY other incoming text-typed edges not already captured
    // This handles connections made to the node body or via 'text' handle fallback
    const allIncomingEdges = edges.filter((e) => e.target === node.id);
    for (const edge of allIncomingEdges) {
      if (seenSourceIds.has(edge.source)) continue;
      const th = edge.targetHandle || "";
      const isTextEdge = th === "text" || th.startsWith("text") || th.includes("prompt") || !th;
      if (!isTextEdge) continue;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;
      const text = extractSourceText(sourceNode);
      if (text) { inputTexts.push(text); seenSourceIds.add(sourceNode.id); }
    }

    // Build final output: all connected input texts joined, then static text appended.
    const parts: string[] = [];

    if (inputTexts.length > 0) {
      parts.push(inputTexts.join("\n\n"));
    }

    if (staticText.trim()) {
      parts.push(staticText.trim());
    }

    const outputText = parts.join("\n\n");

    updateNodeData(node.id, {
      outputText: outputText || null,
      unresolvedVars: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Workflow] PromptConstructor node ${node.id} failed:`, message);
    updateNodeData(node.id, { error: message });
  }
}

/**
 * PromptConcatenator node: concatenates multiple text inputs with separator.
 */
export async function executePromptConcatenator(ctx: NodeExecutionContext): Promise<void> {
  const { node, updateNodeData, getFreshNode, getEdges, getNodes, getConnectedInputs } = ctx;
  try {
    const freshNode = getFreshNode(node.id);
    const nodeData = (freshNode?.data || node.data) as PromptConcatenatorNodeData;
    const separator = nodeData.separator ?? "\n";
    const handleCount = nodeData.textInputHandles || 2;

    const edges = getEdges();
    const nodes = getNodes();

    // Build ordered list of handle IDs: "text", "text-1", "text-2", ...
    const textHandleIds = Array.from({ length: handleCount }, (_, i) =>
      i === 0 ? "text" : `text-${i}`
    );

    // Helper: extract text output from any node type.
    // Prompt nodes: always read `prompt` (user-editable value).
    // Other nodes: prefer `outputText` (execution result).
    const extractText = (n: ReturnType<typeof getNodes>[0]): string | null => {
      const d = n.data as Record<string, unknown>;
      // Prompt nodes: user-editable value is `prompt`
      if (n.type === "prompt") {
        return typeof d.prompt === "string" && d.prompt ? d.prompt : null;
      }
      // promptConstructor
      if (n.type === "promptConstructor") {
        const pc = d as PromptConstructorNodeData;
        return pc.outputText ?? pc.template ?? null;
      }
      // All other nodes: prefer outputText, fallback to prompt
      if (typeof d.outputText === "string" && d.outputText) return d.outputText;
      if (typeof d.prompt === "string" && d.prompt) return d.prompt;
      return null;
    };

    const textInputs: string[] = [];

    for (const handleId of textHandleIds) {
      // Find edge targeting this specific handle
      const edge = edges.find(
        (e) => e.target === node.id && (e.targetHandle === handleId || (!e.targetHandle && handleId === "text"))
      );
      if (!edge) continue;

      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      const text = extractText(sourceNode);
      if (text) textInputs.push(text);
    }

    // Also try getConnectedInputs as fallback (gets all text inputs at once)
    if (textInputs.length === 0) {
      const { text } = getConnectedInputs(node.id);
      if (text) textInputs.push(text);
    }

    const outputText = textInputs.join(separator);
    updateNodeData(node.id, { outputText });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Workflow] PromptConcatenator node ${node.id} failed:`, message);
    updateNodeData(node.id, { outputText: null });
  }
}

/**
 * Output node: displays final image/video result.
 */
export async function executeOutput(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, saveDirectoryPath } = ctx;
  const { images, videos } = getConnectedInputs(node.id);

  // Check videos array first (typed data from source)
  if (videos.length > 0) {
    const videoContent = videos[0];
    updateNodeData(node.id, {
      image: videoContent,
      video: videoContent,
      contentType: "video",
    });

    // Save to /outputs directory if we have a project path
    if (saveDirectoryPath) {
      const outputNodeData = node.data as OutputNodeData;
      const outputsPath = `${saveDirectoryPath}/outputs`;

      fetch("/api/save-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: outputsPath,
          video: videoContent,
          customFilename: outputNodeData.outputFilename || undefined,
          createDirectory: true,
        }),
      }).catch((err) => {
        console.error("Failed to save output:", err);
      });
    }
  } else if (images.length > 0) {
    const content = images[0];
    // Fallback pattern matching for edge cases (video data that ended up in images array)
    const isVideoContent =
      content.startsWith("data:video/") ||
      content.includes(".mp4") ||
      content.includes(".webm") ||
      content.includes("fal.media");

    if (isVideoContent) {
      updateNodeData(node.id, {
        image: content,
        video: content,
        contentType: "video",
      });
    } else {
      updateNodeData(node.id, {
        image: content,
        video: null,
        contentType: "image",
      });
    }

    // Save to /outputs directory if we have a project path
    if (saveDirectoryPath) {
      const outputNodeData = node.data as OutputNodeData;
      const outputsPath = `${saveDirectoryPath}/outputs`;

      fetch("/api/save-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: outputsPath,
          image: isVideoContent ? undefined : content,
          video: isVideoContent ? content : undefined,
          customFilename: outputNodeData.outputFilename || undefined,
          createDirectory: true,
        }),
      }).catch((err) => {
        console.error("Failed to save output:", err);
      });
    }
  }
}

/**
 * OutputGallery node: accumulates images from upstream nodes.
 */
export async function executeOutputGallery(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images } = getConnectedInputs(node.id);
  const galleryData = node.data as OutputGalleryNodeData;
  const existing = new Set(galleryData.images || []);
  const newImages = images.filter((img) => !existing.has(img));
  if (newImages.length > 0) {
    updateNodeData(node.id, {
      images: [...newImages, ...(galleryData.images || [])],
    });
  }
}

/**
 * ImageCompare node: takes two upstream images for side-by-side comparison.
 */
export async function executeImageCompare(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images } = getConnectedInputs(node.id);
  updateNodeData(node.id, {
    imageA: images[0] || null,
    imageB: images[1] || null,
  });
}

/**
 * GLB Viewer node: receives 3D model URL from upstream, fetches and loads it.
 */
export async function executeGlbViewer(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, signal } = ctx;
  const { model3d } = getConnectedInputs(node.id);
  if (model3d) {
    // Fetch the GLB URL and create a blob URL for the viewer
    try {
      const response = await fetch(model3d, signal ? { signal } : {});
      if (!response.ok) {
        throw new Error(`Failed to fetch 3D model: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      updateNodeData(node.id, {
        glbUrl: blobUrl,
        filename: "generated.glb",
        capturedImage: null,
      });
    } catch (error) {
      // Don't set error state on abort
      if ((error instanceof DOMException && error.name === "AbortError") || signal?.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Workflow] GLB Viewer node ${node.id} failed:`, message);
      updateNodeData(node.id, { error: message });
    }
  }
}

/**
 * Web Scraper node: fetches a URL and extracts images + text.
 * URL can come from upstream text connection or from the node's own URL field.
 */
export async function executeWebScraper(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, signal } = ctx;
  const nodeData = node.data as WebScraperNodeData;

  try {
    // Get URL from connected input or use the node's own URL field
    const { text: connectedText } = getConnectedInputs(node.id);
    const rawUrl = connectedText || nodeData.url;
    // Normalize: add https:// if missing
    const url = rawUrl ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`) : "";

    if (!url) {
      updateNodeData(node.id, {
        status: "error",
        error: "No URL provided. Connect a text node or enter a URL.",
      });
      return;
    }

    // If URL came from upstream, store it
    if (connectedText && connectedText !== nodeData.url) {
      updateNodeData(node.id, { url: connectedText });
    }

    updateNodeData(node.id, {
      status: "loading",
      error: null,
      outputImage: null,
      outputImages: [],
      outputText: null,
      pageTitle: null,
      imageCount: 0,
    });

    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        maxImages: nodeData.maxImages || 4,
        minImageSize: nodeData.minImageSize || 100,
      }),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `Failed to scrape: ${response.status}`);
    }

    const result = await response.json();

    updateNodeData(node.id, {
      status: "complete",
      outputImage: result.images?.[0] || null,
      outputImages: result.images || [],
      outputText: result.text || null,
      pageTitle: result.pageTitle || null,
      imageCount: result.imageCount || 0,
    });
  } catch (error) {
    // Don't set error state on abort
    if ((error instanceof DOMException && error.name === "AbortError") || signal?.aborted) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Workflow] WebScraper node ${node.id} failed:`, message);
    updateNodeData(node.id, {
      status: "error",
      error: message,
    });
  }
}
