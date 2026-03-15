import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "@/utils/logger";
import os from "os";

export const maxDuration = 300; // 5 minute timeout for large workflow files

// Default projects directory
const DEFAULT_PROJECTS_DIR = path.join(os.homedir(), "clawd", "projects", "node-banana-workflows");

// POST: Save workflow to file
export async function POST(request: NextRequest) {
  let directoryPath: string = DEFAULT_PROJECTS_DIR;
  let filename: string | undefined;
  try {
    const body = await request.json();
    directoryPath = body.directoryPath || DEFAULT_PROJECTS_DIR;
    filename = body.filename;
    const workflow = body.workflow;

    logger.info('file.save', 'Workflow save request received', {
      directoryPath,
      filename,
      hasWorkflow: !!workflow,
      nodeCount: workflow?.nodes?.length,
      edgeCount: workflow?.edges?.length,
      usedDefault: !body.directoryPath,
    });

    if (!filename || !workflow) {
      logger.warn('file.save', 'Workflow save validation failed: missing fields', {
        hasDirectoryPath: !!directoryPath,
        hasFilename: !!filename,
        hasWorkflow: !!workflow,
      });
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ensure directory exists (create if using default, validate if custom)
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) {
        logger.warn('file.error', 'Workflow save failed: path is not a directory', {
          directoryPath,
        });
        return NextResponse.json(
          { success: false, error: "Path is not a directory" },
          { status: 400 }
        );
      }
    } catch (dirError) {
      logger.warn('file.error', 'Workflow save failed: could not create/access directory', {
        directoryPath,
        error: dirError instanceof Error ? dirError.message : 'Unknown error',
      });
      return NextResponse.json(
        { success: false, error: "Could not create or access directory" },
        { status: 400 }
      );
    }

    // Auto-create subfolders for inputs and generations
    const inputsFolder = path.join(directoryPath, "inputs");
    const generationsFolder = path.join(directoryPath, "generations");

    try {
      await fs.mkdir(inputsFolder, { recursive: true });
      await fs.mkdir(generationsFolder, { recursive: true });
    } catch (mkdirError) {
      logger.warn('file.save', 'Failed to create subfolders (non-fatal)', {
        inputsFolder,
        generationsFolder,
        error: mkdirError instanceof Error ? mkdirError.message : 'Unknown error',
      });
      // Continue anyway - folders may already exist or be created later
    }

    // Sanitize filename (remove special chars, ensure .json extension)
    const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, "_");
    const filePath = path.join(directoryPath, `${safeName}.json`);

    // Write workflow JSON
    const json = JSON.stringify(workflow, null, 2);
    await fs.writeFile(filePath, json, "utf-8");

    logger.info('file.save', 'Workflow saved successfully', {
      filePath,
      fileSize: json.length,
    });

    return NextResponse.json({
      success: true,
      filePath,
    });
  } catch (error) {
    logger.error('file.error', 'Failed to save workflow', {
      directoryPath,
      filename,
    }, error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Save failed",
      },
      { status: 500 }
    );
  }
}

// GET: Load workflow from file or validate directory path
export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  logger.info('file.load', 'Load request received', {
    filePath,
  });

  if (!filePath) {
    logger.warn('file.load', 'Load failed: missing path parameter');
    return NextResponse.json(
      { success: false, error: "Path parameter required" },
      { status: 400 }
    );
  }

  try {
    const stats = await fs.stat(filePath);

    // If it's a directory, return validation info (legacy behavior)
    if (stats.isDirectory()) {
      logger.info('file.load', 'Directory validation successful', {
        filePath,
        exists: true,
        isDirectory: true,
      });
      return NextResponse.json({
        success: true,
        exists: true,
        isDirectory: true,
      });
    }

    // If it's a file, load and return the workflow
    if (stats.isFile()) {
      const content = await fs.readFile(filePath, "utf-8");
      const workflow = JSON.parse(content);

      logger.info('file.load', 'Workflow loaded successfully', {
        filePath,
        nodeCount: workflow?.nodes?.length,
        edgeCount: workflow?.edges?.length,
      });

      return NextResponse.json({
        success: true,
        workflow,
      });
    }

    return NextResponse.json(
      { success: false, error: "Path is neither a file nor a directory" },
      { status: 400 }
    );
  } catch (error) {
    logger.error('file.load', 'Failed to load workflow', {
      filePath,
    }, error instanceof Error ? error : undefined);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load workflow",
    }, { status: 500 });
  }
}
