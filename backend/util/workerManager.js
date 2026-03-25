// Manages the worker thread pool, file streaming, and TTL cleanup.
// Does NOT contain any capacity logic — import from capacityStore.js for that.

import { Worker } from "worker_threads";
import os from "os";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { release } from "./capacityStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FILE_TTL_MS = 60_000; // 60 s safety-net before temp file is force-deleted

// ─── Worker pool ──────────────────────────────────────────────────────────────

const pendingQueue = [];
let activeWorkers = 0;
// Leave 1 core free for Express / main thread
const MAX_WORKERS = Math.max(2, (os.cpus?.()?.length ?? 4) - 1);

function drainQueue() {
  while (pendingQueue.length > 0 && activeWorkers < MAX_WORKERS) {
    const next = pendingQueue.shift();
    next();
  }
}

// ─── Response helpers ─────────────────────────────────────────────────────────

export function sendDocxHeaders(res, filename = "document.docx") {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

// Streams a file to the response then deletes it and releases capacity.
// Called only for large files (worker path).
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
    // Release capacity and delete file regardless of stream success/failure.
    // If the TTL fires later and the file is already gone, unlink is a no-op.
    release(effectiveSize);
    fs.unlink(filePath, () => {});
  }
}

// Safety net: if the client disconnects before streamFileAndDelete runs,
// the temp file and capacity slot would leak. This ensures cleanup after TTL_MS.
export function scheduleTTLDelete(filePath, effectiveSize) {
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (!err) {
        // File was still on disk — streamFileAndDelete never ran (client disconnected).
        // Release the capacity slot that was never freed.
        release(effectiveSize);
      }
      // If err — file was already deleted by streamFileAndDelete. Nothing to do.
    });
  }, FILE_TTL_MS);
}

// ─── Worker spawning ──────────────────────────────────────────────────────────

// Spawns a single worker and returns a Promise that resolves with its result.
function spawnWorker(sections, jobId) {
  return new Promise((resolve, reject) => {
    // docxWorker.js is the worker entry point — NOT this file.
    const worker = new Worker(path.join(__dirname, "docxWorker.js"), {
      workerData: { jobId, sections },
    });

    worker.once("message", (msg) => {
      activeWorkers--;
      drainQueue(); // open a slot for the next queued job
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

// Enqueues or immediately spawns a worker depending on current slot availability.
export function enqueueWorker(sections, jobId) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeWorkers++;
      spawnWorker(sections, jobId).then(resolve).catch(reject);
    };

    if (activeWorkers < MAX_WORKERS) {
      run();
    } else {
      pendingQueue.push(run);
    }
  });
}