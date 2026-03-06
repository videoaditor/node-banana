/**
 * Workflow Sharing API
 *
 * POST /api/share — Publish a workflow for sharing. Stores workflow JSON
 *                   in a local JSON file store (upgradeable to Cloudflare R2).
 * GET  /api/share — Retrieve a shared workflow by ID.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

// Local storage directory for shared workflows
// In production, this would be Cloudflare R2 via Workers
const SHARE_DIR = path.join(process.cwd(), ".shared-workflows");

/**
 * Generate a short, URL-safe share ID
 */
function generateShareId(): string {
    return crypto.randomBytes(6).toString("base64url"); // 8 chars, URL-safe
}

/**
 * Strip heavy base64 image data from workflow for storage efficiency.
 * Only strips generated outputs (not user-uploaded inputs which are needed for schema).
 */
function stripHeavyData(workflow: Record<string, unknown>): Record<string, unknown> {
    const stripped = JSON.parse(JSON.stringify(workflow));
    if (Array.isArray(stripped.nodes)) {
        for (const node of stripped.nodes) {
            if (!node.data) continue;

            // Strip generated output images (they'll be regenerated on run)
            if (node.type === "nanoBanana") {
                node.data.outputImage = null;
                node.data.imageHistory = [];
            }
            if (node.type === "generateVideo") {
                node.data.outputVideo = null;
                node.data.videoHistory = [];
            }
            if (node.type === "generate3d") {
                node.data.output3dUrl = null;
            }
            if (node.type === "llmGenerate") {
                node.data.outputText = null;
                node.data.outputHistory = [];
            }
            if (node.type === "output") {
                node.data.image = null;
                node.data.video = null;
            }
            if (node.type === "outputGallery") {
                node.data.images = [];
            }
        }
    }
    return stripped;
}

/**
 * POST: Publish a workflow for sharing
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workflow } = body;

        if (!workflow || !workflow.nodes || !workflow.edges) {
            return NextResponse.json(
                { success: false, error: "Invalid workflow data" },
                { status: 400 }
            );
        }

        // Ensure share directory exists
        await fs.mkdir(SHARE_DIR, { recursive: true });

        // Generate share ID
        const shareId = generateShareId();

        // Strip heavy data for efficient storage
        const stripped = stripHeavyData(workflow);

        // Add share metadata
        const shareData = {
            ...stripped,
            _shareId: shareId,
            _sharedAt: new Date().toISOString(),
        };

        // Save to file
        const filePath = path.join(SHARE_DIR, `${shareId}.json`);
        await fs.writeFile(filePath, JSON.stringify(shareData, null, 2), "utf-8");

        return NextResponse.json({
            success: true,
            shareId,
            url: `/app/${shareId}`,
        });
    } catch (error) {
        console.error("[API:share] Failed to publish workflow:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to share workflow",
            },
            { status: 500 }
        );
    }
}

/**
 * GET: Retrieve a shared workflow
 */
export async function GET(request: NextRequest) {
    const shareId = request.nextUrl.searchParams.get("id");

    if (!shareId) {
        return NextResponse.json(
            { success: false, error: "Missing 'id' query parameter" },
            { status: 400 }
        );
    }

    // Sanitize shareId to prevent path traversal
    const safeId = shareId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (safeId !== shareId) {
        return NextResponse.json(
            { success: false, error: "Invalid share ID" },
            { status: 400 }
        );
    }

    try {
        const filePath = path.join(SHARE_DIR, `${safeId}.json`);
        const content = await fs.readFile(filePath, "utf-8");
        const workflow = JSON.parse(content);

        // Remove internal metadata before returning
        delete workflow._shareId;
        delete workflow._sharedAt;

        return NextResponse.json({
            success: true,
            workflow,
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return NextResponse.json(
                { success: false, error: "Shared workflow not found" },
                { status: 404 }
            );
        }
        console.error("[API:share] Failed to load shared workflow:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load shared workflow" },
            { status: 500 }
        );
    }
}
