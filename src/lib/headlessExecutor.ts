/**
 * Headless Workflow Executor
 *
 * Server-side workflow executor that doesn't depend on React or Zustand.
 * Reuses the same per-node execution functions but with plain JS objects
 * for node/edge state. Used by POST /api/run.
 *
 * IMPORTANT: This must stay in sync with workflowStore.ts execution logic.
 * When adding new node types, update BOTH files.
 */

import type {
    WorkflowNode,
    WorkflowEdge,
    WorkflowNodeData,
    PromptNodeData,
    ImageInputNodeData,
    ImageIteratorNodeData,
    OutputNodeData,
    OutputGalleryNodeData,
    LLMGenerateNodeData,
    GenerateVideoNodeData,
    Generate3DNodeData,
    WebScraperNodeData,
    ImageHistoryItem,
    ProviderSettings,
    ImageFilterNodeData,
    ZipIteratorNodeData,
} from "@/types";
import type { NodeExecutionContext } from "@/store/execution/types";
import { getConnectedInputsPure } from "@/store/utils/connectedInputs";
import { groupNodesByLevel, chunk } from "@/store/utils/executionUtils";
import {
    executePrompt,
    executePromptConstructor,
    executePromptConcatenator,
    executeOutput,
    executeOutputGallery,
    executeImageCompare,
    executeNanoBanana,
    executeGenerateVideo,
    executeGenerate3D,
    executeLlmGenerate,
    executeSplitGrid,
    executeGlbViewer,
    executeWebScraper,
    executeSubWorkflowNode,
} from "@/store/execution";
import { executeImageFilter } from "@/store/execution/imageFilterExecutor";

export interface HeadlessInput {
    [nodeId: string]: string | string[]; // text, base64 image, or array of images for iterators
}

export interface HeadlessOutput {
    nodeId: string;
    type: "image" | "video" | "text" | "3d";
    data: string;
    label: string;
}

export interface HeadlessResult {
    success: boolean;
    outputs: HeadlessOutput[];
    executionTimeMs: number;
    cost: number;
    error?: string;
}

interface WorkflowFileInput {
    version: 1;
    name: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    edgeStyle: string;
    groups?: Record<string, unknown>;
}

// Iterator node types — keep in sync with workflowStore.ts
const ITERATOR_TYPES = ["imageIterator", "textIterator", "arrayNode", "zipIterator"];

/**
 * Execute a workflow headlessly (no React, no Zustand).
 *
 * @param workflow - The workflow file JSON
 * @param inputs  - Map of nodeId → input value (text or base64 image)
 * @param providerSettings - API key settings for providers
 */
export async function executeWorkflowHeadless(
    workflow: WorkflowFileInput,
    inputs: HeadlessInput,
    providerSettings: ProviderSettings
): Promise<HeadlessResult> {
    const startTime = Date.now();
    let totalCost = 0;

    // Deep copy nodes to avoid mutation issues
    let nodes: WorkflowNode[] = JSON.parse(JSON.stringify(workflow.nodes));
    const edges: WorkflowEdge[] = JSON.parse(JSON.stringify(workflow.edges));

    // Inject inputs into nodes
    for (const [nodeId, value] of Object.entries(inputs)) {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        if (node.type === "prompt") {
            (node.data as PromptNodeData).prompt = value as string;
        } else if (node.type === "imageInput") {
            (node.data as ImageInputNodeData).image = value as string;
        } else if (node.type === "imageIterator") {
            const images = Array.isArray(value) ? value : [value];
            (node.data as ImageIteratorNodeData).localImages = images;
        }
    }

    // Helper to update node data in-place
    // Uses getter pattern so contexts always see latest nodes
    const updateNodeData = (nodeId: string, data: Partial<WorkflowNodeData>) => {
        nodes = nodes.map((n) =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, ...data } as WorkflowNodeData }
                : n
        ) as WorkflowNode[];
    };

    // Build execution context for a node
    // IMPORTANT: getConnectedInputs/getFreshNode/getNodes use closures that
    // always reference the current `nodes` array, not a stale snapshot
    const buildContext = (node: WorkflowNode, signal?: AbortSignal): NodeExecutionContext => ({
        node,
        getConnectedInputs: (id: string) => getConnectedInputsPure(id, nodes, edges),
        updateNodeData,
        getFreshNode: (id: string) => nodes.find((n) => n.id === id),
        getEdges: () => edges,
        getNodes: () => nodes,
        signal,
        providerSettings,
        addIncurredCost: (cost: number) => { totalCost += cost; },
        addToGlobalHistory: (_item: Omit<ImageHistoryItem, "id">) => { /* no-op headless */ },
        generationsPath: null,
        saveDirectoryPath: null,
        trackSaveGeneration: () => { /* no-op */ },
        appendOutputGalleryImage: (targetId: string, image: string) => {
            nodes = nodes.map((n) =>
                n.id === targetId && n.type === "outputGallery"
                    ? { ...n, data: { ...n.data, images: [image, ...((n.data as OutputGalleryNodeData).images || [])] } as WorkflowNodeData }
                    : n
            ) as WorkflowNode[];
        },
        get: () => ({ nodes, edges }),
    });

    // Execute a single node — must handle ALL node types
    const executeSingleNode = async (node: WorkflowNode, signal: AbortSignal) => {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        // Always get the freshest node data
        const freshNode = nodes.find((n) => n.id === node.id) || node;
        const ctx = buildContext(freshNode, signal);

        switch (freshNode.type) {
            case "imageInput":
            case "audioInput":
            case "stickyNote":
                // Data source / visual-only nodes — no execution needed
                break;
            case "annotation":
                // Annotation passes through source image if outputImage not already set
                {
                    const { images } = ctx.getConnectedInputs(freshNode.id);
                    if (images.length > 0) {
                        const annData = freshNode.data as Record<string, unknown>;
                        if (!annData.outputImage) {
                            updateNodeData(freshNode.id, { outputImage: images[0], sourceImage: images[0] } as Partial<WorkflowNodeData>);
                        }
                    }
                }
                break;
            case "glbViewer":
                await executeGlbViewer(ctx);
                break;
            case "prompt":
                await executePrompt(ctx);
                break;
            case "promptConstructor":
                await executePromptConstructor(ctx);
                break;
            case "promptConcatenator":
                await executePromptConcatenator(ctx);
                break;
            case "nanoBanana":
                await executeNanoBanana(ctx);
                break;
            case "generateVideo":
                await executeGenerateVideo(ctx);
                break;
            case "generate3d":
                await executeGenerate3D(ctx);
                break;
            case "llmGenerate":
                await executeLlmGenerate(ctx);
                break;
            case "splitGrid":
                await executeSplitGrid(ctx);
                break;
            case "output":
                await executeOutput(ctx);
                break;
            case "outputGallery":
                await executeOutputGallery(ctx);
                break;
            case "imageCompare":
                await executeImageCompare(ctx);
                break;
            case "webScraper":
                await executeWebScraper(ctx);
                break;
            case "subWorkflow":
                await executeSubWorkflowNode(ctx);
                break;
            case "imageFilter":
                await executeImageFilter(ctx);
                break;
            case "listSelector":
                // ListSelector: populate from upstream text if connected
                {
                    const { text } = ctx.getConnectedInputs(freshNode.id);
                    if (text) {
                        const lsData = freshNode.data as Record<string, unknown>;
                        const splitMode = (lsData.splitMode as string) || "newline";
                        const customSep = (lsData.customSeparator as string) || "";
                        let upstreamItems: string[] = [];
                        if (splitMode === "newline") upstreamItems = text.split("\n").filter(t => t.trim());
                        else if (splitMode === "period") upstreamItems = text.split(".").filter(t => t.trim());
                        else if (splitMode === "hash") upstreamItems = text.split("#").filter(t => t.trim());
                        else if (splitMode === "dash") upstreamItems = text.split("-").filter(t => t.trim());
                        else if (splitMode === "custom" && customSep) upstreamItems = text.split(customSep).filter(t => t.trim());
                        else upstreamItems = [text];

                        if (upstreamItems.length > 0) {
                            const selectedIdx = (lsData.selectedIndex as number) || 0;
                            const safeIdx = Math.min(selectedIdx, upstreamItems.length - 1);
                            updateNodeData(freshNode.id, {
                                upstreamItems,
                                outputText: upstreamItems[safeIdx] || upstreamItems[0],
                            } as Partial<WorkflowNodeData>);
                        }
                    }
                }
                break;
            // videoStitch, easeCurve, soraBlueprint, brollBatch — skipped in headless
            // (they require browser APIs like Canvas/MediaEncoder)
            default:
                break;
        }
    };

    // Recursive level execution — mirrors workflowStore.ts executeLevelsSequentially
    const executeLevels = async (
        levels: ReturnType<typeof groupNodesByLevel>,
        startIdx: number,
        endIdx: number,
        abortSignal: AbortSignal,
        maxConcurrent: number
    ) => {
        for (let levelIdx = startIdx; levelIdx <= endIdx; levelIdx++) {
            if (abortSignal.aborted) break;

            const level = levels[levelIdx];
            if (!level) continue;

            const levelNodes = level.nodeIds
                .map((id) => nodes.find((n) => n.id === id))
                .filter((n): n is WorkflowNode => n !== undefined);

            if (levelNodes.length === 0) continue;

            // Check for iterators
            const iterators = levelNodes.filter((n) => ITERATOR_TYPES.includes(n.type!));

            if (iterators.length > 0) {
                // Execute non-iterator nodes first
                const normalNodes = levelNodes.filter((n) => !ITERATOR_TYPES.includes(n.type!));
                if (normalNodes.length > 0) {
                    const batches = chunk(normalNodes, maxConcurrent);
                    for (const batch of batches) {
                        if (abortSignal.aborted) break;
                        await Promise.all(batch.map((n) => executeSingleNode(n, abortSignal)));
                    }
                }

                // Handle the iterator
                const iterator = iterators[0];
                const ctx = buildContext(iterator, abortSignal);

                // --- Zip Iterator: special dual-output path ---
                if (iterator.type === "zipIterator") {
                    const { images: connectedImages, text: connectedText } = ctx.getConnectedInputs(iterator.id);
                    const data = iterator.data as Record<string, unknown>;
                    const splitMode = (data.splitMode as string) || "newline";
                    const customSep = (data.customSeparator as string) || "";
                    const mode = (data.mode as string) || "zip";

                    let textItems: string[] = [];
                    if (connectedText) {
                        if (splitMode === "newline") textItems = connectedText.split("\n").filter(t => t.trim());
                        else if (splitMode === "period") textItems = connectedText.split(".").filter(t => t.trim());
                        else if (splitMode === "hash") textItems = connectedText.split("#").filter(t => t.trim());
                        else if (splitMode === "dash") textItems = connectedText.split("-").filter(t => t.trim());
                        else if (splitMode === "custom" && customSep) textItems = connectedText.split(customSep).filter(t => t.trim());
                        else textItems = [connectedText];
                    }

                    const imageItems = connectedImages || [];
                    let totalPairs: number;
                    if (mode === "product") {
                        totalPairs = Math.max(textItems.length, 1) * Math.max(imageItems.length, 1);
                    } else {
                        totalPairs = Math.max(textItems.length, imageItems.length);
                    }

                    updateNodeData(iterator.id, { textItems, imageItems, totalPairs, status: "loading" } as Partial<WorkflowNodeData>);

                    for (let i = 0; i < totalPairs; i++) {
                        if (abortSignal.aborted) break;

                        let currentText: string | null;
                        let currentImage: string | null;

                        if (mode === "product") {
                            const tIdx = Math.floor(i / Math.max(imageItems.length, 1));
                            const iIdx = i % Math.max(imageItems.length, 1);
                            currentText = textItems[tIdx] || null;
                            currentImage = imageItems[iIdx] || null;
                        } else {
                            currentText = textItems[i] || null;
                            currentImage = imageItems[i] || null;
                        }

                        updateNodeData(iterator.id, { currentText, currentImage, currentIndex: i, status: "loading" } as Partial<WorkflowNodeData>);
                        await executeLevels(levels, levelIdx + 1, endIdx, abortSignal, maxConcurrent);
                    }

                    updateNodeData(iterator.id, { status: "complete", currentText: null, currentImage: null } as Partial<WorkflowNodeData>);
                    return; // Iterator handled all downstream
                }

                // --- Standard single-output iterators ---
                let items: string[] = [];

                if (iterator.type === "imageIterator") {
                    const { images: connectedImages } = ctx.getConnectedInputs(iterator.id);
                    const data = iterator.data as Record<string, unknown>;
                    // Combine connected images AND locally uploaded images (same as client-side)
                    const allImages = [
                        ...connectedImages,
                        ...((data.localImages as string[]) || []),
                    ];
                    if (data.mode === "random" && typeof data.randomCount === "number" && data.randomCount > 0) {
                        const shuffled = [...allImages].sort(() => 0.5 - Math.random());
                        items = shuffled.slice(0, data.randomCount as number);
                    } else {
                        items = allImages;
                    }
                } else if (iterator.type === "textIterator") {
                    const { text } = ctx.getConnectedInputs(iterator.id);
                    const data = iterator.data as Record<string, unknown>;
                    if (text) {
                        updateNodeData(iterator.id, { inputText: text } as Partial<WorkflowNodeData>);
                        const splitMode = data.splitMode as string;
                        if (splitMode === "newline") items = text.split("\n").filter((t) => t.trim());
                        else if (splitMode === "period") items = text.split(".").filter((t) => t.trim());
                        else if (splitMode === "hash") items = text.split("#").filter((t) => t.trim());
                        else if (splitMode === "dash") items = text.split("-").filter((t) => t.trim());
                        else if (splitMode === "custom" && data.customSeparator)
                            items = text.split(data.customSeparator as string).filter((t) => t.trim());
                        else items = [text];
                    }
                } else if (iterator.type === "arrayNode") {
                    const { text } = ctx.getConnectedInputs(iterator.id);
                    const data = iterator.data as Record<string, unknown>;
                    const localItems = ((data.items as string[]) || []).filter((t: string) => t.trim());
                    const connectedItems = text ? text.split("\n").filter((t: string) => t.trim()) : [];
                    items = [...localItems, ...connectedItems];
                }

                updateNodeData(iterator.id, { status: "complete" } as Partial<WorkflowNodeData>);

                if (items.length === 0) return;

                for (let i = 0; i < items.length; i++) {
                    if (abortSignal.aborted) break;

                    if (iterator.type === "imageIterator") {
                        updateNodeData(iterator.id, { currentImage: items[i], status: "loading" } as Partial<WorkflowNodeData>);
                    } else if (iterator.type === "arrayNode") {
                        updateNodeData(iterator.id, { currentItem: items[i], status: "loading" } as Partial<WorkflowNodeData>);
                    } else {
                        updateNodeData(iterator.id, { currentText: items[i], status: "loading" } as Partial<WorkflowNodeData>);
                    }

                    // Execute downstream levels recursively
                    await executeLevels(levels, levelIdx + 1, endIdx, abortSignal, maxConcurrent);
                }

                updateNodeData(iterator.id, { status: "complete", currentImage: null, currentText: null, currentItem: null } as Partial<WorkflowNodeData>);
                return; // Iterator handled all downstream
            }

            // Normal execution
            const batches = chunk(levelNodes, maxConcurrent);
            for (const batch of batches) {
                if (abortSignal.aborted) break;
                await Promise.all(batch.map((n) => executeSingleNode(n, abortSignal)));
            }
        }
    };

    try {
        const abortController = new AbortController();
        const levels = groupNodesByLevel(nodes, edges);
        const maxConcurrent = 3;

        await executeLevels(levels, 0, levels.length - 1, abortController.signal, maxConcurrent);

        // Collect outputs from all output-producing node types
        const outputs: HeadlessOutput[] = [];
        for (const node of nodes) {
            if (node.type === "output") {
                const data = node.data as OutputNodeData;
                if (data.video || data.image) {
                    outputs.push({
                        nodeId: node.id,
                        type: data.contentType === "video" ? "video" : "image",
                        data: data.video || data.image || "",
                        label: data.customTitle || "Output",
                    });
                }
            } else if (node.type === "outputGallery") {
                const data = node.data as OutputGalleryNodeData;
                for (const img of data.images) {
                    outputs.push({
                        nodeId: node.id,
                        type: "image",
                        data: img,
                        label: data.customTitle || "Gallery Output",
                    });
                }
            } else if (node.type === "llmGenerate") {
                const data = node.data as LLMGenerateNodeData;
                if (data.outputText) {
                    outputs.push({
                        nodeId: node.id,
                        type: "text",
                        data: data.outputText,
                        label: data.customTitle || "Text Output",
                    });
                }
            } else if (node.type === "generateVideo") {
                const data = node.data as GenerateVideoNodeData;
                if (data.outputVideo) {
                    outputs.push({
                        nodeId: node.id,
                        type: "video",
                        data: data.outputVideo,
                        label: data.customTitle || "Video Output",
                    });
                }
            } else if (node.type === "generate3d") {
                const data = node.data as Generate3DNodeData;
                if (data.output3dUrl) {
                    outputs.push({
                        nodeId: node.id,
                        type: "3d",
                        data: data.output3dUrl,
                        label: data.customTitle || "3D Model Output",
                    });
                }
            } else if (node.type === "webScraper") {
                const data = node.data as WebScraperNodeData;
                if (data.outputText) {
                    outputs.push({
                        nodeId: node.id,
                        type: "text",
                        data: data.outputText,
                        label: data.customTitle || "Scraped Text",
                    });
                }
                if (data.outputImages.length > 0) {
                    for (const img of data.outputImages) {
                        outputs.push({
                            nodeId: node.id,
                            type: "image",
                            data: img,
                            label: data.customTitle || "Scraped Image",
                        });
                    }
                }
            } else if (node.type === "imageFilter") {
                const data = node.data as ImageFilterNodeData;
                if (data.outputImages.length > 0) {
                    for (const img of data.outputImages) {
                        outputs.push({
                            nodeId: node.id,
                            type: "image",
                            data: img,
                            label: data.customTitle || "Filtered Image",
                        });
                    }
                }
            }
        }

        return {
            success: true,
            outputs,
            executionTimeMs: Date.now() - startTime,
            cost: totalCost,
        };
    } catch (error) {
        return {
            success: false,
            outputs: [],
            executionTimeMs: Date.now() - startTime,
            cost: totalCost,
            error: error instanceof Error ? error.message : "Execution failed",
        };
    }
}

/**
 * Extract the input/output schema from a workflow.
 * Returns which nodes accept App inputs and which produce outputs.
 */
export function extractWorkflowSchema(workflow: WorkflowFileInput) {
    const inputs = workflow.nodes
        .filter((node) => {
            if (node.type === "prompt") {
                return (node.data as PromptNodeData).isAppInput === true;
            }
            if (node.type === "imageInput") {
                return (node.data as ImageInputNodeData).isAppInput === true;
            }
            if (node.type === "imageIterator") {
                return (node.data as ImageIteratorNodeData).isAppInput === true;
            }
            return false;
        })
        .map((node) => ({
            nodeId: node.id,
            type: node.type === "prompt" ? ("text" as const) : node.type === "imageIterator" ? ("images" as const) : ("image" as const),
            label: node.data.customTitle || (node.type === "prompt" ? "Text Prompt" : node.type === "imageIterator" ? "Image Collection" : "Image Input"),
            required: true,
        }));

    const outputNodeTypes = ["output", "outputGallery", "llmGenerate", "generateVideo", "generate3d"];
    const outputs = workflow.nodes
        .filter((n) => outputNodeTypes.includes(n.type!))
        .map((node) => {
            let type: "image" | "text" | "video" | "3d" = "image";
            let label = node.data.customTitle || "Output";

            switch (node.type) {
                case "llmGenerate":
                    type = "text";
                    label = node.data.customTitle || "Text Output";
                    break;
                case "generateVideo":
                    type = "video";
                    label = node.data.customTitle || "Video Output";
                    break;
                case "generate3d":
                    type = "3d";
                    label = node.data.customTitle || "3D Model Output";
                    break;
                default:
                    label = node.data.customTitle || "Image Output";
            }

            return { nodeId: node.id, type, label };
        });

    return { inputs, outputs };
}
