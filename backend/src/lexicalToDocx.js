import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  NumberFormat,
  UnderlineType,
} from "docx";

// ── Heading level map ────────────────────────────────────────
const HEADING_MAP = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

// ── Convert text node to TextRun ─────────────────────────────
function toTextRun(node) {
  const isBold = (node.format & 1) !== 0;
  const isItalic = (node.format & 2) !== 0;
  const isStrikethrough = (node.format & 4) !== 0;
  const isUnderline = (node.format & 8) !== 0;
  const isCode = (node.format & 16) !== 0;
  const isSubscript = (node.format & 32) !== 0;
  const isSuperscript = (node.format & 64) !== 0;

  const fontSizeMatch = node.style?.match(/font-size:\s*(\d+)px/);
  const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) * 2 : undefined;

  return new TextRun({
    text: node.text,
    bold: isBold,
    italics: isItalic,
    strike: isStrikethrough,
    underline: isUnderline ? { type: UnderlineType.SINGLE } : undefined,
    subScript: isSubscript,
    superScript: isSuperscript,
    font: isCode ? "Courier New" : "Inter",
    size: fontSize,
    highlight: node.style?.includes("background-color") ? "yellow" : undefined,
  });
}

// ── Convert children to TextRuns ─────────────────────────────
function toTextRuns(children) {
  return children.map(toTextRun);
}

// ── Convert table node ───────────────────────────────────────
function convertTable(node) {
  const rows = node.children.map((row) => {
    const cells = row.children.map((cell) => {
      const isHeader = cell.headerState === 1;
      const text = cell.children
        .flatMap((p) => p.children)
        .map((t) => t.text)
        .join("");

      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text,
                bold: isHeader,
                font: "Inter",
              }),
            ],
          }),
        ],
        width: { size: 33, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
        shading: isHeader ? { fill: "F9FAFB" } : undefined,
      });
    });

    return new TableRow({ children: cells });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ── Main converter ───────────────────────────────────────────
export async function lexicalToDocx(lexicalJson) {
  const children = lexicalJson.root.children;
  const docxElements = [];

  for (const node of children) {
    // Heading
    if (node.type === "heading") {
      docxElements.push(
        new Paragraph({
          heading: HEADING_MAP[node.tag],
          children: toTextRuns(node.children),
        }),
      );

      // Paragraph
    } else if (node.type === "paragraph") {
      docxElements.push(
        new Paragraph({
          children: toTextRuns(node.children),
          spacing: { after: 120 },
        }),
      );

      // List
    } else if (node.type === "list") {
      const isBullet = node.listType === "bullet";
      node.children.forEach((item) => {
        const text = item.children
          .flatMap((c) => (c.text ? [c] : (c.children ?? [])))
          .map((t) => t.text ?? "")
          .join("");

        docxElements.push(
          new Paragraph({
            children: [new TextRun({ text, font: "Inter" })],
            bullet: isBullet ? { level: 0 } : undefined,
            numbering: !isBullet
              ? { reference: "default-numbering", level: 0 }
              : undefined,
            spacing: { after: 80 },
          }),
        );
      });

      // Table
    } else if (node.type === "table") {
      docxElements.push(convertTable(node));
      docxElements.push(new Paragraph({ children: [] })); // spacing after table
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: docxElements,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
