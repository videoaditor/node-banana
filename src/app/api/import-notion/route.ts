/**
 * Import Workflow from Notion SOP
 *
 * Accepts a Notion page URL, scrapes the SOP content (steps, descriptions,
 * embedded Loom video transcripts), and uses Gemini to convert it into
 * a Node Banana workflow JSON.
 *
 * POST /api/import-notion
 * Body: { url: string }
 * Response: { success: true, workflow: WorkflowFile, sopContent: string }
 *         | { success: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createDefaultNodeData } from "@/store/utils/nodeDefaults";
import { NodeType } from "@/types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// ---- Notion Page Scraping ----

function extractTextFromHtml(html: string): string {
    // Extract readable text from the HTML
    // Notion pages render content in data attributes and text nodes
    let text = "";

    // Remove scripts, styles, and SVGs
    const cleaned = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

    // Extract text from common notion content blocks
    // Title
    const titleMatch = cleaned.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
        text += `# ${decodeHtmlEntities(titleMatch[1])}\n\n`;
    }

    // Extract all visible text from block elements
    const blockRegex = /<(?:p|h[1-6]|li|td|th|div|span|blockquote)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li|td|th|div|span|blockquote)>/gi;
    let match;
    const seenText = new Set<string>();

    while ((match = blockRegex.exec(cleaned)) !== null) {
        const stripped = decodeHtmlEntities(
            match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        );
        // Skip empty or very short text, and deduplicate
        if (stripped.length > 2 && !seenText.has(stripped)) {
            seenText.add(stripped);
            text += stripped + "\n";
        }
    }

    // Also try to extract data from Notion's JSON data blocks
    const jsonDataRegex = /"text":\s*"([^"]+)"/g;
    while ((match = jsonDataRegex.exec(html)) !== null) {
        const decoded = match[1]
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\u[\dA-F]{4}/gi, (m) =>
                String.fromCharCode(parseInt(m.slice(2), 16))
            );
        if (decoded.length > 3 && !seenText.has(decoded)) {
            seenText.add(decoded);
            text += decoded + "\n";
        }
    }

    return text.trim();
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&#x([0-9A-F]+);/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
}

// ---- Loom Transcript Extraction ----

async function extractLoomUrls(html: string): Promise<string[]> {
    const loomRegex = /https?:\/\/(?:www\.)?loom\.com\/share\/[a-zA-Z0-9]+/g;
    const matches = html.match(loomRegex) || [];
    return [...new Set(matches)];
}

async function fetchLoomTranscript(loomUrl: string): Promise<string> {
    try {
        // Try oEmbed first for metadata
        const oembedUrl = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(loomUrl)}`;
        const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });

        let title = "";
        if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            title = oembedData.title || "";
        }

        // Fetch the Loom page HTML to extract transcript
        const pageRes = await fetch(loomUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!pageRes.ok) {
            return title ? `[Loom video: "${title}"]` : `[Loom video: ${loomUrl}]`;
        }

        const html = await pageRes.text();

        // Loom embeds transcript data in their page as JSON
        // Look for transcript in various formats
        let transcript = "";

        // Method 1: Try to find transcript in __NEXT_DATA__ or similar JSON blocks
        const jsonBlocks = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonBlocks) {
            try {
                const data = JSON.parse(jsonBlocks[1]);
                const transcriptText = findTranscriptInObject(data);
                if (transcriptText) {
                    transcript = transcriptText;
                }
            } catch {
                // JSON parse failed
            }
        }

        // Method 2: Look for transcript text in window.__LOOM_SSR_STATE__
        if (!transcript) {
            const ssrMatch = html.match(/window\.__LOOM_SSR_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
            if (ssrMatch) {
                try {
                    const data = JSON.parse(ssrMatch[1]);
                    const transcriptText = findTranscriptInObject(data);
                    if (transcriptText) {
                        transcript = transcriptText;
                    }
                } catch {
                    // JSON parse failed
                }
            }
        }

        // Method 3: Look for transcript-related JSON anywhere
        if (!transcript) {
            const transcriptJsonMatch = html.match(/"transcript":\s*(\[[\s\S]*?\])/);
            if (transcriptJsonMatch) {
                try {
                    const segments = JSON.parse(transcriptJsonMatch[1]);
                    transcript = segments
                        .map((seg: { text?: string; value?: string }) => seg.text || seg.value || "")
                        .filter(Boolean)
                        .join(" ");
                } catch {
                    // JSON parse failed
                }
            }
        }

        if (transcript) {
            return `[Loom Video: "${title}"]\nTranscript: ${transcript}`;
        }

        return title ? `[Loom video: "${title}" - transcript not available]` : `[Loom video: ${loomUrl}]`;
    } catch (err) {
        console.error(`Failed to fetch Loom transcript for ${loomUrl}:`, err);
        return `[Loom video: ${loomUrl} - could not fetch]`;
    }
}

// Recursively search an object for transcript-like content
function findTranscriptInObject(obj: unknown, depth = 0): string | null {
    if (depth > 10) return null;
    if (typeof obj !== "object" || obj === null) return null;

    // Check if this object has transcript-related keys
    const record = obj as Record<string, unknown>;
    if (record.transcript && typeof record.transcript === "string") {
        return record.transcript;
    }
    if (record.transcription && typeof record.transcription === "string") {
        return record.transcription;
    }
    if (Array.isArray(record.transcript)) {
        const texts = record.transcript
            .map((item: unknown) => {
                if (typeof item === "string") return item;
                if (typeof item === "object" && item !== null) {
                    const r = item as Record<string, unknown>;
                    return r.text || r.value || r.content || "";
                }
                return "";
            })
            .filter(Boolean);
        if (texts.length > 0) return texts.join(" ");
    }

    // Recurse into child objects
    for (const key of Object.keys(record)) {
        const result = findTranscriptInObject(record[key], depth + 1);
        if (result) return result;
    }

    return null;
}

// ---- Gemini Workflow Generation ----

const NODE_CATALOG = `
## Available Node Types for SOP Workflows

### Input Nodes
- **imageInput**: Upload/load images. Use for steps like "upload product photo", "add reference image".
  Handles: output "image" (right).

- **prompt**: Text input. Use for step descriptions, parameters, instructions.
  Handles: output "text" (right).

- **imageIterator**: Process multiple images. Use for "for each image", "process all photos".
  Handles: input "image" (left), output "image" (right).

- **textIterator**: Split and process text segments. Use for "for each line", "process each item".
  Handles: input "text" (left), output "text" (right).

- **annotation**: Draw/paint on images. Use for "annotate", "mark up", "circle the area", "add overlay".
  Handles: input "image" (left), output "image" (right).

### Processing Nodes
- **promptConstructor**: Template builder with @variable interpolation. Use for assembling complex prompts from multiple inputs.
  Handles: inputs "text-0","text-1",... (left, up to 6), output "text" (right).

- **promptConcatenator**: Join multiple text inputs with a separator. Use for combining descriptions, merging text.
  Handles: inputs "text-0","text-1",... (left), output "text" (right).

- **llmGenerate**: AI text generation (Gemini). Use for "write description", "analyze", "summarize", "review".
  Handles: input "text" (left), input "image" (left), output "text" (right).

- **webScraper**: Fetch content from URLs. Use for "get reference from website", "scrape page".
  Handles: input "text" (left, URL), output "image" or "text" (right).

### Generation Nodes
- **nanoBanana**: AI image generation. Use for "generate image", "create visual", "make photo".
  Handles: input "image" (left), input "text" (left), output "image" (right).

- **generateVideo**: AI video generation. Use for "create video", "generate clip".
  Handles: input "image" (left), input "text" (left), output "video" (right).

- **generate3d**: AI 3D model generation. Use for "create 3D model", "generate 3D".
  Handles: input "image" (left), input "text" (left), output "3d" (right).

### Output Nodes
- **output**: Display final result. Use for "save", "export", "final output".
  Handles: input "image" (left), input "video" (left).

- **outputGallery**: Grid of output images. Use for "review all", "select best", "compare results".
  Handles: input "image" (left).

### Utility Nodes
- **stickyNote**: Colored annotation note. Use for SOP step descriptions, context, and instructions that don't need data flow.
  Data: { text: "<note text>", color: "yellow" | "green" | "blue" | "pink" | "orange" }
`;

const SYSTEM_PROMPT = `You are an SOP-to-workflow converter. You analyze Standard Operating Procedures (SOPs) from Notion pages and convert them into Node Banana visual workflows.

${NODE_CATALOG}

## Conversion Strategy
1. Each SOP step that involves a concrete action should become one or more connected nodes.
2. Steps about uploading/providing materials → imageInput or prompt nodes.
3. Steps about writing text/copy/descriptions → prompt nodes (with the text filled in if visible) or llmGenerate.
4. Steps about generating images/visuals → nanoBanana nodes.
5. Steps about generating video → generateVideo nodes.
5b. Steps about generating 3D models → generate3d nodes.
5c. Steps about marking up/annotating images → annotation nodes.
6. Steps about reviewing/approving → outputGallery or output nodes.
7. Steps that are purely informational → stickyNote nodes (colored by importance: orange=critical, yellow=info, blue=context).
8. Steps about iterating/repeating → imageIterator or textIterator.
9. Steps about analyzing/writing with AI → llmGenerate.
10. Connect nodes left-to-right: inputs → processing → generation → output.
11. Include Loom video transcripts as stickyNote annotations near relevant steps.
12. Fill in any specific instructions, prompts, or settings mentioned in the SOP.

## Output Format
Return ONLY valid JSON (no markdown, no explanation):
{
  "version": 1,
  "name": "<workflow name from SOP title>",
  "nodes": [
    {
      "id": "<unique id>",
      "type": "<node type>",
      "position": { "x": <number>, "y": <number> },
      "data": { <node data with SOP content filled in> }
    }
  ],
  "edges": [
    {
      "id": "<edge id>",
      "source": "<source node id>",
      "target": "<target node id>",
      "sourceHandle": "<handle id>",
      "targetHandle": "<handle id>"
    }
  ],
  "edgeStyle": "smoothstep"
}

## Layout Guidelines
- Arrange nodes left-to-right, top-to-bottom.
- Space nodes ~300px horizontally, ~200px vertically.
- Place stickyNote annotations above or below the nodes they describe.
- Group related steps vertically when they feed into the same output.
`;

export async function POST(request: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`\n[ImportNotion:${requestId}] ========== NEW NOTION IMPORT ==========`);

    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json(
                { success: false, error: "Notion page URL is required" },
                { status: 400 }
            );
        }

        // Validate URL looks like Notion
        if (!url.includes("notion.so") && !url.includes("notion.site")) {
            return NextResponse.json(
                { success: false, error: "URL must be a Notion page (notion.so or notion.site)" },
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
                    error: "Gemini API key required for AI conversion.",
                },
                { status: 401 }
            );
        }

        // Step 1: Fetch Notion page content
        console.log(`[ImportNotion:${requestId}] Fetching Notion page: ${url}`);

        let rawHtml: string;
        let pageContent: string;

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html",
                },
                redirect: "follow",
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            rawHtml = await response.text();
            // Extract text content from the already-fetched HTML
            pageContent = extractTextFromHtml(rawHtml);
        } catch (err) {
            console.error(`[ImportNotion:${requestId}] Fetch error:`, err);
            return NextResponse.json(
                {
                    success: false,
                    error: "Could not fetch Notion page. Make sure it's shared publicly (Share → Share to web).",
                },
                { status: 400 }
            );
        }

        if (pageContent.length < 20) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Page appears empty or not public. Make sure it's shared publicly via Share → Share to web.",
                },
                { status: 400 }
            );
        }

        console.log(`[ImportNotion:${requestId}] Page content: ${pageContent.length} chars`);

        // Step 2: Extract Loom URLs and fetch transcripts
        const loomUrls = await extractLoomUrls(rawHtml);
        console.log(`[ImportNotion:${requestId}] Found ${loomUrls.length} Loom videos`);

        let loomContent = "";
        if (loomUrls.length > 0) {
            const transcripts = await Promise.all(
                loomUrls.slice(0, 5).map(fetchLoomTranscript) // Max 5 Loom videos
            );
            loomContent = "\n\n## Embedded Video Transcripts\n" + transcripts.join("\n\n");
        }

        const fullContent = pageContent + loomContent;
        console.log(`[ImportNotion:${requestId}] Total content: ${fullContent.length} chars (incl. ${loomUrls.length} Loom transcripts)`);

        // Step 3: Send to Gemini for workflow generation
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Convert this SOP (Standard Operating Procedure) into a Node Banana workflow. Return ONLY the JSON.\n\n---\n\n${fullContent.substring(0, 30000)}`,
                            },
                        ],
                    },
                ],
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                generationConfig: {
                    temperature: 0.15,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`[ImportNotion:${requestId}] Gemini error: ${geminiResponse.status} - ${errorText.substring(0, 500)}`);
            return NextResponse.json(
                { success: false, error: `AI analysis failed (${geminiResponse.status})` },
                { status: 500 }
            );
        }

        const geminiResult = await geminiResponse.json();
        const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            return NextResponse.json(
                { success: false, error: "AI returned empty response. The SOP might be too short." },
                { status: 500 }
            );
        }

        // Parse workflow JSON
        let workflow;
        try {
            let jsonText = responseText.trim();
            if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
            }
            workflow = JSON.parse(jsonText);
        } catch {
            console.error(`[ImportNotion:${requestId}] JSON parse error. Raw: ${responseText.substring(0, 500)}`);
            return NextResponse.json(
                { success: false, error: "AI response was not valid JSON. Try again." },
                { status: 500 }
            );
        }

        // Validate
        if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
            return NextResponse.json(
                { success: false, error: "AI could not identify any steps in the SOP." },
                { status: 500 }
            );
        }

        // Ensure required fields
        workflow.version = 1;
        workflow.name = workflow.name || "Imported SOP";
        workflow.edgeStyle = workflow.edgeStyle || "smoothstep";
        workflow.edges = workflow.edges || [];

        workflow.nodes = workflow.nodes.map((node: Record<string, unknown>, idx: number) => {
            const type = (node.type as string) || "stickyNote";
            const rawData = (node.data || {}) as Record<string, unknown>;

            // Hydrate with defaults so all required fields exist
            const data = { ...createDefaultNodeData(type as NodeType), ...rawData };

            // Auto-mark input nodes as app inputs so the workflow
            // can be used as an API endpoint right away
            if (type === "prompt" || type === "imageInput" || type === "imageIterator") {
                data.isAppInput = true;
            }

            return {
                ...node,
                id: node.id || `sop_${idx}`,
                type,
                position: node.position || { x: idx * 300, y: 0 },
                data,
            };
        });

        workflow.edges = workflow.edges.map((edge: Record<string, unknown>, idx: number) => ({
            ...edge,
            id: edge.id || `edge_${idx}`,
        }));

        console.log(`[ImportNotion:${requestId}] SUCCESS - ${workflow.nodes.length} nodes, ${workflow.edges.length} edges`);

        return NextResponse.json({
            success: true,
            workflow,
            sopContent: fullContent.substring(0, 2000), // Preview for the UI
        });
    } catch (error) {
        console.error(`[ImportNotion:${requestId}] Error:`, error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Import failed" },
            { status: 500 }
        );
    }
}
