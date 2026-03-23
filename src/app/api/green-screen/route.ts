/**
 * Green Screen Key API — CorridorKey integration
 * 
 * POST /api/green-screen
 *   Body: multipart/form-data with 'video' file
 *   Query params:
 *     - format: 'webm' (default) | 'mov' | 'png'
 *     - despill: 0-10 (default 5)
 *     - max_frames: limit frames processed (optional)
 * 
 * Returns: processed video with alpha transparency
 * 
 * GET /api/green-screen/status
 *   Returns: engine status and recent jobs
 */
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

const CORRIDORKEY_DIR = path.join(os.homedir(), "clawd/projects/CorridorKey");
const JOBS_DIR = path.join(os.tmpdir(), "corridorkey-jobs");

// Ensure jobs directory exists
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

interface JobStatus {
  id: string;
  status: "queued" | "processing" | "complete" | "error";
  input_file: string;
  output_file?: string;
  stats?: Record<string, unknown>;
  error?: string;
  created_at: string;
  completed_at?: string;
}

const jobs: Map<string, JobStatus> = new Map();

export const maxDuration = 600; // 10 minutes for video processing
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    
    if (!videoFile) {
      return NextResponse.json({ error: "No video file provided. Send as 'video' in multipart form data." }, { status: 400 });
    }
    
    // Parse options
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "webm";
    const despill = parseInt(url.searchParams.get("despill") || "5");
    const maxFrames = url.searchParams.get("max_frames");
    
    if (!["webm", "mov", "png"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use 'webm', 'mov', or 'png'" }, { status: 400 });
    }
    
    // Generate job ID
    const jobId = `ck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jobDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    
    // Save uploaded video to temp file
    const inputExt = path.extname(videoFile.name) || ".mp4";
    const inputPath = path.join(jobDir, `input${inputExt}`);
    const outputExt = format === "png" ? ".zip" : `.${format}`;
    const outputPath = path.join(jobDir, `output${outputExt}`);
    
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);
    
    // Create job entry
    const job: JobStatus = {
      id: jobId,
      status: "processing",
      input_file: videoFile.name,
      created_at: new Date().toISOString(),
    };
    jobs.set(jobId, job);
    
    // Build command — uses MLX backend with tiled inference on Apple Silicon (auto-detected)
    let cmd = `cd "${CORRIDORKEY_DIR}" && uv run python3 api_process.py "${inputPath}" "${outputPath}" --despill ${despill} --format ${format}`;
    if (maxFrames) {
      cmd += ` --max-frames ${maxFrames}`;
    }
    
    // For short videos (< 50MB), process synchronously
    const fileSizeMB = buffer.length / 1024 / 1024;
    
    if (fileSizeMB < 50) {
      // Synchronous processing
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: 600000, // 10 min
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: "1" },
        });
        
        // Parse stats from stdout (last line is JSON)
        const lines = stdout.trim().split("\n");
        const lastLine = lines[lines.length - 1];
        let stats = {};
        try {
          stats = JSON.parse(lastLine);
        } catch {
          // ignore
        }
        
        job.status = "complete";
        job.stats = stats;
        job.completed_at = new Date().toISOString();
        
        // Return the file
        if (fs.existsSync(outputPath)) {
          const fileBuffer = fs.readFileSync(outputPath);
          const contentType = format === "webm" ? "video/webm" : format === "mov" ? "video/quicktime" : "application/zip";
          
          // Cleanup after 5 min
          setTimeout(() => {
            fs.rmSync(jobDir, { recursive: true, force: true });
            jobs.delete(jobId);
          }, 300000);
          
          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="keyed_${videoFile.name.replace(/\.[^.]+$/, '')}.${format}"`,
              "X-Job-Id": jobId,
              "X-Processing-Stats": JSON.stringify(stats),
            },
          });
        } else {
          job.status = "error";
          job.error = `Output file not created. stderr: ${stderr?.slice(-500)}`;
          return NextResponse.json({ error: "Processing failed", details: stderr?.slice(-500), jobId }, { status: 500 });
        }
      } catch (err: unknown) {
        job.status = "error";
        const errMsg = err instanceof Error ? err.message : String(err);
        job.error = errMsg.slice(-500);
        return NextResponse.json({ error: "Processing failed", details: errMsg.slice(-500), jobId }, { status: 500 });
      }
    } else {
      // Async processing for large files — return job ID immediately
      job.status = "queued";
      
      // Run in background
      execAsync(cmd, {
        timeout: 1800000, // 30 min
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: "1" },
      }).then(({ stdout }) => {
        const lines = stdout.trim().split("\n");
        try {
          job.stats = JSON.parse(lines[lines.length - 1]);
        } catch { /* ignore */ }
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
        message: `Large file (${fileSizeMB.toFixed(1)} MB) — processing in background. Poll GET /api/green-screen?job=${jobId}`,
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
    // Check specific job
    const job = jobs.get(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    
    if (job.status === "complete" && job.output_file && fs.existsSync(job.output_file)) {
      // Return the file
      const fileBuffer = fs.readFileSync(job.output_file);
      const format = path.extname(job.output_file).slice(1);
      const contentType = format === "webm" ? "video/webm" : format === "mov" ? "video/quicktime" : "application/zip";
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="keyed_${job.input_file.replace(/\.[^.]+$/, '')}.${format}"`,
          "X-Processing-Stats": JSON.stringify(job.stats),
        },
      });
    }
    
    return NextResponse.json(job);
  }
  
  // Status endpoint
  return NextResponse.json({
    service: "CorridorKey Green Screen Keyer",
    version: "1.0.0",
    engine: "CorridorKey v1.0 (Corridor Digital)",
    device: "Apple Silicon MPS",
    supported_formats: ["webm", "mov", "png"],
    active_jobs: Array.from(jobs.values()).filter(j => j.status === "processing" || j.status === "queued").length,
    recent_jobs: Array.from(jobs.values()).slice(-10).map(j => ({
      id: j.id,
      status: j.status,
      input: j.input_file,
      stats: j.stats,
    })),
  });
}
