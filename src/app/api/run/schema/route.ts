/**
 * Workflow Schema API
 *
 * GET /api/run/schema — Returns the input/output schema of a workflow
 * so external tools know what to send. Includes OpenAPI-compatible
 * request/response schemas and example payloads.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractWorkflowSchema } from "@/lib/headlessExecutor";

export async function GET(request: NextRequest) {
    const shareId = request.nextUrl.searchParams.get("shareId");
    const inlineWorkflow = request.nextUrl.searchParams.get("workflow");

    let workflow: Parameters<typeof extractWorkflowSchema>[0] | null = null;
    let workflowName = "Untitled Workflow";

    if (shareId) {
        try {
            const shareResponse = await fetch(
                `${request.nextUrl.origin}/api/share?id=${encodeURIComponent(shareId)}`
            );
            const shareData = await shareResponse.json();
            if (shareData.success && shareData.workflow) {
                workflow = shareData.workflow;
                workflowName = shareData.workflow.name || workflowName;
            }
        } catch {
            return NextResponse.json(
                { success: false, error: "Failed to load shared workflow" },
                { status: 500 }
            );
        }
    } else if (inlineWorkflow) {
        try {
            workflow = JSON.parse(inlineWorkflow);
            workflowName = (workflow as unknown as Record<string, unknown>)?.name as string || workflowName;
        } catch {
            return NextResponse.json(
                { success: false, error: "Invalid workflow JSON" },
                { status: 400 }
            );
        }
    }

    if (!workflow) {
        return NextResponse.json(
            { success: false, error: "Provide 'shareId' or 'workflow' query parameter" },
            { status: 400 }
        );
    }

    const schema = extractWorkflowSchema(workflow);

    // Build example request payload
    const exampleInputs: Record<string, string> = {};
    for (const input of schema.inputs) {
        if (input.type === "text") {
            exampleInputs[input.nodeId] = `Your ${input.label.toLowerCase()} here`;
        } else if (input.type === "image") {
            exampleInputs[input.nodeId] = "data:image/png;base64,...";
        } else if (input.type === "images") {
            exampleInputs[input.nodeId] = "[\"data:image/png;base64,...\", \"data:image/png;base64,...\"]";
        }
    }

    // Build OpenAPI-compatible request body schema
    const inputProperties: Record<string, object> = {};
    for (const input of schema.inputs) {
        if (input.type === "text") {
            inputProperties[input.nodeId] = {
                type: "string",
                description: input.label,
            };
        } else if (input.type === "image") {
            inputProperties[input.nodeId] = {
                type: "string",
                format: "base64-data-url",
                description: `${input.label} (base64 data URL)`,
            };
        } else if (input.type === "images") {
            inputProperties[input.nodeId] = {
                type: "array",
                items: { type: "string", format: "base64-data-url" },
                description: `${input.label} (array of base64 data URLs)`,
            };
        }
    }

    return NextResponse.json({
        success: true,
        name: workflowName,
        inputs: schema.inputs,
        outputs: schema.outputs,
        // OpenAPI-compatible request schema
        requestSchema: {
            type: "object",
            required: ["inputs", ...(shareId ? [] : ["workflow"])],
            properties: {
                ...(shareId ? { shareId: { type: "string", const: shareId } } : {}),
                inputs: {
                    type: "object",
                    required: schema.inputs.filter((i) => i.required).map((i) => i.nodeId),
                    properties: inputProperties,
                },
                apiKeys: {
                    type: "object",
                    description: "Optional provider API keys. Falls back to server env variables.",
                    properties: {
                        gemini: { type: "string" },
                        openai: { type: "string" },
                        fal: { type: "string" },
                        replicate: { type: "string" },
                        kie: { type: "string" },
                        wavespeed: { type: "string" },
                    },
                },
            },
        },
        // Example request body
        exampleRequest: {
            ...(shareId ? { shareId } : {}),
            inputs: exampleInputs,
        },
        // Curl example
        curl: shareId
            ? `curl -X POST ${request.nextUrl.origin}/api/run \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ shareId, inputs: exampleInputs })}'`
            : `curl -X POST ${request.nextUrl.origin}/api/run \\
  -H "Content-Type: application/json" \\
  -d '{ "workflow": <workflow-json>, "inputs": ${JSON.stringify(exampleInputs)} }'`,
    });
}
