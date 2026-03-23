/**
 * Apps Discovery API
 *
 * GET /api/apps — List all published workflow apps with their schemas.
 * External agents and tools use this to discover available workflows
 * and understand their input/output contracts.
 */

import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { extractWorkflowSchema } from "@/lib/headlessExecutor";

const SHARE_DIR = path.join(process.cwd(), ".shared-workflows");

export const dynamic = "force-dynamic";

interface AppListItem {
    shareId: string;
    name: string;
    sharedAt: string;
    url: string;
    apiEndpoint: string;
    schemaEndpoint: string;
    inputs: Array<{
        nodeId: string;
        type: string;
        label: string;
        required: boolean;
    }>;
    outputs: Array<{
        nodeId: string;
        type: string;
        label: string;
    }>;
}

export async function GET() {
    try {
        // Ensure directory exists
        try {
            await fs.access(SHARE_DIR);
        } catch {
            return NextResponse.json({
                success: true,
                apps: [],
                count: 0,
            });
        }

        const files = await fs.readdir(SHARE_DIR);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));

        const apps: AppListItem[] = [];

        for (const file of jsonFiles) {
            try {
                const filePath = path.join(SHARE_DIR, file);
                const content = await fs.readFile(filePath, "utf-8");
                const workflow = JSON.parse(content);

                const shareId = workflow._shareId || file.replace(".json", "");
                const sharedAt = workflow._sharedAt || "";

                // Extract schema
                const schema = extractWorkflowSchema(workflow);

                apps.push({
                    shareId,
                    name: workflow.name || "Untitled Workflow",
                    sharedAt,
                    url: `/app/${shareId}`,
                    apiEndpoint: `POST /api/run  { "shareId": "${shareId}", "inputs": { ... } }`,
                    schemaEndpoint: `/api/run/schema?shareId=${shareId}`,
                    inputs: schema.inputs,
                    outputs: schema.outputs,
                });
            } catch {
                // Skip malformed files
                continue;
            }
        }

        // Sort by newest first
        apps.sort((a, b) => (b.sharedAt || "").localeCompare(a.sharedAt || ""));

        return NextResponse.json({
            success: true,
            apps,
            count: apps.length,
        });
    } catch (error) {
        console.error("[API:apps] Failed to list apps:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list apps",
            },
            { status: 500 }
        );
    }
}
