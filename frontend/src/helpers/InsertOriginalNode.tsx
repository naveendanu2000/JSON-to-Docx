"use strict";

import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";

import { ElementNode, isHTMLElement, $applyNodeReplacement } from "lexical";
import { addClassNamesToElement } from "@lexical/utils";
import { v4 as uuidv4 } from "uuid";

function formatDate(date: Date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const hours = date.getHours() % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "PM" : "AM";

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} ${hours}:${minutes}:${seconds} ${ampm}`;
}

export type SerializedInsertOriginalNode = Spread<
  { username: string; id: string; date: string },
  SerializedElementNode
>;

export default class InsertOriginalNode extends ElementNode {
  __username: string;
  __id: string;
  __date: string;

  static getType(): string {
    return "insert-original";
  }

  static clone(node: InsertOriginalNode): InsertOriginalNode {
    return new InsertOriginalNode(
      node.__username,
      node.__id,
      node.__date,
      node.__key,
    );
  }

  constructor(username: string, id?: string, date?: string, key?: NodeKey) {
    super(key);
    this.__username = username;
    this.__id = id ?? uuidv4();
    this.__date = date ?? formatDate(new Date());
  }

  createDOM(config: EditorConfig): HTMLSpanElement {
    const element = document.createElement("span");

    element.setAttribute("username", this.__username);
    element.setAttribute("id", this.__id);
    element.setAttribute("date", this.__date);

    addClassNamesToElement(element, config.theme.insertOriginal);

    return element;
  }

  updateDOM(
    prevNode: InsertOriginalNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    // Only reflect state → DOM (no mutation)
    if (prevNode.__date !== this.__date) {
      dom.setAttribute("date", this.__date);
    }
    if (prevNode.__username !== this.__username) {
      dom.setAttribute("username", this.__username);
    }
    if (prevNode.__id !== this.__id) {
      dom.setAttribute("id", this.__id);
    }

    return false; // no need to re-render
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: () => ({
        conversion: convertSpanElement,
        priority: 1,
      }),
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);

    if (element && isHTMLElement(element)) {
      if (this.isEmpty()) {
        element.append(document.createElement("br"));
      }

      const formatType = this.getFormatType();
      element.style.textAlign = formatType;

      const direction = this.getDirection();
      if (direction) element.dir = direction;

      const indent = this.getIndent();
      if (indent > 0) {
        element.style.textIndent = `${indent * 20}px`;
      }

      element.setAttribute("date", this.__date);
    }

    return { element };
  }

  static importJSON(
    serializedNode: SerializedInsertOriginalNode,
  ): InsertOriginalNode {
    const node = $createInsertOriginalNode(
      serializedNode.username,
      serializedNode.id,
      serializedNode.date,
    );

    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);

    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: "insert-original",
      username: this.__username,
      id: this.__id,
      date: this.__date,
    };
  }

  canInsertTextBefore() {
    return true;
  }

  canInsertTextAfter() {
    return true;
  }

  canBeEmpty() {
    return false;
  }

  isInline() {
    return true;
  }

  isTextEntity() {
    return true;
  }

  setNewDate() {
    const writable = this.getWritable();
    writable.__date = formatDate(new Date());
  }
}

/**
 * DOM Conversion
 */
function convertSpanElement(domNode: Node) {
  let node = null;

  if (isHTMLElement(domNode)) {
    const content = domNode.textContent;
    const className = domNode.getAttribute("class");

    if (content && className?.includes("editor-insert-original")) {
      node = $createInsertOriginalNode(
        domNode.getAttribute("username")!,
        domNode.getAttribute("id")!,
        domNode.getAttribute("date")!,
      );
    }
  }

  return { node };
}

/**
 * Factory
 */
export function $createInsertOriginalNode(
  username: string,
  id?: string,
  date?: string,
): InsertOriginalNode {
  return $applyNodeReplacement(new InsertOriginalNode(username, id, date));
}

/**
 * Type Guard
 */
export function $isInsertOriginalNode(
  node: unknown,
): node is InsertOriginalNode {
  return node instanceof InsertOriginalNode;
}