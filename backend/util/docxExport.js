// Route handler functions for small and large file paths.

import crypto from "crypto";
import fs from "fs";
import { combineSections } from "./combineSections.js";
import { htmlToJSON, hastToDocx } from "./htmlToDocx.js";
import { release } from "./capacityStore.js";
import {
  enqueueWorker,
  scheduleTTLDelete,
  sendDocxHeaders,
  streamFileAndDelete,
} from "./workerManager.js";

// ─── Small file path ──────────────────────────────────────────────────────────
// Runs entirely on the main thread. No disk I/O — buffer sent directly.

export async function handleSmallFile(req, res, sections, effectiveSize) {
  try {
    const html = combineSections({ data: { sections } });
    const tree = htmlToJSON(html);
    const buffer = await hastToDocx(tree, sections);

    sendDocxHeaders(res);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (err) {
    throw err; // let the route handler return 500
  } finally {
    // Always release — whether conversion succeeded or threw.
    // res.writableEnded will be true if res.end() was reached.
    release(effectiveSize);
  }
}

// ─── Large file path ──────────────────────────────────────────────────────────
// Offloads conversion to a worker thread, saves to disk, streams to client.

export async function handleLargeFile(req, res, sections, effectiveSize) {
  const jobId = crypto.randomUUID();
  let filePath = null;

  try {
    const result = await enqueueWorker(sections, jobId);
    filePath = result.filePath;

    // Set a TTL safety net before streaming starts.
    // If the client disconnects mid-stream, streamFileAndDelete may never
    // complete — the TTL ensures the file and capacity slot are cleaned up.
    scheduleTTLDelete(filePath, effectiveSize);

    sendDocxHeaders(res);
    // streamFileAndDelete calls release(effectiveSize) and fs.unlink on completion.
    await streamFileAndDelete(res, filePath, effectiveSize);

    // The TTL's unlink will now be a no-op (file is already gone).
  } catch (err) {
    // Worker failed or stream error before headers were sent.
    release(effectiveSize);
    if (filePath) fs.unlink(filePath, () => {});
    throw err;
  }
}