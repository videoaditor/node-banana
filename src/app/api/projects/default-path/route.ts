import { NextResponse } from "next/server";
import path from "path";
import os from "os";

// Default projects directory
const DEFAULT_PROJECTS_DIR = path.join(os.homedir(), "clawd", "projects", "node-banana-workflows");

// GET: Return the default projects directory path
export async function GET() {
  return NextResponse.json({
    success: true,
    defaultPath: DEFAULT_PROJECTS_DIR,
  });
}
