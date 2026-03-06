/**
 * Workflow Schema API
 *
 * GET /api/run/schema — Returns the input/output schema of a workflow
 * so external tools know what to send.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractWorkflowSchema } from "@/lib/headlessExecutor";

export async function GET(request: NextRequest) {
    const shareId = request.nextUrl.searchParams.get("shareId");
    const inlineWorkflow = request.nextUrl.searchParams.get("workflow");

    let workflow: Parameters<typeof extractWorkflowSchema>[0] | null = null;

    if (shareId) {
        try {
            const shareResponse = await fetch(
                `${request.nextUrl.origin}/api/share?id=${encodeURIComponent(shareId)}`
            );
            const shareData = await shareResponse.json();
            if (shareData.success && shareData.workflow) {
                workflow = shareData.workflow;
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

    return NextResponse.json({
        success: true,
        ...schema,
    });
}
