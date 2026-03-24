import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { lexicalToDocx } from "../util/lexicalToDocx.js";
import { data } from "../JSON_data.js";
import path from "path";
import { fileURLToPath } from "url";
import { acquire, canAccept, estimateSize, getEffectiveSize } from "../util/exportQuillToDocx.js";
import { handleLargeFile, handleSmallFile } from "../util/DocxExport.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to JSON_TO_DOC backend!");
});

// app.get("/export/quill/docx", async (req, res) => {
//   try {
//     const html = combineSections(data);
//     const tree = getJSONFromHTML(html);

//     const convertedDocxBuffer = await hastToDocx(tree, data.data.sections);

//     // const filePath = path.join(__dirname, `document-${Date.now()}.docx`);

//     // await fs.promises.writeFile(filePath, convertedDocxBuffer);

//     // console.log("Saved at:", filePath);
//     // res.download(filePath, () => {
//     //   fs.unlink(filePath, () => {});
//     // });

//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     );
//     res.setHeader(
//       "Content-Disposition",
//       'attachment; filename="document.docx"',
//     );

//     res.end(convertedDocxBuffer);
//   } catch (err) {
//     console.error("DOCX export error:", err);
//     res.status(500).send("Error");
//   }
// });

app.get("/export/quill/docx", async (req, res) => {
  const SMALL_FILE_THRESHOLD = 20 * 1024 * 1024;
  try {
    const sections = data.data.sections; // adapt to your shape
    if (!sections?.length) {
      return res.status(400).send("No sections provided");
    }

    const estimatedSize = estimateSize(sections);
    const effectiveSize = getEffectiveSize(estimatedSize);
    const isLarge = estimatedSize >= SMALL_FILE_THRESHOLD;

    // ── Capacity check ──
    if (!canAccept(effectiveSize)) {
      res.setHeader("Retry-After", "10");
      return res.status(503).json({
        error: "Server busy",
        message: "Export capacity full. Please retry in a few seconds.",
      });
    }

    acquire(effectiveSize);

    // ── Route by size ──
    if (isLarge) {
      await handleLargeFile(req, res, sections, effectiveSize);
    } else {
      await handleSmallFile(req, res, sections, effectiveSize);
    }
  } catch (err) {
    console.error("DOCX export error:", err);
    if (!res.headersSent) {
      res.status(500).send("Export failed");
    }
  }
});

app.post("/save", (req, res) => {
  const data = req.body;

  console.log(data.content.root);
  res.status(200).send(data);
});

app.post("/export/lexical/docx", async (req, res) => {
  try {
    const { content } = req.body;

    const buffer = await lexicalToDocx({ root: content.root });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="document.docx"',
    );
    res.send(buffer);
  } catch (err) {
    console.error("DOCX export error:", err);
    res.status(500).json({ error: "Failed to convert to DOCX" });
  }
});

app.listen(3000, () => {
  console.info("backend running on http://localhost:3000");
});
