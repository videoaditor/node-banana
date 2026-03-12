/**
 * Background Removal API — unified endpoint for green screen keying + general bg removal
 * 
 * POST /api/bgremove
 *   Body: multipart/form-data with 'video' file
 *   Query params:
 *     - mode: 'auto' (default) | 'greenscreen' | 'general'
 *       - auto: detects green screen footage and picks the right model
 *       - greenscreen: CorridorKey neural keyer (best for chroma key footage)
 *       - general: InSPyReNet (works on any video, no green screen needed)
 *     - format: 'webm' (default) | 'mov' | 'png'
 *     - despill: 0-10 (default 5, greenscreen mode only)
 *     - max_frames: limit frames processed (optional)
 * 
 * GET /api/bgremove — status and recent jobs
 */
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);
const CORRIDORKEY_DIR = path.join(os.homedir(), "clawd/projects/CorridorKey");
const JOBS_DIR = path.join(os.tmpdir(), "bgremove-jobs");

if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });

interface JobStatus {
  id: string;
  status: "queued" | "processing" | "complete" | "error";
  mode: string;
  input_file: string;
  output_file?: string;
  stats?: Record<string, unknown>;
  error?: string;
  created_at: string;
  completed_at?: string;
}

const jobs: Map<string, JobStatus> = new Map();

export const maxDuration = 600;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    
    if (!videoFile) {
      return NextResponse.json({
        error: "No video file provided. Send as 'video' in multipart form data.",
        usage: "curl -X POST https://nodes.aditor.ai/api/bgremove -F 'video=@input.mp4' -o output.webm"
      }, { status: 400 });
    }
    
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "auto";
    const format = url.searchParams.get("format") || "webm";
    const despill = parseInt(url.searchParams.get("despill") || "5");
    const maxFrames = url.searchParams.get("max_frames");
    
    if (!["auto", "greenscreen", "general"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode. Use 'auto', 'greenscreen', or 'general'" }, { status: 400 });
    }
    if (!["webm", "mov", "png"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use 'webm', 'mov', or 'png'" }, { status: 400 });
    }
    
    const jobId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jobDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    
    const inputExt = path.extname(videoFile.name) || ".mp4";
    const inputPath = path.join(jobDir, `input${inputExt}`);
    const outputExt = format === "png" ? ".zip" : `.${format}`;
    const outputPath = path.join(jobDir, `output${outputExt}`);
    
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);
    
    // Determine actual mode
    let actualMode = mode;
    if (mode === "auto") {
      // Simple heuristic: check filename for "green" or "chroma", default to general
      const nameLower = videoFile.name.toLowerCase();
      if (nameLower.includes("green") || nameLower.includes("chroma") || nameLower.includes("key")) {
        actualMode = "greenscreen";
      } else {
        actualMode = "general";
      }
    }
    
    const job: JobStatus = {
      id: jobId,
      status: "processing",
      mode: actualMode,
      input_file: videoFile.name,
      created_at: new Date().toISOString(),
    };
    jobs.set(jobId, job);
    
    // Build command based on mode
    let cmd: string;
    if (actualMode === "greenscreen") {
      cmd = `cd "${CORRIDORKEY_DIR}" && uv run python3 api_process.py "${inputPath}" "${outputPath}" --despill ${despill} --format ${format}`;
    } else {
      cmd = `cd "${CORRIDORKEY_DIR}" && uv run python3 api_bgremove.py "${inputPath}" "${outputPath}" --format ${format}`;
    }
    if (maxFrames) cmd += ` --max-frames ${maxFrames}`;
    
    const fileSizeMB = buffer.length / 1024 / 1024;
    
    if (fileSizeMB < 50) {
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: 600000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: "1" },
        });
        
        const lines = stdout.trim().split("\n");
        let stats: Record<string, unknown> = {};
        try { stats = JSON.parse(lines[lines.length - 1]); } catch { /* */ }
        
        job.status = "complete";
        job.stats = { ...stats, mode: actualMode };
        job.completed_at = new Date().toISOString();
        
        if (fs.existsSync(outputPath)) {
          const fileBuffer = fs.readFileSync(outputPath);
          const contentType = format === "webm" ? "video/webm" : format === "mov" ? "video/quicktime" : "application/zip";
          
          setTimeout(() => {
            fs.rmSync(jobDir, { recursive: true, force: true });
            jobs.delete(jobId);
          }, 300000);
          
          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="nobg_${videoFile.name.replace(/\.[^.]+$/, '')}.${format}"`,
              "X-Job-Id": jobId,
              "X-Mode": actualMode,
              "X-Processing-Stats": JSON.stringify(stats),
            },
          });
        } else {
          job.status = "error";
          job.error = `Output not created. stderr: ${stderr?.slice(-500)}`;
          return NextResponse.json({ error: "Processing failed", details: stderr?.slice(-500), jobId }, { status: 500 });
        }
      } catch (err: unknown) {
        job.status = "error";
        const errMsg = err instanceof Error ? err.message : String(err);
        job.error = errMsg.slice(-500);
        return NextResponse.json({ error: "Processing failed", details: errMsg.slice(-500), jobId }, { status: 500 });
      }
    } else {
      job.status = "queued";
      
      execAsync(cmd, {
        timeout: 1800000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: "1" },
      }).then(({ stdout }) => {
        const lines = stdout.trim().split("\n");
        try { job.stats = JSON.parse(lines[lines.length - 1]); } catch { /* */ }
        job.status = "complete";
        job.output_file = outputPath;
        job.completed_at = new Date().toISOString();
      }).catch((err) => {
        job.status = "error";
        job.error = err.message?.slice(-500);
      });
      
      return NextResponse.json({
        jobId,
        status: "queued",
        mode: actualMode,
        message: `Large file (${fileSizeMB.toFixed(1)} MB) processing in background. Poll GET /api/bgremove?job=${jobId}`,
      }, { status: 202 });
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job");
  
  if (jobId) {
    const job = jobs.get(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    
    if (job.status === "complete" && job.output_file && fs.existsSync(job.output_file)) {
      const fileBuffer = fs.readFileSync(job.output_file);
      const format = path.extname(job.output_file).slice(1);
      const contentType = format === "webm" ? "video/webm" : format === "mov" ? "video/quicktime" : "application/zip";
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="nobg_${job.input_file.replace(/\.[^.]+$/, '')}.${format}"`,
          "X-Processing-Stats": JSON.stringify(job.stats),
        },
      });
    }
    
    return NextResponse.json(job);
  }
  
  return NextResponse.json({
    service: "Background Removal — Green Screen + General",
    version: "1.0.0",
    modes: {
      auto: "Auto-detect green screen vs general footage",
      greenscreen: "CorridorKey neural keyer — best for chroma key footage (green/blue screen)",
      general: "InSPyReNet — works on any video, no green screen needed",
    },
    supported_formats: ["webm", "mov", "png"],
    active_jobs: Array.from(jobs.values()).filter(j => ["processing", "queued"].includes(j.status)).length,
    recent_jobs: Array.from(jobs.values()).slice(-10).map(j => ({
      id: j.id, status: j.status, mode: j.mode, input: j.input_file, stats: j.stats,
    })),
  });
}
