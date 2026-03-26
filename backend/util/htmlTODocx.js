import { unified } from "unified";
import rehypeParse from "rehype-parse";

export const htmlToJSON = (html) => {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html);
  console.log(tree);
  return tree;
};

/**
 * hastToDocx.js
 *
 * Converts a rehype hast tree + sections metadata into a .docx buffer
 * with NATIVE Word sidebar comments (real margin bubbles, not written text).
 *
 * No Python. No temp files. Everything runs in-memory using JSZip.
 *
 * Pipeline:
 *   1. Walk hast tree → build docx-js Document
 *   2. Pack to Buffer
 *   3. Open the buffer as a ZIP, inject comment XML into the right entries
 *   4. Return the final Buffer
 *
 * Usage:
 *   import { hastToDocx } from './hastToDocx.js';
 *   const buffer = await hastToDocx(hastRoot, sections);
 *   fs.writeFileSync('output.docx', buffer);
 *
 * `hastRoot`  — rehype root node whose direct children are <section> elements.
 *               Each <section> should start with an <h1> (the section title),
 *               followed by the section's content nodes.
 *
 * `sections`  — original sections array from your API.
 *               Each entry must have: { title, comments }
 *               where comments = { editorComment, reviewerComment, ownerReviewComment }
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  LevelFormat,
  UnderlineType,
  ImageRun,
  TableLayoutType,
} = require("docx");

// JSZip ships inside docx's own node_modules — no separate install needed.
// If you bundle separately, just: import JSZip from 'jszip'
let JSZip;
try {
  JSZip = require("jszip");
} catch (_e) {
  const docxEntry = require.resolve("docx");
  const docxBase = docxEntry.slice(0, docxEntry.lastIndexOf("dist") - 1);
  const jszipPath = require("path").join(docxBase, "node_modules", "jszip");
  JSZip = require(jszipPath);
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const FONT = "Arial";
const BASE_SIZE = 24; // 12pt in half-points
const PAGE_W = 12240; // US Letter, DXA
const PAGE_H = 15840;
const MARGIN = 1440; // 1 inch
const CONTENT_W = PAGE_W - MARGIN * 2; // 9360 DXA

// const QUILL_SIZES = {
//   "ql-size-small": 18,
//   "ql-size-large": 36,
//   "ql-size-huge": 52,
// };

// ─── Inline run helpers ───────────────────────────────────────────────────────

function collectRuns(nodes, fmt = {}) {
  const runs = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const text = node.value.replace(/\t/g, " ");
      if (text) runs.push(makeRun(text, fmt));
      continue;
    }
    if (node.type !== "element") continue;

    const tag = node.tagName;
    const cls = (node.properties?.className ?? []).join(" ");

    if (cls.includes("ql-ui")) continue; // Quill UI marker — skip
    if (tag === "br") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }
    if (tag === "img") {
      const ir = makeImageRun(node);
      if (ir) runs.push(ir);
      continue;
    }

    runs.push(
      ...collectRuns(
        node.children ?? [],
        deriveFmt(tag, cls, node.properties?.style ?? "", fmt),
      ),
    );
  }
  return runs;
}

function deriveFmt(tag, cls, style, inherited) {
  const f = { ...inherited };
  if (tag === "strong" || tag === "b") f.bold = true;
  if (tag === "em" || tag === "i") f.italics = true;
  if (tag === "u") f.underline = { type: UnderlineType.SINGLE };
  if (tag === "s" || tag === "del") f.strike = true;
  if (tag === "sup") f.superScript = true;
  if (tag === "sub") f.subScript = true;
  // for (const [k, v] of Object.entries(QUILL_SIZES))
  //   if (cls.includes(k)) f.size = v;
  const bg = style.match(/background-color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (bg)
    f.shading = { type: ShadingType.CLEAR, fill: toHex(bg[1], bg[2], bg[3]) };

  const color = style.match(
    /(?<![^;(\s])color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/,
  );
  if (color) f.color = toHex(color[1], color[2], color[3]);

  return f;
}

function makeRun(text, fmt) {
  return new TextRun({
    text,
    font: FONT,
    size: fmt.size ?? BASE_SIZE,
    bold: fmt.bold,
    italics: fmt.italics,
    underline: fmt.underline,
    strike: fmt.strike,
    superScript: fmt.superScript,
    subScript: fmt.subScript,
    shading: fmt.shading,
    color: fmt.color,
  });
}

function toHex(r, g, b) {
  return [r, g, b]
    .map((v) => parseInt(v).toString(16).padStart(2, "0"))
    .join("");
}

// ─── Image helper ─────────────────────────────────────────────────────────────

const MAX_IMG_WIDTH = 600; // px — capped to fit within page content area

function makeImageRun(imgNode) {
  const src = imgNode.properties?.src ?? "";
  const match = src.match(/^data:image\/([\w+]+);base64,([\s\S]+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const typeMap = {
    jpeg: "jpeg",
    jpg: "jpeg",
    png: "png",
    gif: "gif",
    webp: "webp",
    bmp: "bmp",
    svg: "svg",
    "svg+xml": "svg",
  };
  const type = typeMap[mimeType];
  if (!type) return null;

  const data = Buffer.from(match[2], "base64");

  let w = parseInt(imgNode.properties?.width ?? 0);
  let h = parseInt(imgNode.properties?.height ?? 0);

  if (!w && !h) {
    w = MAX_IMG_WIDTH;
    h = Math.round(w * 0.5625);
  } else if (w && !h) {
    h = Math.round(w * 0.5625);
  } else if (h && !w) {
    w = Math.round(h * (16 / 9));
  }

  if (w > MAX_IMG_WIDTH) {
    h = Math.round(h * (MAX_IMG_WIDTH / w));
    w = MAX_IMG_WIDTH;
  }

  const alt = imgNode.properties?.alt ?? "image";
  return new ImageRun({
    type,
    data,
    transformation: { width: w, height: h },
    altText: { title: alt, description: alt, name: alt },
  });
}

// ─── Block element converter ──────────────────────────────────────────────────

function convertNode(node) {
  if (node.type === "text") {
    const t = node.value.trim();
    return t
      ? [new Paragraph({ children: [makeRun(t, {})], spacing: { after: 120 } })]
      : [];
  }
  if (node.type !== "element") return [];

  switch (node.tagName) {
    case "section":
    case "div":
      return (node.children ?? []).flatMap(convertNode);

    case "h1":
      return [hPara(node, HeadingLevel.HEADING_1)];
    case "h2":
      return [hPara(node, HeadingLevel.HEADING_2)];
    case "h3":
      return [hPara(node, HeadingLevel.HEADING_3)];
    case "h4":
      return [hPara(node, HeadingLevel.HEADING_4)];
    case "h5":
      return [hPara(node, HeadingLevel.HEADING_5)];
    case "h6":
      return [hPara(node, HeadingLevel.HEADING_6)];

    case "p":
      return [
        new Paragraph({
          children: collectRuns(node.children ?? []),
          spacing: { after: 120 },
        }),
      ];

    case "img": {
      const imgRun = makeImageRun(node);
      if (!imgRun) return [];
      return [new Paragraph({ children: [imgRun], spacing: { after: 120 } })];
    }

    case "ol":
    case "ul":
      return (node.children ?? [])
        .filter((n) => n.type === "element" && n.tagName === "li")
        .map((li) => liPara(li, 0))
        .flat();

    case "table":
      return [convertTable(node)];
    case "colgroup":
    case "col":
    case "tbody":
    case "thead":
      return [];

    default:
      return (node.children ?? []).flatMap(convertNode);
  }
}

function hPara(node, level) {
  return new Paragraph({
    heading: level,
    children: collectRuns(node.children ?? []),
  });
}

function liPara(li, level = 0) {
  const ref =
    li.properties?.dataList === "ordered" ? "myNumbering" : "myBullets";

  const children = li.children ?? [];
  const result = [];

  const inlineContent = children.filter(
    (n) =>
      !(n.type === "element" && (n.tagName === "ul" || n.tagName === "ol")),
  );

  result.push(
    new Paragraph({
      numbering: { reference: ref, level },
      children: collectRuns(inlineContent),
    }),
  );

  children.forEach((child) => {
    if (
      child.type === "element" &&
      (child.tagName === "ul" || child.tagName === "ol")
    ) {
      const nestedItems = (child.children ?? [])
        .filter((n) => n.type === "element" && n.tagName === "li")
        .map((nestedLi) => liPara(nestedLi, level + 1));

      result.push(...nestedItems.flat());
    }
  });

  return result;
}

function convertTable(tableNode) {
  const colWidths = extractColWidths(tableNode);
  const numCols = colWidths.length || 1;
  const totalDxa = colWidths.length
    ? colWidths.reduce((a, b) => a + b, 0) > CONTENT_W
      ? CONTENT_W
      : colWidths.reduce((a, b) => a + b, 0)
    : CONTENT_W;
  const fallback = Math.floor(CONTENT_W / numCols);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const tbody =
    (tableNode.children ?? []).find((n) => n.tagName === "tbody") ?? tableNode;
  const rows = (tbody.children ?? []).filter(
    (n) => n.type === "element" && n.tagName === "tr",
  );

  return new Table({
    width: { size: totalDxa, type: WidthType.DXA },
    columnWidths: colWidths.length
      ? colWidths.reduce((a, b) => a + b, 0) > CONTENT_W
        ? Array(numCols).fill(fallback)
        : colWidths
      : Array(numCols).fill(fallback),

    layout: TableLayoutType.FIXED,
    rows: rows.map(
      (tr) =>
        new TableRow({
          children: (tr.children ?? [])
            .filter(
              (n) =>
                n.type === "element" &&
                (n.tagName === "td" || n.tagName === "th"),
            )
            .map((td, ci) => {
              const cellLine = (td.children ?? []).find(
                (n) =>
                  n.type === "element" &&
                  (n.properties?.className ?? []).includes("qlbt-cell-line"),
              );
              const runs = collectRuns(
                cellLine ? (cellLine.children ?? []) : (td.children ?? []),
              );
              return new TableCell({
                borders,
                width: { size: colWidths[ci] ?? fallback, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 80, right: 80 },
                shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
                children: [new Paragraph({ children: runs })],
              });
            }),
        }),
    ),
  });
}

function extractColWidths(tableNode) {
  const cg = (tableNode.children ?? []).find((n) => n.tagName === "colgroup");
  if (!cg) return [];
  return (cg.children ?? [])
    .filter((n) => n.type === "element" && n.tagName === "col")
    .map((col) => Math.round(Number(col.properties?.width ?? 0) * 15))
    .filter((w) => w > 0);
}

// ─── Base document builder ────────────────────────────────────────────────────

function buildBaseDoc(hastRoot) {
  const children = [];
  const secNodes = (hastRoot.children ?? []).filter(
    (n) => n.type === "element" && n.tagName === "section",
  );

  secNodes.forEach((sec, idx) => {
    (sec.children ?? []).forEach((child) =>
      children.push(...convertNode(child)),
    );
    if (idx < secNodes.length - 1) {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "DDDDDD",
              space: 4,
            },
          },
          spacing: { before: 320, after: 320 },
          children: [],
        }),
      );
    }
  });

  return new Document({
    numbering: {
      config: [
        {
          reference: "myBullets",
          levels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["•", "◦", "▪", "▸", "–", "·", "»", "›", "‣"][level],
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: {
                  left: 720 * (level + 1),
                  hanging: 360,
                },
              },
            },
          })),
        },
        {
          reference: "myNumbering",
          levels: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((level) => ({
            level,
            format: [
              LevelFormat.DECIMAL,
              LevelFormat.LOWER_LETTER,
              LevelFormat.LOWER_ROMAN,
              LevelFormat.DECIMAL,
              LevelFormat.LOWER_LETTER,
              LevelFormat.LOWER_ROMAN,
              LevelFormat.DECIMAL,
              LevelFormat.LOWER_LETTER,
              LevelFormat.LOWER_ROMAN,
            ][level],
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: {
                  left: 720 * (level + 1),
                  hanging: 360,
                },
              },
            },
          })),
        },
      ],
    },
    styles: {
      default: { document: { run: { font: FONT, size: BASE_SIZE } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, font: FONT, color: "1F3864" },
          paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 30, bold: true, font: FONT, color: "2E5496" },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: FONT, color: "376091" },
          paragraph: { spacing: { before: 180, after: 60 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });
}

// ─── Comment data helpers ─────────────────────────────────────────────────────

/**
 * Flatten all comments from all sections into:
 * { id, sectionTitle, author, initials, date, text, category }
 */
function flattenComments(sections) {
  const list = [];
  let id = 0;
  for (const sec of sections) {
    const title = sec.title ?? "";
    const c = sec.comments ?? {};
    const groups = [
      { label: "Owner", items: c.editorComment?.ownerComments ?? [] },
      {
        label: "Contributor",
        items: c.editorComment?.contributorComments ?? [],
      },
      { label: "Reviewer", items: c.reviewerComment ?? [] },
      { label: "Owner Review", items: c.ownerReviewComment ?? [] },
    ];
    for (const { label, items } of groups) {
      for (const item of items) {
        const first = item.user?.firstName ?? "";
        const last = item.user?.lastName ?? "";
        const author =
          `${first} ${last}`.trim() ||
          item.user?.name ||
          item.user?.email ||
          "Unknown";
        const initials =
          author
            .split(" ")
            .map((p) => p[0] ?? "")
            .join("")
            .toUpperCase()
            .slice(0, 2) || "AU";
        list.push({
          id,
          sectionTitle: title,
          author,
          initials,
          // Word requires ISO 8601 with no milliseconds
          date: (item.time ?? new Date().toISOString()).replace(/\.\d+Z$/, "Z"),
          text: item.comment ?? "",
          category: label,
        });
        id++;
      }
    }
  }
  return list;
}

// ─── XML string helpers ───────────────────────────────────────────────────────

function xe(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── comments.xml builder ─────────────────────────────────────────────────────

function buildCommentsXml(comments) {
  const W_NS = [
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
    'mc:Ignorable="w14"',
  ].join(" ");

  const commentNodes = comments
    .map(
      (c) =>
        `<w:comment w:id="${c.id}" w:author="${xe(c.author)}" w:date="${c.date}" w:initials="${xe(c.initials)}">` +
        `<w:p>` +
        `<w:pPr><w:pStyle w:val="CommentText"/></w:pPr>` +
        `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>` +
        // Category label in bold
        `<w:r><w:rPr><w:rStyle w:val="CommentText"/><w:b/></w:rPr>` +
        `<w:t xml:space="preserve">[${xe(c.category)}] </w:t></w:r>` +
        // Comment body
        `<w:r><w:rPr><w:rStyle w:val="CommentText"/></w:rPr>` +
        `<w:t>${xe(c.text)}</w:t></w:r>` +
        `</w:p>` +
        `</w:comment>`,
    )
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:comments ${W_NS}>${commentNodes}</w:comments>`
  );
}

// ─── document.xml patcher ─────────────────────────────────────────────────────

/**
 * For each section, find the <w:r> run in document.xml whose <w:t> contains
 * the section title, and wrap it with comment range markers.
 *
 * Word comment anatomy (all siblings inside <w:p>):
 *   <w:commentRangeStart w:id="N"/>
 *   <w:r>...<w:t>heading text</w:t>...</w:r>
 *   <w:commentRangeEnd w:id="N"/>
 *   <w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="N"/></w:r>
 */
function patchDocumentXml(docXml, commentsBySection) {
  let xml = docXml;

  for (const [title, comments] of Object.entries(commentsBySection)) {
    if (!comments.length) continue;

    const ids = comments.map((c) => c.id);
    const starts = ids
      .map((id) => `<w:commentRangeStart w:id="${id}"/>`)
      .join("");
    const ends = ids.map((id) => `<w:commentRangeEnd w:id="${id}"/>`).join("");
    const refs = ids
      .map(
        (id) =>
          `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`,
      )
      .join("");

    // Escape for use inside a RegExp — also handle & vs &amp; in the XML
    const escapedTitle = title
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/&/g, "(?:&amp;|&)");

    // Match the <w:r>…</w:r> block whose <w:t> contains the exact title text.
    // The run may have a <w:rPr> before the <w:t>, hence (?:(?!</?w:r[\s>]).)*?
    const runPattern = new RegExp(
      `(<w:r(?:\\s[^>]*)?>(?:(?!</?w:r[\\s>]).)*?` +
        `<w:t[^>]*>[^<]*${escapedTitle}[^<]*<\\/w:t>` +
        `(?:(?!</?w:r[\\s>]).)*?<\\/w:r>)`,
      "s",
    );

    xml = xml.replace(runPattern, (_, run) => `${starts}${run}${ends}${refs}`);
  }

  return xml;
}

// ─── ZIP-level comment injector ───────────────────────────────────────────────

/**
 * Opens the docx buffer as a ZIP, injects native Word comment XML,
 * patches document.xml and the required relationship/content-type entries,
 * then returns the modified buffer.
 */
async function injectNativeComments(docxBuffer, sections) {
  const comments = flattenComments(sections);
  if (comments.length === 0) return docxBuffer; // nothing to do

  // Group comments by section title for targeted XML anchoring
  const bySection = {};
  for (const c of comments) {
    (bySection[c.sectionTitle] = bySection[c.sectionTitle] ?? []).push(c);
  }

  // Open the docx ZIP
  const zip = await JSZip.loadAsync(docxBuffer);

  // 1. Build and add word/comments.xml
  zip.file("word/comments.xml", buildCommentsXml(comments));

  // 2. Patch word/document.xml — anchor comments to their section headings
  const docXml = await zip.file("word/document.xml").async("string");
  const patchedXml = patchDocumentXml(docXml, bySection);
  zip.file("word/document.xml", patchedXml);

  // 3. Register the comments relationship in word/_rels/document.xml.rels
  const relsPath = "word/_rels/document.xml.rels";
  let relsXml = await zip.file(relsPath).async("string");
  if (!relsXml.includes("comments.xml")) {
    relsXml = relsXml.replace(
      "</Relationships>",
      '<Relationship Id="rIdComments" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" ' +
        'Target="comments.xml"/>' +
        "</Relationships>",
    );
    zip.file(relsPath, relsXml);
  }

  // 4. Register the content type in [Content_Types].xml
  let ctXml = await zip.file("[Content_Types].xml").async("string");
  if (!ctXml.includes("comments.xml")) {
    ctXml = ctXml.replace(
      "</Types>",
      '<Override PartName="/word/comments.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' +
        "</Types>",
    );
    zip.file("[Content_Types].xml", ctXml);
  }

  // 5. Repack and return as Buffer
  const result = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {object}   hastRoot  - rehype root node (direct children are <section> elements)
 * @param {object[]} sections  - original sections array ({ title, comments, ... })
 * @returns {Promise<Buffer>}  - final .docx buffer with native Word comments
 */
export async function hastToDocx(hastRoot, sections) {
  // Step 1 — build content-only docx
  const doc = buildBaseDoc(hastRoot);
  const baseBuffer = await Packer.toBuffer(doc);

  // Step 2 — inject native Word comments directly into the ZIP
  const finalBuffer = await injectNativeComments(baseBuffer, sections);

  return finalBuffer;
}
