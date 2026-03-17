/**
 * Deploy API Route
 * 
 * Accepts GitHub webhooks or direct POSTs to trigger deployment.
 * Pulls latest from git, installs deps, rebuilds, and restarts the service.
 */

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

const WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET || "changeme";

function verifySignature(payload: string, signature: string | null): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    const projectPath = "/Users/player/clawd/projects/node-banana";

    try {
        // Read body for webhook verification
        const body = await request.text();
        const signature = request.headers.get('x-hub-signature-256');

        // If signature is provided, verify it (GitHub webhook)
        if (signature) {
            if (!verifySignature(body, signature)) {
                console.log('[Deploy] Invalid webhook signature');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }

            // Check if this is a push to develop branch
            try {
                const payload = JSON.parse(body);
                if (payload.ref !== 'refs/heads/develop') {
                    console.log(`[Deploy] Ignoring push to ${payload.ref}`);
                    return NextResponse.json({ message: 'Ignored (not develop branch)' });
                }
                console.log(`[Deploy] GitHub webhook received for ${payload.repository?.name}`);
            } catch (e) {
                console.error('[Deploy] Failed to parse webhook payload:', e);
            }
        } else {
            console.log('[Deploy] Manual deployment triggered (no signature)');
        }

        console.log("[Deploy] Starting deployment...");

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
