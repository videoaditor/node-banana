import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "@/utils/logger";

// GET: Return workflow JSON content for a specific project file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const directoryPath = request.nextUrl.searchParams.get("path");

  if (!directoryPath || !filename) {
    return NextResponse.json(
      { success: false, error: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Sanitize filename to prevent path traversal
  const safeFilename = path.basename(filename);
  if (!safeFilename.endsWith(".json")) {
    return NextResponse.json(
      { success: false, error: "Invalid filename" },
      { status: 400 }
    );
  }

  const filePath = path.join(directoryPath, safeFilename);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const workflow = JSON.parse(content);

    logger.info("file.load", "Loaded project workflow", {
      filePath,
      nodeCount: workflow.nodes?.length,
    });

    return NextResponse.json({ success: true, workflow, filePath });
  } catch (error) {
    logger.error(
      "file.load",
      "Failed to load project",
      { filePath },
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load project",
      },
      { status: 500 }
    );
  }
}
