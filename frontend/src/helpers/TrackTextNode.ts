import { TextNode, type SerializedTextNode } from "lexical";

export type ChangeType = "original" | "inserted" | "deleted";

export interface SerializedTrackTextNode extends SerializedTextNode {
  changeType: ChangeType;
}

export class TrackTextNode extends TextNode {
  __changeType: ChangeType;

  constructor(
    text: string = "",
    changeType: ChangeType = "original",
    key?: string,
  ) {
    super(text, key);
    this.__changeType = changeType;
  }

  // Node type
  static getType(): string {
    return "track-text";
  }

  // Clone node
  static clone(node: TrackTextNode): TrackTextNode {
    return new TrackTextNode(
      node.getTextContent(),
      node.__changeType,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedTrackTextNode): TrackTextNode {
    return new TrackTextNode(serializedNode.text, serializedNode.changeType);
  }

  exportJSON(): SerializedTrackTextNode {
    return {
      ...super.exportJSON(),
      changeType: this.__changeType,
      type: "track-text",
      version: 1,
    };
  }

  // Getter / Setter
  getChangeType(): ChangeType {
    return this.__changeType;
  }

  setChangeType(type: ChangeType) {
    this.getWritable().__changeType = type;
  }
}
