import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

const TEAM_WORKFLOWS_DIR = path.join(process.cwd(), ".shared-workflows");

async function ensureDir() {
  await fs.mkdir(TEAM_WORKFLOWS_DIR, { recursive: true });
}

// GET: List all team workflows
export async function GET() {
  await ensureDir();

  try {
    const entries = await fs.readdir(TEAM_WORKFLOWS_DIR, { withFileTypes: true });
    const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

    const workflows = await Promise.all(
      jsonFiles.map(async (entry) => {
        const filePath = path.join(TEAM_WORKFLOWS_DIR, entry.name);
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const workflow = JSON.parse(content);
          const name = workflow.name || entry.name.replace(/\.json$/, "");
          const nodeCount = Array.isArray(workflow.nodes) ? workflow.nodes.length : 0;

          // Extract preview image
          let previewDataUrl: string | null = null;
          if (Array.isArray(workflow.nodes)) {
            const priority = ["output", "outputGallery", "nanoBanana", "generateVideo", "imageInput"];
            for (const nodeType of priority) {
              const node = workflow.nodes.find((n: { type: string }) => n.type === nodeType);
              if (node?.data) {
                const img =
                  node.data.image ||
                  (Array.isArray(node.data.images) && node.data.images[0]) ||
                  (Array.isArray(node.data.history) && node.data.history[0]?.image) ||
                  null;
                if (img && typeof img === "string" && img.startsWith("data:image")) {
                  previewDataUrl = img;
                  break;
                }
              }
            }
          }

          const hash = name.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
          const placeholderColor = `hsl(${hash % 360}, 70%, 60%)`;

          return {
            name,
            filename: entry.name,
            path: filePath,
            modifiedAt: stat.mtime.toISOString(),
            nodeCount,
            previewDataUrl,
            placeholderColor,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = workflows
      .filter(Boolean)
      .sort((a, b) => new Date(b!.modifiedAt).getTime() - new Date(a!.modifiedAt).getTime());

    return NextResponse.json({ success: true, workflows: valid });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list team workflows" },
      { status: 500 }
    );
  }
}

// POST: Save a workflow to .shared-workflows/
export async function POST(request: NextRequest) {
  await ensureDir();

  try {
    const { workflow } = await request.json();
    if (!workflow || !workflow.name) {
      return NextResponse.json({ success: false, error: "Missing workflow or workflow.name" }, { status: 400 });
    }

    // Use workflow name as filename (sanitized)
    const sanitized = workflow.name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || "workflow";
    const filename = `${sanitized}.json`;
    const filePath = path.join(TEAM_WORKFLOWS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), "utf-8");

    return NextResponse.json({ success: true, filename });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save team workflow" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a workflow from .shared-workflows/
export async function DELETE(request: NextRequest) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return NextResponse.json({ success: false, error: "Missing filename" }, { status: 400 });
    }

    // Security: only allow filenames without path separators
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return NextResponse.json({ success: false, error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(TEAM_WORKFLOWS_DIR, filename);
    await fs.unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete team workflow" },
      { status: 500 }
    );
  }
}
