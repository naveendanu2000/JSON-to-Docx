import crypto from "crypto";
import { combineSections } from "../src/combineSections.js";
import {
  enqueueWorker,
  scheduleTTLDelete,
  sendDocxHeaders,
  streamFileAndDelete,
} from "./worker.js";
import { release } from "./exportQuillToDocx.js";
import fs from "fs";
import { hastToDocx, htmlToJSON } from "../src/htmlTODocx.js";

export async function handleSmallFile(req, res, sections, effectiveSize) {
  let converted = false;
  try {
    const html = combineSections({ data: { sections } });
    const tree = htmlToJSON(html);
    const buffer = await hastToDocx(tree, sections);
    converted = true;

    sendDocxHeaders(res);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } finally {
    // Always release — whether we succeeded or threw
    if (!converted || res.writableEnded) {
      release(effectiveSize);
    }
  }
}

export async function handleLargeFile(req, res, sections, effectiveSize) {
  const jobId = crypto.randomUUID();
  let filePath = null;

  try {
    // Conversion runs in worker — main thread stays free
    const result = await enqueueWorker(sections, jobId);
    filePath = result.filePath;

    // Schedule TTL cleanup in case the client disconnects mid-stream
    scheduleTTLDelete(filePath, effectiveSize);

    sendDocxHeaders(res);
    await streamFileAndDelete(res, filePath, effectiveSize);

    // streamFileAndDelete already called release() and unlink() on success —
    // cancel the TTL by attempting unlink (will no-op since file is gone)
  } catch (err) {
    release(effectiveSize);
    if (filePath) fs.unlink(filePath, () => {});
    throw err; // re-throw so the route handler returns 500
  }
}
