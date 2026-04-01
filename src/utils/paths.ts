import path from "path";
import os from "os";

/**
 * Returns the default projects directory for workflow storage.
 * Uses WORKFLOWS_DIR env var if set (e.g. /data/workflows in Docker),
 * otherwise falls back to ~/clawd/projects/node-banana-workflows.
 */
export function getDefaultProjectsDir(): string {
  return process.env.WORKFLOWS_DIR || path.join(os.homedir(), "clawd", "projects", "node-banana-workflows");
}
