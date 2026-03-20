import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { lexicalToDocx } from "./lexicalToDocx.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to JSON_TO_DOC backend!");
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
