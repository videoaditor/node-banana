import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "@/utils/logger";

// GET: List all workflow JSON files in a project directory
export async function GET(request: NextRequest) {
  const directoryPath = request.nextUrl.searchParams.get("path");

  if (!directoryPath) {
    return NextResponse.json(
      { success: false, error: "Missing 'path' query parameter" },
      { status: 400 }
    );
  }

  try {
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { success: false, error: "Path is not a directory" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ success: true, projects: [] });
  }

  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const jsonFiles = entries.filter(
      (e) => e.isFile() && e.name.endsWith(".json")
    );

    const projects = await Promise.all(
      jsonFiles.map(async (entry) => {
        const filePath = path.join(directoryPath, entry.name);
        try {
          const fileStat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const workflow = JSON.parse(content);
          const nodeCount =
            Array.isArray(workflow.nodes) ? workflow.nodes.length : 0;
          const name =
            workflow.name || entry.name.replace(/\.json$/, "").replace(/_/g, " ");

          // Extract preview image from workflow nodes
          // Priority: output node image > nanoBanana generated image > imageInput node image
          let previewDataUrl: string | null = null;
          if (Array.isArray(workflow.nodes)) {
            const priority = ["output", "outputGallery", "nanoBanana", "generateVideo", "imageInput", "annotation"];
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

          // Generate a color based on workflow name hash (for placeholder gradients)
          const hash = name.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
          const hue = hash % 360;
          const color = `hsl(${hue}, 70%, 60%)`;

          return {
            name,
            filename: entry.name,
            path: filePath,
            modifiedAt: fileStat.mtime.toISOString(),
            nodeCount,
            previewDataUrl,
            placeholderColor: color,
          };
        } catch {
          return null;
        }
      })
    );

    const validProjects = projects
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b!.modifiedAt).getTime() - new Date(a!.modifiedAt).getTime()
      );

    logger.info("file.load", "Listed projects", {
      directoryPath,
      count: validProjects.length,
    });

    return NextResponse.json({ success: true, projects: validProjects });
  } catch (error) {
    logger.error(
      "file.load",
      "Failed to list projects",
      { directoryPath },
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list projects",
      },
      { status: 500 }
    );
  }
}
