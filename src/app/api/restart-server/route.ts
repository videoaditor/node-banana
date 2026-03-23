import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST() {
  try {
    // Pull latest + build + restart via deploy script (fire and forget)
    exec("bash /Users/player/clawd/scripts/auto-deploy.sh banana >> /tmp/auto-deploy.log 2>&1");

    return NextResponse.json({ success: true, message: "Pulling + rebuilding + restarting..." });
  } catch (error) {
    console.error("Failed to trigger deploy:", error);
    return NextResponse.json(
      { success: false, error: "Failed to restart" },
      { status: 500 }
    );
  }
}
