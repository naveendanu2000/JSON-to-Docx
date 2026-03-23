import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { lexicalToDocx } from "./lexicalToDocx.js";
import { getJSONFromHTML } from "./test.js";
import { combineSections } from "./combineSections.js";
import { hastToDocx } from "./htmlTODocx.js";
import { data } from "../JSON_data.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

app.get("/getTree", async (req, res) => {
  try {
    const html = combineSections(data);
    const tree = getJSONFromHTML(html);

    const response = await hastToDocx(tree, data.data.sections);

    const filePath = path.join(__dirname, `document-${Date.now()}.docx`);

    await fs.promises.writeFile(filePath, response);

    console.log("Saved at:", filePath);
    res.download(filePath, () => {
      fs.unlink(filePath, () => {});
    });

    // res.send(tree);
  } catch (err) {
    console.error("DOCX export error:", err);
    res.status(500).send("Error");
  }
});

app.post("/save", (req, res) => {
  const data = req.body;

  console.log(data.content.root);
  res.status(200).send(data);
});

app.post("/export/docx", async (req, res) => {
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
