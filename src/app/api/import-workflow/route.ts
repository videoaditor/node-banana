/**
 * Import Workflow from Screenshot API
 *
 * Accepts an image (screenshot of a Weavy, ComfyUI, n8n, or similar workflow)
 * and uses Gemini to analyze it and reconstruct it as a Node Banana workflow JSON.
 *
 * POST /api/import-workflow
 * Body: { image: string (base64 data URL) }
 * Response: { success: true, workflow: WorkflowFile } | { success: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { hydrateNodeData } from "@/store/utils/nodeDefaults";

export const maxDuration = 120; // 2 minutes for complex workflows
export const dynamic = "force-dynamic";

// All available node types and their purpose + data fields
const NODE_CATALOG = `
## Available Node Types

### Input Nodes
- **imageInput**: Upload/load images into the workflow.
  Handles: output "image" (right).
  Data: { image: null, filename: null, dimensions: null }

- **audioInput**: Upload audio files.
  Handles: output "audio" (right).
  Data: { audioFile: null, filename: null, duration: null, format: null }

- **prompt**: Text input for prompts. Can hold multiple stacked prompts.
  Handles: output "text" (right).
  Data: { prompt: "<the text>", variableName: "<optional var name>" }

- **imageIterator**: Iterate over multiple images, running downstream workflow once per image.
  Handles: input "image" (left), output "image" (right).
  Data: { localImages: [], mode: "all", randomCount: 1 }

- **textIterator**: Split text by separator and iterate each segment.
  Handles: input "text" (left), output "text" (right).
  Data: { splitMode: "newline", customSeparator: "" }

### Processing / Text Nodes
- **promptConstructor**: Template-based prompt builder with @variable interpolation. Multiple text inputs.
  Handles: inputs "text-0","text-1",... (left, up to 6), output "text" (right).
  Data: { template: "<template with @var references>", inputCount: 2, staticText: "" }

- **promptConcatenator**: Concatenates multiple text inputs with a separator.
  Handles: inputs "text-0","text-1",... (left), output "text" (right).
  Data: { separator: "\\n", textInputHandles: 2 }

- **llmGenerate**: AI text generation using LLM (Gemini).
  Handles: input "text" (left), input "image" (left), output "text" (right).
  Data: { provider: "gemini", model: "gemini-2.5-flash", temperature: 0.7, maxTokens: 2048 }

- **webScraper**: Fetch content from URLs. Can extract best image, all images, or page text.
  Handles: input "text" (left, URL), output "image" or "text" (right).
  Data: { url: "", scrapeMode: "best-image" | "all-images" | "page-text" }

### Generation Nodes
- **nanoBanana**: AI image generation. Supports text+image inputs.
  Handles: input "image" (left), input "text" (left), output "image" (right).
  Data: { aspectRatio: "1:1", resolution: "1K", model: "nano-banana-pro", useGoogleSearch: false }
  Note: This is the main image generation node. Use for any "Generate Image" / "Image Gen" / "txt2img" / "img2img" blocks.

- **generateVideo**: AI video generation.
  Handles: input "image" (left), input "text" (left), output "video" (right).
  Data: { selectedModel: { provider: "gemini", modelId: "veo-2.0-generate-video-001", displayName: "Veo 2" } }
  Note: Use for any "Generate Video" / "txt2vid" / "img2vid" blocks.

- **generate3d**: AI 3D model generation.
  Handles: input "image" (left), input "text" (left), output "3d" (right).
  Data: {}

- **soraBlueprint**: Composite character+product reference image for video gen.
  Handles: input "image" (left, 2x), input "text" (left), output "image" (right).
  Data: { aspectRatio: "9:16", resolution: "1K" }

- **brollBatch**: Fires N parallel video renders from a blueprint+template.
  Handles: input "image" (left), input "text" (left), output "video" (right).
  Data: { shotCount: 3, duration: "4", runMode: "parallel" }

### Output / Display Nodes
- **output**: Displays final image or video result.
  Handles: input "image" (left), input "video" (left).
  Data: { image: null }

- **outputGallery**: Scrollable grid of output images.
  Handles: input "image" (left).
  Data: { images: [] }

- **imageCompare**: Side-by-side image comparison.
  Handles: input "imageA" (left), input "imageB" (left).
  Data: {}

- **glbViewer**: 3D model viewer (GLB files).
  Handles: input "3d" (left), output "image" (right).
  Data: {}

### Video Processing Nodes
- **videoStitch**: Concatenate multiple videos into one.
  Handles: multiple "video" inputs (left), output "video" (right).
  Data: { loopCount: 1 }

- **easeCurve**: Apply speed curve easing to video.
  Handles: input "video" (left), output "video" (right).
  Data: { easingPreset: "easeInOut", outputDuration: 4 }

### Utility Nodes
- **splitGrid**: Split an image into grid cells.
  Handles: input "image" (left), outputs cells.
  Data: { targetCount: 4 }

- **stickyNote**: Colored sticky note for annotations (no connections).
  Data: { text: "<note text>", color: "yellow" | "green" | "blue" | "pink" | "orange" }

## Connection Rules
- Edges connect a source node output handle to a target node input handle.
- Handle types must match: image→image, text→text, video→video, audio→audio, 3d→3d.
- Source handles are always on the RIGHT side of a node.
- Target handles are always on the LEFT side of a node.
`;

const SYSTEM_PROMPT = `You are a workflow conversion expert. You analyze screenshots of visual node-based workflows (from tools like Weavy, ComfyUI, n8n, Make.com, or similar) and convert them into Node Banana workflow JSON format.

${NODE_CATALOG}

## Output Format
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, JUST the JSON):
{
  "version": 1,
  "name": "<workflow name inferred from screenshot>",
  "nodes": [
    {
      "id": "<unique id like node_1>",
      "type": "<one of the node types above>",
      "position": { "x": <number>, "y": <number> },
      "data": { <appropriate default data for the node type, with any values visible in screenshot filled in> }
    }
  ],
  "edges": [
    {
      "id": "<unique edge id like edge_1>",
      "source": "<source node id>",
      "target": "<target node id>",
      "sourceHandle": "<handle id like 'image' or 'text'>",
      "targetHandle": "<handle id like 'image' or 'text'>"
    }
  ],
  "edgeStyle": "smoothstep"
}

## Conversion Rules
1. Map each node/block from the screenshot to the closest Node Banana equivalent from the catalog above.
2. For text/prompt blocks, use "prompt" nodes and fill in the text content visible in the screenshot.
3. For any image generation block, use "nanoBanana".
4. For any video generation block, use "generateVideo".
5. For any LLM/AI text block, use "llmGenerate".
6. For any image upload/load block, use "imageInput".
7. For conditional/switch blocks, use "promptConstructor" with template logic.
8. For any output/display/save block, use "output" or "outputGallery".
9. For loop/iteration blocks processing images, use "imageIterator". For text, use "textIterator".
10. Position nodes in a left-to-right flow layout, spaced ~300px apart horizontally and ~150px vertically.
11. Fill in ALL visible text content from the screenshot (prompts, labels, settings).
12. If a node type in the screenshot has no direct equivalent, pick the closest one and add a stickyNote nearby explaining the mapping.
13. Always include at least one output node at the end of the workflow.
14. Edge sourceHandle and targetHandle should match the handle IDs listed in the node catalog (e.g., "image", "text", "video").
15. For nanoBanana nodes, the text input handle is "text" and the image input handle is "image".
`;

export async function POST(request: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`\n[ImportWorkflow:${requestId}] ========== NEW IMPORT REQUEST ==========`);

    try {
        const body = await request.json();
        const { image } = body;

        if (!image) {
            return NextResponse.json(
                { success: false, error: "Screenshot image is required" },
                { status: 400 }
            );
        }

        // Get Gemini API key
        const geminiApiKey =
            request.headers.get("X-Gemini-API-Key") || process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Gemini API key required. Add GEMINI_API_KEY to .env.local or configure in Settings.",
                },
                { status: 401 }
            );
        }

        // Extract base64 data from data URL
        const base64Match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (!base64Match) {
            return NextResponse.json(
                { success: false, error: "Invalid image format. Must be a base64 data URL." },
                { status: 400 }
            );
        }

        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        console.log(`[ImportWorkflow:${requestId}] Image: ${mimeType}, ${Math.round(base64Data.length * 3 / 4 / 1024)}KB`);

        // Call Gemini API with image
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                inlineData: {
                                    mimeType,
                                    data: base64Data,
                                },
                            },
                            {
                                text: "Analyze this screenshot of a workflow and convert it to Node Banana format. Return ONLY the JSON, no markdown fences, no explanation.",
                            },
                        ],
                    },
                ],
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`[ImportWorkflow:${requestId}] Gemini error: ${geminiResponse.status} - ${errorText.substring(0, 500)}`);
            return NextResponse.json(
                {
                    success: false,
                    error: `AI analysis failed (${geminiResponse.status}). Try again.`,
                },
                { status: 500 }
            );
        }

        const geminiResult = await geminiResponse.json();
        console.log(`[ImportWorkflow:${requestId}] Gemini response received`);

        // Extract text from Gemini response
        const responseText =
            geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            console.error(`[ImportWorkflow:${requestId}] No text in Gemini response`);
            return NextResponse.json(
                { success: false, error: "AI returned empty response. Try a clearer screenshot." },
                { status: 500 }
            );
        }

        // Parse the workflow JSON
        let workflow;
        try {
            // Strip markdown fences if present (just in case)
            let jsonText = responseText.trim();
            if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
            }
            workflow = JSON.parse(jsonText);
        } catch (parseError) {
            console.error(`[ImportWorkflow:${requestId}] JSON parse error: ${parseError}`);
            console.error(`[ImportWorkflow:${requestId}] Raw response: ${responseText.substring(0, 1000)}`);
            return NextResponse.json(
                { success: false, error: "AI response was not valid JSON. Try a clearer screenshot." },
                { status: 500 }
            );
        }

        // Validate basic structure
        if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
            return NextResponse.json(
                { success: false, error: "AI could not identify any nodes in the screenshot." },
                { status: 500 }
            );
        }

        // Ensure required fields
        workflow.version = 1;
        workflow.name = workflow.name || "Imported Workflow";
        workflow.edgeStyle = workflow.edgeStyle || "smoothstep";
        workflow.edges = workflow.edges || [];

        // Generate proper IDs if missing
        workflow.nodes = workflow.nodes.map((node: Record<string, unknown>, idx: number) => {
            const type = (node.type as string) || "stickyNote";
            const rawData = (node.data || {}) as Record<string, unknown>;
            return {
                ...node,
                id: node.id || `imported_${idx}`,
                type,
                position: node.position || { x: idx * 300, y: 0 },
                data: hydrateNodeData(type, rawData),
            };
        });

        workflow.edges = workflow.edges.map((edge: Record<string, unknown>, idx: number) => ({
            ...edge,
            id: edge.id || `edge_${idx}`,
        }));

        console.log(`[ImportWorkflow:${requestId}] SUCCESS - ${workflow.nodes.length} nodes, ${workflow.edges.length} edges`);

        return NextResponse.json({
            success: true,
            workflow,
        });
    } catch (error) {
        console.error(`[ImportWorkflow:${requestId}] Error:`, error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Import failed",
            },
            { status: 500 }
        );
    }
}
