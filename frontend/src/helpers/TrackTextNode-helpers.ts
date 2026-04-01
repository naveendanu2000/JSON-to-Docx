import type { LexicalNode } from "lexical";
import { TrackTextNode } from "./TrackTextNode";

export function $isTrackTextNode(node: LexicalNode): node is TrackTextNode {
  return node instanceof TrackTextNode;
}

export function $createInsertedNode(text: string): TrackTextNode {
  const node = new TrackTextNode(text, "inserted");
  // node.setStyle("color: #006600;"); // green for inserted
  return node;
}
