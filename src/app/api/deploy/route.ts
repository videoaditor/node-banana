/**
 * Deploy API Route
 * 
 * Pulls latest from git, installs deps, rebuilds, and restarts the service.
 * Used by the restart button in the Header.
 */

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
    const projectPath = "/Users/player/clawd/projects/node-banana";

    try {
        // Step 1: git pull
        const pull = await execAsync("git pull origin develop", { cwd: projectPath, timeout: 30000 });
        console.log("[Deploy] git pull:", pull.stdout.trim());

        // Step 2: npm install (only if needed)
        const install = await execAsync("npm install --prefer-offline", { cwd: projectPath, timeout: 60000 });
        console.log("[Deploy] npm install:", install.stdout.slice(0, 200));

        // Step 3: Build
        const build = await execAsync("npm run build", { cwd: projectPath, timeout: 120000 });
        console.log("[Deploy] build:", build.stdout.slice(-200));

        // Step 4: Restart the launchd service
        const uid = (await execAsync("id -u")).stdout.trim();
        await execAsync(`launchctl kickstart -k gui/${uid}/com.aditor.node-banana`, { timeout: 10000 });
        console.log("[Deploy] Service restarted");

        return NextResponse.json({
            success: true,
            message: "Deploy complete — service restarting",
            git: pull.stdout.trim(),
        });
    } catch (error) {
        console.error("[Deploy] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Deploy failed",
            },
            { status: 500 }
        );
    }
}
