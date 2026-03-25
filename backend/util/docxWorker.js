// docxWorker.js
// Worker thread entry point. Receives section data, converts to docx, saves to disk.
// Must NOT import from workerManager.js — that would be circular
// (workerManager spawns this file via new Worker()).

import { workerData, parentPort } from "worker_threads";
import os from "os";
import path from "path";
import fs from "fs";
import { combineSections } from "./combineSections.js";
import { htmlToJSON, hastToDocx } from "./htmlToDocx.js";

const { jobId, sections } = workerData;

try {
  const html = combineSections({ data: { sections } });
  const tree = htmlToJSON(html);
  const buffer = await hastToDocx(tree, sections);

  // Write to a temp file so the main thread can stream it without holding
  // the entire buffer across the IPC boundary.
  const filePath = path.join(os.tmpdir(), `docx-job-${jobId}.docx`);
  await fs.promises.writeFile(filePath, buffer);

  parentPort.postMessage({ ok: true, filePath, size: buffer.length });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
