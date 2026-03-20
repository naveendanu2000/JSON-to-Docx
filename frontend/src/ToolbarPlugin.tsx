import React, { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from "lexical";
import { $patchStyleText } from "@lexical/selection";
import { $setBlocksType } from "@lexical/selection";
import { $isMarkNode } from "@lexical/mark";
import { $wrapSelectionInMarkNode } from "@lexical/mark";
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $createParagraphNode } from "lexical";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { BsTable } from "react-icons/bs";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";

import { LuUndo2, LuRedo2 } from "react-icons/lu";
import {
  BiBold,
  BiItalic,
  BiUnderline,
  BiStrikethrough,
  BiCode,
  BiLink,
} from "react-icons/bi";
import {
  MdFormatAlignLeft,
  MdFormatAlignCenter,
  MdFormatAlignRight,
  MdFormatAlignJustify,
} from "react-icons/md";
import { AiOutlineOrderedList, AiOutlineUnorderedList } from "react-icons/ai";
import { RiFontColor, RiFontSize } from "react-icons/ri";
import { IoColorFillOutline } from "react-icons/io5";
import { BsChevronDown } from "react-icons/bs";

// ── Types ────────────────────────────────────────────────────────────────────
type BlockType = "paragraph" | HeadingTagType | "quote";

// ── Subcomponents ────────────────────────────────────────────────────────────
interface BtnProps {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Btn = ({
  title,
  active,
  disabled,
  onClick,
  children,
}: BtnProps): React.ReactElement => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 45,
      height: 45,
      padding: 0,
      border: active ? "1px solid #c0c0c0" : "1px solid transparent",
      borderRadius: 4,
      background: active ? "#f0f0f0" : "transparent",
      color: disabled ? "#ccc" : "#333",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background 0.15s, border 0.15s",
    }}
    onMouseEnter={(e) => {
      if (!disabled)
        (e.currentTarget as HTMLButtonElement).style.background = "#f0f0f0";
    }}
    onMouseLeave={(e) => {
      if (!active)
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
    }}
  >
    {children}
  </button>
);

const Sep = (): React.ReactElement => (
  <span
    style={{
      display: "inline-block",
      width: 1,
      height: 22,
      background: "#ddd",
      margin: "0 4px",
      verticalAlign: "middle",
    }}
  />
);

interface DropdownProps {
  title: string;
  label?: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

const Dropdown = ({ title, label, options, onChange }: DropdownProps) => (
  <div
    title={title}
    style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
  >
    <select
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 36,
        fontSize: 16,
        border: "1px solid transparent",
        borderRadius: 4,
        background: "transparent",
        color: "#333",
        cursor: "pointer",
        padding: "0 4px",
        appearance: "none",
      }}
    >
      {label && <option value={""}>{label}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <BsChevronDown size={12} color="#888" /> {/* 👈 increase chevron too */}
  </div>
);

// Font size stepper (the  - 15 +  in your screenshot)
interface FontSizeStepperProps {
  size: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

const FontSizeStepper = ({
  size,
  onIncrease,
  onDecrease,
}: FontSizeStepperProps) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
    <Btn title="Decrease font size" onClick={onDecrease}>
      −
    </Btn>
    <span
      style={{
        minWidth: 36,
        textAlign: "center",
        fontSize: 16, // 👈 increase here
        border: "1px solid #c0c0c0",
        borderRadius: 4,
        padding: "2px 8px",
        color: "#333",
      }}
    >
      {size}
    </span>
    <Btn title="Increase font size" onClick={onIncrease}>
      +
    </Btn>
  </div>
);

// ── Main Toolbar ─────────────────────────────────────────────────────────────
export function ToolbarPlugin(): React.ReactElement {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(0);
  const [tableCols, setTableCols] = useState(0);

  const applyFontSize = useCallback(
    (size: number) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, {
            "font-size": `${size}px`, // 👈 actually applies to selected text
          });
        }
      });
    },
    [editor],
  );

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.min(96, prev + 1);
      applyFontSize(next); // 👈 apply to editor
      return next;
    });
  }, [applyFontSize]);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.max(8, prev - 1);
      applyFontSize(next); // 👈 apply to editor
      return next;
    });
  }, [applyFontSize]);

  const insertTable = useCallback(
    (rows: number, cols: number) => {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: String(rows),
        columns: String(cols),
        includeHeaders: true, // 👈 first row is a header
      });
      setShowTablePicker(false);
      setTableRows(0);
      setTableCols(0);
    },
    [editor],
  );

  // sync active states with selection
  const syncToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrike(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));

      const nodes = selection.getNodes();
      const isMarked = nodes.some((node) => {
        const parent = node.getParent();
        return $isMarkNode(parent);
      });
      setIsHighlighted(isMarked);
      const node = selection.anchor.getNode();
      if ($isTextNode(node)) {
        const style = node.getStyle();
        const match = style.match(/font-size:\s*(\d+)px/);
        if (match) {
          setFontSize(parseInt(match[1], 10));
        } else {
          setFontSize(16);
        }
      }
    }
  }, []);

  const toggleHighlight = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        $wrapSelectionInMarkNode(selection, false, "highlight"); // 👈 wraps selected text
      }
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        syncToolbar();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, syncToolbar]);

  // block type
  const setBlock = useCallback(
    (type: BlockType) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          if (type === "paragraph")
            $setBlocksType(selection, () => $createParagraphNode());
          else if (type === "quote")
            $setBlocksType(selection, () => $createQuoteNode());
          else $setBlocksType(selection, () => $createHeadingNode(type));
        }
      });
    },
    [editor],
  );

  const blockOptions = [
    { label: "Paragraph", value: "paragraph" },
    { label: "Heading 1", value: "h1" },
    { label: "Heading 2", value: "h2" },
    { label: "Heading 3", value: "h3" },
    { label: "Heading 4", value: "h4" },
    { label: "Quote", value: "quote" },
  ];

  const fontFamilyOptions = [
    { label: "Sans Serif", value: "sans-serif" },
    { label: "Serif", value: "serif" },
    { label: "Monospace", value: "monospace" },
    { label: "Georgia", value: "Georgia" },
    { label: "Arial", value: "Arial" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        padding: "6px 10px",
        borderBottom: "1px solid #e0e0e0",
        background: "#fff",
        borderRadius: "6px 6px 0 0",
        userSelect: "none",
      }}
    >
      {/* Undo / Redo */}
      <Btn
        title="Undo (Ctrl+Z)"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <LuUndo2 size={22} />
      </Btn>
      <Btn
        title="Redo (Ctrl+Y)"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <LuRedo2 size={22} />
      </Btn>
      <Sep />

      {/* Block type dropdown */}
      <Dropdown
        title="Block type"
        options={blockOptions}
        onChange={(val) => setBlock(val as BlockType)}
      />
      <Sep />

      {/* Font family dropdown */}
      <Dropdown
        title="Font family"
        label="Font"
        options={fontFamilyOptions}
        onChange={(val) => console.log("font:", val)}
      />
      <Sep />

      {/* Font size stepper */}
      <FontSizeStepper
        size={fontSize}
        onDecrease={decreaseFontSize}
        onIncrease={increaseFontSize}
      />
      <Sep />

      {/* Text format */}
      <Btn
        title="Bold (Ctrl+B)"
        active={isBold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        <BiBold size={25} />
      </Btn>
      <Btn
        title="Italic (Ctrl+I)"
        active={isItalic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <BiItalic size={25} />
      </Btn>
      <Btn
        title="Underline (Ctrl+U)"
        active={isUnderline}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
      >
        <BiUnderline size={25} />
      </Btn>
      <Btn
        title="Strikethrough"
        active={isStrike}
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
        }
      >
        <BiStrikethrough size={25} />
      </Btn>
      <Btn
        title="Inline Code"
        active={isCode}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
      >
        <BiCode size={25} />
      </Btn>
      <Btn title="Insert Link" onClick={() => console.log("link")}>
        <BiLink size={25} />
      </Btn>
      <Sep />

      {/* Font color */}
      <Btn title="Font Color" onClick={() => console.log("font color")}>
        <RiFontColor size={22} />
      </Btn>
      <Sep />

      {/* Highlight / fill color */}
      <Btn
        title="Highlight Color"
        active={isHighlighted}
        onClick={toggleHighlight}
      >
        <IoColorFillOutline size={22} />
      </Btn>
      <Sep />

      {/* Font size icon */}
      <Btn title="Font Size" onClick={() => console.log("font size")}>
        <RiFontSize size={22} />
      </Btn>
      <Sep />

      {/* Alignment */}
      <Btn
        title="Align Left"
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
      >
        <MdFormatAlignLeft size={25} />
      </Btn>
      <Btn
        title="Align Center"
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
      >
        <MdFormatAlignCenter size={25} />
      </Btn>
      <Btn
        title="Align Right"
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
      >
        <MdFormatAlignRight size={25} />
      </Btn>
      <Btn
        title="Justify"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify")
        }
      >
        <MdFormatAlignJustify size={25} />
      </Btn>
      <Sep />

      {/* Table */}
      <div style={{ position: "relative" }}>
        <Btn title="Insert Table" onClick={() => setShowTablePicker((p) => !p)}>
          <BsTable size={16} />
        </Btn>

        {/* Grid picker */}
        {showTablePicker && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 100,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                marginBottom: 6,
                fontSize: 12,
                color: "#666",
                textAlign: "center",
              }}
            >
              {tableRows > 0 && tableCols > 0
                ? `${tableRows} × ${tableCols}`
                : "Hover to select"}
            </div>

            {/* 8x8 grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 18px)",
                gap: 2,
              }}
            >
              {Array.from({ length: 64 }, (_, i) => {
                const row = Math.floor(i / 8) + 1;
                const col = (i % 8) + 1;
                const isActive = row <= tableRows && col <= tableCols;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => {
                      setTableRows(row);
                      setTableCols(col);
                    }}
                    onClick={() => insertTable(tableRows, tableCols)}
                    style={{
                      width: 18,
                      height: 18,
                      border: `1px solid ${isActive ? "#3b82f6" : "#ddd"}`,
                      background: isActive ? "#eff6ff" : "#fff",
                      borderRadius: 2,
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>

            {/* Manual input */}
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <input
                type="number"
                min={1}
                max={20}
                placeholder="Rows"
                value={tableRows || ""}
                onChange={(e) => setTableRows(Number(e.target.value))}
                style={{
                  width: 52,
                  padding: "2px 4px",
                  fontSize: 12,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                }}
              />
              <span style={{ fontSize: 12, color: "#666" }}>×</span>
              <input
                type="number"
                min={1}
                max={20}
                placeholder="Cols"
                value={tableCols || ""}
                onChange={(e) => setTableCols(Number(e.target.value))}
                style={{
                  width: 52,
                  padding: "2px 4px",
                  fontSize: 12,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                }}
              />
              <button
                onClick={() =>
                  tableRows > 0 &&
                  tableCols > 0 &&
                  insertTable(tableRows, tableCols)
                }
                style={{
                  padding: "2px 8px",
                  fontSize: 12,
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Insert
              </button>
            </div>
          </div>
        )}
      </div>
      <Sep />

      {/* Lists */}
      <Btn
        title="Bullet List"
        onClick={() =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }
      >
        <AiOutlineUnorderedList size={25} />
      </Btn>
      <Btn
        title="Numbered List"
        onClick={() =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
      >
        <AiOutlineOrderedList size={25} />
      </Btn>
    </div>
  );
}
