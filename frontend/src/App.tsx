import React, { useState, useCallback } from "react";
import { type EditorState } from "lexical";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TableNode, TableCellNode, TableRowNode } from "@lexical/table";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { ToolbarPlugin } from "./ToolbarPlugin";
import { OnChangePlugin } from "./OnChangePlugin";
import { MarkNode } from "@lexical/mark";
import { theme } from "./theme";

function onError(error: Error) {
  console.error(error);
}

function App(): React.ReactElement {
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialConfig = {
    namespace: "MyEditor",
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      MarkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
    ],
  };

  const handleExportDocx = async (): Promise<void> => {
    if (!editorState) return;

    const json = editorState.toJSON();

    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3000/export/lexical/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: json }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "document.docx";
      a.click();
      URL.revokeObjectURL(url);

      setIsExporting(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to export");
    }
  };

  const handleChange = useCallback((state: EditorState) => {
    setEditorState(state);
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!editorState) return;

    const json = editorState.toJSON();

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:3000/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: json,
          savedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      console.log("Saved successfully:", data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ToolbarPlugin />
      <RichTextPlugin
        contentEditable={
          <div className="editor-wrapper">
            <ContentEditable
              className="editor-input"
              aria-placeholder="Enter some text..."
              placeholder={
                <div className="editor-placeholder">Enter some text...</div>
              }
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                }
              }}
            />
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <AutoFocusPlugin />
      <ListPlugin />
      <TabIndentationPlugin />
      <TablePlugin />
      <OnChangePlugin onChange={handleChange} />
      <div>
        <button
          onClick={handleSave}
          className="btn"
          disabled={isSaving || !editorState}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button
          onClick={handleExportDocx}
          className="btn"
          disabled={isExporting || !editorState}
        >
          {isExporting ? "Exporting..." : "Export"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </LexicalComposer>
  );
}

export default App;
