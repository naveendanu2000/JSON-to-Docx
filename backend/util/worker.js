import os from "os";
import { release } from "./exportQuillToDocx";
import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const FILE_TTL_MS = 60_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Worker queue ─────────────────────────────────────────────────────────────

// Simple FIFO queue. Workers are spawned per-job (no pool needed —
// Node worker threads are lightweight and conversion is CPU-bound, not long-lived).
const pendingQueue = [];
let activeWorkers = 0;
const MAX_WORKERS = Math.max(2, (os.cpus?.()?.length ?? 4) - 1); // leave 1 core for main thread


function drainQueue() {
  while (pendingQueue.length > 0 && activeWorkers < MAX_WORKERS) {
    const next = pendingQueue.shift();
    next();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function sendDocxHeaders(res, filename = "document.docx") {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

export async function streamFileAndDelete(res, filePath, effectiveSize) {
  try {
    const stat = await fs.promises.stat(filePath);
    res.setHeader("Content-Length", stat.size);

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("end", resolve);
      stream.pipe(res, { end: true });
    });
  } finally {
    release(effectiveSize);
    // Best-effort delete — ignore errors (file may already be gone via TTL cleanup)
    fs.unlink(filePath, () => {});
  }
}

export function scheduleTTLDelete(filePath, effectiveSize) {
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (!err) {
        // File was still there — release capacity that was never freed by streaming
        release(effectiveSize);
      }
    });
  }, FILE_TTL_MS);
}

// ─── Large-file path (worker thread) ─────────────────────────────────────────

function spawnWorker(sections, jobId) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "worker.js"), {
      workerData: { jobId, sections },
    });

    worker.once("message", (msg) => {
      activeWorkers--;
      drainQueue(); // unblock next queued job
      if (msg.ok) resolve(msg);
      else reject(new Error(msg.error));
    });

    worker.once("error", (err) => {
      activeWorkers--;
      drainQueue();
      reject(err);
    });
  });
}

export function enqueueWorker(sections, jobId) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeWorkers++;
      spawnWorker(sections, jobId).then(resolve).catch(reject);
    };

    if (activeWorkers < MAX_WORKERS) {
      run();
    } else {
      // Queue for when a slot opens
      pendingQueue.push(run);
    }
  });
}
