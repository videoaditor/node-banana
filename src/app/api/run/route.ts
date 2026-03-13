/**
 * Workflow Execution API
 *
 * POST /api/run — Execute a workflow headlessly with provided inputs.
 * External tools (Zapier, n8n, scripts) call this to run workflows.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowHeadless } from "@/lib/headlessExecutor";
import { defaultProviderSettings } from "@/store/utils/localStorage";

export const maxDuration = 300; // 5 minute timeout
export const dynamic = "force-dynamic";

interface RunRequest {
    workflow?: {
        version: 1;
        name: string;
        nodes: unknown[];
        edges: unknown[];
        edgeStyle: string;
        groups?: Record<string, unknown>;
    };
    shareId?: string;
    inputs: Record<string, string>;
    apiKeys?: {
        gemini?: string;
        openai?: string;
        fal?: string;
        replicate?: string;
        kie?: string;
        wavespeed?: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: RunRequest = await request.json();
        const { inputs, apiKeys } = body;
        let workflow = body.workflow;

        if (!workflow && !body.shareId) {
            return NextResponse.json(
                { success: false, error: "Either 'workflow' or 'shareId' is required" },
                { status: 400 }
            );
        }

        // Load from share if shareId provided
        if (!workflow && body.shareId) {
            try {
                const shareResponse = await fetch(
                    `${request.nextUrl.origin}/api/share?id=${encodeURIComponent(body.shareId)}`
                );
                const shareData = await shareResponse.json();
                if (!shareData.success || !shareData.workflow) {
                    return NextResponse.json(
                        { success: false, error: "Shared workflow not found" },
                        { status: 404 }
                    );
                }
                workflow = shareData.workflow;
            } catch {
                return NextResponse.json(
                    { success: false, error: "Failed to load shared workflow" },
                    { status: 500 }
                );
            }
        }

        if (!inputs || typeof inputs !== "object") {
            return NextResponse.json(
                { success: false, error: "'inputs' object is required" },
                { status: 400 }
            );
        }

        // Build provider settings from env + request API keys
        const providerSettings = JSON.parse(JSON.stringify(defaultProviderSettings));

        if (apiKeys?.gemini || process.env.GEMINI_API_KEY) {
            providerSettings.providers.gemini = {
                ...providerSettings.providers.gemini,
                apiKey: apiKeys?.gemini || process.env.GEMINI_API_KEY || null,
                enabled: true,
            };
        }
        if (apiKeys?.openai || process.env.OPENAI_API_KEY) {
            providerSettings.providers.openai = {
                ...providerSettings.providers.openai,
                apiKey: apiKeys?.openai || process.env.OPENAI_API_KEY || null,
                enabled: true,
            };
        }
        if (apiKeys?.fal || process.env.FAL_API_KEY) {
            providerSettings.providers.fal = {
                ...providerSettings.providers.fal,
                apiKey: apiKeys?.fal || process.env.FAL_API_KEY || null,
                enabled: true,
            };
        }
        if (apiKeys?.replicate || process.env.REPLICATE_API_KEY) {
            providerSettings.providers.replicate = {
                ...providerSettings.providers.replicate,
                apiKey: apiKeys?.replicate || process.env.REPLICATE_API_KEY || null,
                enabled: true,
            };
        }
        if (apiKeys?.kie || process.env.KIE_API_KEY) {
            providerSettings.providers.kie = {
                ...providerSettings.providers.kie,
                apiKey: apiKeys?.kie || process.env.KIE_API_KEY || null,
                enabled: true,
            };
        }
        if (apiKeys?.wavespeed || process.env.WAVESPEED_API_KEY) {
            providerSettings.providers.wavespeed = {
                ...providerSettings.providers.wavespeed,
                apiKey: apiKeys?.wavespeed || process.env.WAVESPEED_API_KEY || null,
                enabled: true,
            };
        }

        // Execute
        const result = await executeWorkflowHeadless(
            workflow as Parameters<typeof executeWorkflowHeadless>[0],
            inputs,
            providerSettings
        );

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || "Execution failed",
                    executionTimeMs: result.executionTimeMs,
                },
                { status: 500 }
            );
        }

        // Transform outputs to a keyed object for easier consumption
        const outputMap: Record<string, { type: string; data: string; label: string }> = {};
        for (const output of result.outputs) {
            const key = outputMap[output.nodeId]
                ? `${output.nodeId}-${Object.keys(outputMap).filter((k) => k.startsWith(output.nodeId)).length}`
                : output.nodeId;
            outputMap[key] = {
                type: output.type,
                data: output.data,
                label: output.label,
            };
        }

        return NextResponse.json({
            success: true,
            outputs: outputMap,
            executionTimeMs: result.executionTimeMs,
            cost: result.cost,
        });
    } catch (error) {
        console.error("[API:run] Execution error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/run — Returns API documentation and usage info
 */
export async function GET() {
    return NextResponse.json({
        name: "Node Banana Workflow API",
        version: "1.0",
        description: "Execute AI workflows as API endpoints. Discover available apps, get their schemas, and run them with custom inputs.",
        endpoints: {
            run: {
                method: "POST",
                path: "/api/run",
                description: "Execute a workflow with provided inputs and receive outputs.",
                request: {
                    workflow: "WorkflowFile JSON (required if no shareId)",
                    shareId: "Share ID to load workflow from (alternative to inline workflow)",
                    inputs: {
                        description: "Map of nodeId → value. Text prompts as strings, images as base64 data URLs.",
                        example: {
                            "prompt-1": "A beautiful sunset over Tokyo",
                            "imageInput-2": "data:image/png;base64,...",
                        },
                    },
                    apiKeys: {
                        description: "Optional provider API keys. Falls back to server env variables.",
                        fields: ["gemini", "openai", "fal", "replicate", "kie", "wavespeed"],
                    },
                },
                response: {
                    success: "boolean",
                    outputs: "Map of nodeId → { type: 'image'|'video'|'text'|'3d', data: string, label: string }",
                    executionTimeMs: "number",
                    cost: "number",
                },
            },
            schema: {
                method: "GET",
                path: "/api/run/schema?shareId=<id>",
                description: "Get input/output schema for a workflow, including OpenAPI-compatible request schema and curl example.",
            },
            apps: {
                method: "GET",
                path: "/api/apps",
                description: "List all published workflow apps with schemas and share IDs.",
            },
            share: {
                method: "POST",
                path: "/api/share",
                description: "Publish a workflow. Returns a shareId for use in /api/run and /app/<shareId>.",
            },
        },
        quickstart: [
            "1. GET /api/apps → discover available workflows",
            "2. GET /api/run/schema?shareId=<id> → get input/output schema + curl example",
            "3. POST /api/run { shareId, inputs } → execute and get results",
        ],
    });
}
