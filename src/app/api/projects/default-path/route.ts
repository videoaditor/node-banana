import { NextResponse } from "next/server";
import { getDefaultProjectsDir } from "@/utils/paths";

// Default projects directory
const DEFAULT_PROJECTS_DIR = getDefaultProjectsDir();

// GET: Return the default projects directory path
export async function GET() {
  return NextResponse.json({
    success: true,
    defaultPath: DEFAULT_PROJECTS_DIR,
  });
}
