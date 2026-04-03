/* eslint-disable @typescript-eslint/no-unused-vars */
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_DOWN_COMMAND,
  LexicalNode,
  RangeSelection,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { $createInsertNode } from "./helpers/InsertNode";
import { $createDeleteNode } from "./helpers/DeleteNode";
import { useEffect } from "react";
import { $createInsertOriginalNode } from "./helpers/InsertOriginalNode";

const username = "user1";

/**
 * Merge all delete nodes that are next to each other
 * FIXED: Added proper error handling and fresh selection
 *
 * @param {RangeSelection} selection - Current selection
 *
 */
function mergeDelete(selection: RangeSelection) {
  try {
    // Get a fresh selection to avoid stale data
    const currentSelection = $getSelection();
    if (!$isRangeSelection(currentSelection)) return;

    const selectedNodes = currentSelection.getNodes();

    // merge all the delete nodes that are next to each other within the nodes that are currently selected
    for (const currentNode of selectedNodes) {
      if (currentNode.__type == "paragraph") {
        continue;
      }
      const mainNode = currentNode.getTopLevelElement();
      if (!mainNode) continue;

      const childNodes = mainNode.getChildren() ?? [];
      let prevNode = null;
      const mergedDeleteNodes = [];
      let mergedNode = null;

      for (const node of childNodes) {
        if (node.__type == "delete" && prevNode == null) {
          prevNode = node;
          if (mergedNode) {
            mergedDeleteNodes.push(mergedNode);
            mergedNode = null;
          }
          continue;
        }
        if (node.__type == "delete" && prevNode !== null) {
          const prevChildNodes = (prevNode as any).getChildren();
          const currentChildNodes = (node as any).getChildren();
          const newChildNodes = [...prevChildNodes, ...currentChildNodes];
          const newDeleteNode = $createDeleteNode(username);
          newDeleteNode.append(...newChildNodes);
          node.insertBefore(newDeleteNode);
          node.remove();
          prevNode.remove();
          prevNode = newDeleteNode;
          mergedNode = newDeleteNode;
        } else {
          prevNode = null;
          if (mergedNode) {
            mergedDeleteNodes.push(mergedNode);
            mergedNode = null;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in mergeDelete:", error);
    // Don't throw - just log and continue
  }
}

/**
 * Handles the selection when multiple nodes are selected.
 *
 * @param {LexicalNode} node - The node that was selected.
 * @param {number} offset - anchor offset / focus offset value.
 * @param {string} selectedArea - Left or Right half that was selected.
 *
 */
function handleMultiNodeSplit(node: any, offset: number, selectedArea: string) {
  const parentNode = node.getParent();

  if (parentNode && parentNode.__type === "insert") {
    if (offset === -1) {
      // when the full node is selected
      node.remove();
      return;
    }
    const parentInsertNode: any = node.getParent();
    let split_nodes: [Text, Text] | any = null;

    const newParaNode = $createParagraphNode();
    newParaNode.append(node);
    split_nodes = node.splitText(...[offset]);
    // depending on which half was selected split the node accordingly
    if (selectedArea == "left") {
      if (offset === 0) {
        parentInsertNode.append(node);
        //   $setSelection(node.select(0, 0));
        return [node];
      } else if (node.__text.length === offset) {
        split_nodes[0].remove();
        const newTextNode = $createTextNode("");
        parentInsertNode.append(newTextNode);
        return newTextNode;
      } else {
        split_nodes[0].remove();
        parentInsertNode.append(split_nodes[1]);
        //   $setSelection(split_nodes[1].select(0, 0));
        return [split_nodes[1]]; // if a node is returned within an area it means that this particular node has to be selected and the pointer must be kept at position (0, 0) to handle edge cases
      }
    } else {
      if (offset === 0) {
        split_nodes[0].remove();
        const newTextNode = $createTextNode("");
        parentInsertNode.append(newTextNode);
        return newTextNode;
      } else if (node.__text.length === offset) {
        parentInsertNode.append(node);
        return node;
      } else {
        split_nodes[1].remove();
        parentInsertNode.append(split_nodes[0]);
        return split_nodes[0];
      }
    }
  }
  // splitting delete nodes
  if (node.getParent().__type === "delete") {
    if (offset === -1) {
      // when the full node is selected
      return;
    }
    if (selectedArea === "right") {
      return node;
    } else {
      // $setSelection(node.select(0,0));
      return [node];
    }
  }

  // case when the selected node is a text node of a paragraph node (pre-existing text case)
  const delNode = $createDeleteNode(username);
  node.insertBefore(delNode);

  if (offset === -1) {
    delNode.append(node);
    return;
  }

  let split_nodes = null;
  const newParaNode = $createParagraphNode();
  newParaNode.append(node);
  split_nodes = node.splitText(...[offset]);
  if (selectedArea == "left") {
    // if the cursor has selected the left half
    if (offset == 0) {
      delNode.insertBefore(split_nodes[0]);
      delNode.remove();
    } else if (node.__text.length === offset) {
      delNode.append(split_nodes[0]);
    } else {
      delNode.append(split_nodes[0]);
      delNode.insertAfter(split_nodes[1]);
    }
  } else {
    // if the cursor has selected the right half
    if (offset == 0) {
      delNode.append(split_nodes[0]);
    } else if (node.__text.length === offset) {
      delNode.insertAfter(split_nodes[0]);
      delNode.remove();
    } else {
      delNode.append(split_nodes[1]);
      delNode.insertBefore(split_nodes[0]);
    }
  }

  return split_nodes[0];
}

/**
 * Handles the selection within a single node.
 *
 * @param {LexicalNode} node - The node that was selected.
 * @param {number} anchorOffset - anchor offset value
 * @param {number} focusOffset - focus offset value
 * @param {string | null} data - The data to be inserted
 */
function handleSingleNodeSplit(
  node: any,
  anchorOffset: number,
  focusOffset: number,
  data: string | null,
) {
  let selectedArea = "left";
  const parentNode = node.getParent();
  // logic for deciding which half was selected within the node
  if (anchorOffset < focusOffset) {
    selectedArea = "right";
  }

  if (anchorOffset == node.getTextContent().length) {
    selectedArea = "right";
  } else if (anchorOffset == 0) {
    selectedArea = "left";
  }
  // splitting the different types of nodes accordingly
  if (parentNode && parentNode.__type == "delete") {
    node.select();
  }
  // all insert based nodes that were selected have to be removed
  else if (parentNode && parentNode.__type == "insert") {
    const parentInsertNode: LexicalNode | any = node.getParent();
    const newParaNode = $createParagraphNode();
    newParaNode.append(node);
    const splitNodes = node.splitText(...[anchorOffset, focusOffset]);
    if (splitNodes.length == 1) {
      const parentParaNode = parentInsertNode.getParent();
      parentInsertNode.remove();
      parentParaNode.select();
    } else if (splitNodes.length == 2) {
      if (selectedArea == "left") {
        splitNodes[0].remove();
        parentInsertNode.append(splitNodes[1]);
        splitNodes[1].select(0, 0);
      } else {
        splitNodes[1];
        parentInsertNode.append(splitNodes[0]);
        splitNodes[0].select();
      }
    } else {
      splitNodes[1].remove();
      const selectedOffset = splitNodes[0].getTextContent().length;
      const newTextNode = $createTextNode(
        splitNodes[0].getTextContent() + splitNodes[2].getTextContent(),
      );
      parentInsertNode.append(newTextNode);
      newTextNode.select(selectedOffset, selectedOffset);
    }
  }
  // all other nodes that are not insert or delete must be wrapped within a delete node
  else {
    const delNode = $createDeleteNode(username);
    node.insertBefore(delNode);
    const newParaNode = $createParagraphNode();
    newParaNode.append(node);
    const splitNodes = node.splitText(...[anchorOffset, focusOffset]);
    if (splitNodes.length == 1) {
      delNode.append(splitNodes[0]);
      delNode.select();
    } else if (splitNodes.length == 2) {
      if (selectedArea == "left") {
        delNode.append(splitNodes[0]);
        delNode.insertAfter(splitNodes[1]);
        delNode.select();
      } else {
        delNode.append(splitNodes[1]);
        delNode.insertBefore(splitNodes[0]);
        splitNodes[0].select();
      }
    } else {
      delNode.append(splitNodes[1]);
      delNode.insertBefore(splitNodes[0]);
      delNode.insertAfter(splitNodes[2]);
      if (selectedArea == "left") {
        splitNodes[0].select();
      } else {
        delNode.select();
      }
    }
  }
  // if there is data it must be inserted at the selected focus offset
  if (data) {
    handleInsert(data);
  }
}

/**
 * Handles the selection and insertion or deletion of data.
 *
 * @param {string | null} data - The data to be inserted.
 */
export function handleSelection(data: string | null) {
  const selection = $getSelection(); // get the current selection

  const selectionCopy = selection?.clone();
  if ($isRangeSelection(selection)) {
    // get all the nodes that are selected along with the focus and anchor details
    const selectedNodes = selection.getNodes();
    const anchorOffset = selection.anchor.offset;
    const focusOffset = selection.focus.offset;
    const anchorKey = selection.anchor.key;
    const focusKey = selection.focus.key;

    // when a user tries to select within a single node
    if (selectedNodes.length == 1) {
      const node = selectedNodes[0];
      handleSingleNodeSplit(node, anchorOffset, focusOffset, data);
    } else {
      // setting the selected area, when the users selects from bottom to top or vice-versa the selection area differs
      let anchor = false;
      for (const node of selectedNodes) {
        if (node.__key == anchorKey) {
          anchor = true;
          break;
        }

        if (node.__key == focusKey) {
          break;
        }
      }

      let anchorSelectedArea = "left";
      let focusSelectedArea = "right";

      if (anchor) {
        anchorSelectedArea = "right";
        focusSelectedArea = "left";
      }
      // for selection based insertion or deletion the node where the anchor node or focus node points to must be split and wrapped accordingly all other nodes can be wrapped within the delete node provide it is not already a delete node
      for (const node of selectedNodes) {
        if (node.__type === "text" && node.__key === anchorKey) {
          //splitting anchor node
          handleMultiNodeSplit(node, anchorOffset, anchorSelectedArea);
        } else if (node.__type === "text" && node.__key === focusKey) {
          //splitting focus node and inserting the data if its not null
          const split_node = handleMultiNodeSplit(
            node,
            focusOffset,
            focusSelectedArea,
          );
          if (Array.isArray(split_node)) {
            $setSelection(split_node[0].select(0, 0));
          } else {
            $setSelection(split_node.select());
          }

          if (data) {
            handleInsert(data);
          }
        } else if (node.__type === "text") {
          // all other nodes that were fully selected
          handleMultiNodeSplit(node, -1, anchorSelectedArea);
        }
      }
    }

    if ($isRangeSelection(selectionCopy)) {
      mergeDelete(selectionCopy);
    }
  }

  return true;
}

function handleInsertFromDiff(
  data: {
    word: string;
    type: "retained" | "inserted" | "deleted";
    created_by: string;
  }[],
) {
  const selection = $getSelection();

  if (!$isRangeSelection(selection)) return false;

  // Helper to create node based on type
  function createNode(type: string, username: string) {
    if (type === "retained") {
      return $createInsertOriginalNode(username);
    }
    if (type === "deleted") {
      return $createDeleteNode(username);
    }
    return $createInsertNode(username);
  }

  let currentGroup: {
    type: string;
    username: string;
    words: string[];
  } | null = null;

  const nodesToInsert: LexicalNode[] = [];

  for (const token of data) {
    // Start new group
    if (
      !currentGroup ||
      currentGroup.type !== token.type ||
      currentGroup.username !== token.created_by
    ) {
      // Flush previous group
      if (currentGroup) {
        const node = createNode(currentGroup.type, currentGroup.username);

        node.append($createTextNode(currentGroup.words.join("")));

        nodesToInsert.push(node);
      }

      // Start new group
      currentGroup = {
        type: token.type,
        username: token.created_by,
        words: [token.word],
      };
    } else {
      // Continue same group
      currentGroup.words.push(token.word);
    }
  }

  // Flush last group
  if (currentGroup) {
    const node = createNode(currentGroup.type, currentGroup.username);

    node.append($createTextNode(currentGroup.words.join("")));

    nodesToInsert.push(node);
  }

  // Insert into editor
  selection.insertNodes(nodesToInsert);

  return true;
}

/**
 * Handles the insertion of data.
 *
 * @param {string} data - The data to be inserted.
 */
function handleInsert(data: string) {
  const selection = $getSelection(); // get the current selection
  if ($isRangeSelection(selection)) {
    const currentNode: LexicalNode | any = selection.getNodes()[0];
    // get the node that is selected along with the anchor and focus details
    const anchorKey = selection.anchor.key;
    const focusKey = selection.focus.key;
    const anchorOffset = selection.anchor.offset;
    const focusOffset = selection.focus.offset;
    // if the anchor and focus offset are different it generally means that a bunch of content was selected
    if (anchorOffset !== focusOffset) {
      return handleSelection(data);
    }
    // edge case when the anchor and focus offset are same but the keys are different, it still means that a bunch of paragraphs were selected.
    if (anchorOffset == focusOffset && anchorKey !== focusKey) {
      return handleSelection(data);
    }
    if (currentNode.__type == "root") {
      selection.insertNodes([
        $createParagraphNode(),
        $createInsertNode(username),
      ]);
      selection.insertText(data);
      return true;
    }
    // inserting data within a insert node
    if (currentNode.getParent().__type == "insert") {
      const insertNode = currentNode.getParent();
      if (insertNode.__username == username) {
        selection.insertText(data);
        insertNode.setNewDate();
      } else {
        const newInsertNode = $createInsertNode(username);
        insertNode.insertAfter(newInsertNode);
        const splitNodes = currentNode.splitText(anchorOffset);
        insertNode.append(splitNodes[0]);
        if (splitNodes.length !== 1) {
          const oldInsertNode = $createInsertNode(insertNode.__username);
          newInsertNode.insertAfter(oldInsertNode);
          oldInsertNode.append(splitNodes[1]);
        }
        const textNode = $createTextNode("");
        newInsertNode.append(textNode);
        textNode.select().insertText(data);
      }
    }
    // inserting data within a delete node
    else if (currentNode.getParent().__type == "delete") {
      const insertNode = $createInsertNode(username);
      insertNode.append($createTextNode(data));
      currentNode.getParent().insertAfter(insertNode);
      $setSelection(insertNode.select());
    }
    // inserting data within any other node
    else {
      const insertNode = $createInsertNode(username);
      selection.insertNodes([insertNode]);
      selection.insertText(data);
    }
  }

  return true;
}

/**
 * Handles the deletion of data.
 * FIXED: Added null checks for prevSibling
 */
function handleDelete() {
  const selection = $getSelection(); // get the current selection
  if ($isRangeSelection(selection)) {
    // get the anchor and focus details
    const anchorOffset = selection.anchor.offset;
    const focusOffset = selection.focus.offset;
    const anchorKey = selection.anchor.key;
    const focusKey = selection.focus.key;
    // if the anchor and focus offset are different it generally means that a bunch of content was selected
    if (anchorOffset !== focusOffset) {
      return handleSelection(null);
    }

    // edge case when the anchor and focus offset are same but the keys are different, it still means that a bunch of paragraphs were selected.
    if (anchorOffset == focusOffset && anchorKey !== focusKey) {
      return handleSelection(null);
    }
    let currentNode: LexicalNode | any = selection.getNodes()[0];

    // when the user tries to delete inner level blocks within paragraphs like span tags and other nodes
    if (anchorOffset == 0 && currentNode.getParent().__type != "paragraph") {
      while (currentNode.__type != "paragraph") {
        // some condition
        const prevSibling = currentNode.getPreviousSibling();
        if (prevSibling) {
          prevSibling.select();
          handleDelete();
          return true;
        } else {
          const parentNode = currentNode.getParent();
          if (parentNode.getTextContent() == currentNode.getTextContent()) {
            //mark as delete
          }
          currentNode = parentNode;
        }
      }

      const previousSibling = currentNode.getPreviousSibling();
      if (previousSibling) {
        const descendant = previousSibling.getLastDescendant();
        if (descendant) {
          descendant.select();
        } else {
          previousSibling.select();
        }
      }

      return true;
    }
    // when the user tries to delete a paragraph
    if (anchorOffset == 0 && currentNode.getParent().__type == "paragraph") {
      const paraNode = currentNode.getParent();
      const previousSibling = paraNode.getPreviousSibling();
      if (previousSibling) {
        const descendant = previousSibling.getLastDescendant();
        if (descendant) {
          descendant.select();
        } else {
          previousSibling.select();
        }
      }

      return true;
    }

    // logic for deleting a insert node
    if (currentNode.getParent().__type == "insert") {
      const parentInsertNode = currentNode.getParent();
      // when the user tries to delete the content from the end or a single character content
      if (anchorOffset == currentNode.getTextContent().length) {
        const paraNode = $createParagraphNode();
        paraNode.append(currentNode);
        const splitNodes = currentNode.splitText(...[anchorOffset - 1]);
        if (splitNodes.length == 1) {
          const prevSibling = parentInsertNode.getPreviousSibling();
          if (prevSibling) {
            parentInsertNode.remove();
            // FIXED: Check if select method exists
            if (typeof prevSibling.select === "function") {
              prevSibling.select();
            } else {
              // If prevSibling doesn't have select method, try selecting its last descendant
              const lastDesc = prevSibling.getLastDescendant?.();
              if (lastDesc && typeof lastDesc.select === "function") {
                lastDesc.select();
              }
            }
          } else {
            const parentParaNode = parentInsertNode.getParent();
            parentInsertNode.remove();
            if (parentParaNode && typeof parentParaNode.select === "function") {
              parentParaNode.select();
            }
          }
        } else {
          parentInsertNode.append(splitNodes[0]);
          splitNodes[1].remove();
          splitNodes[0].select();
        }
      }
      // when the user tries to delete a content within the middle
      else {
        const paraNode = $createParagraphNode();
        paraNode.append(currentNode);
        const splitNodes = currentNode.splitText(
          ...[anchorOffset - 1, anchorOffset],
        );
        console.log(splitNodes);
        if (splitNodes.length == 2) {
          splitNodes[0].remove();
          parentInsertNode.append(splitNodes[1]);
          const prevSibling = parentInsertNode.getPreviousSibling();
          if (prevSibling) {
            // FIXED: Check if select method exists
            if (typeof prevSibling.select === "function") {
              prevSibling.select();
            } else {
              const lastDesc = prevSibling.getLastDescendant?.();
              if (lastDesc && typeof lastDesc.select === "function") {
                lastDesc.select();
              }
            }
          } else {
            splitNodes[1].select(0, 0);
          }
        } else {
          const offset = splitNodes[0].getTextContent().length;
          const textNode = $createTextNode(
            splitNodes[0].getTextContent() + splitNodes[1].getTextContent(),
          );
          parentInsertNode.append(textNode);
          textNode.select(offset, offset);
        }
      }
      // merging all the delete nodes to avoid duplicates
      mergeDelete(selection);
      return true;
    }

    // when the user tries to delete a delete node
    if (currentNode.getParent().__type == "delete") {
      const parentDeleteNode = currentNode.getParent();
      const prevSibling = parentDeleteNode.getPreviousSibling();
      if (prevSibling) {
        // FIXED: Check if select method exists
        if (typeof prevSibling.select === "function") {
          prevSibling.select();
        } else {
          const lastDesc = prevSibling.getLastDescendant?.();
          if (lastDesc && typeof lastDesc.select === "function") {
            lastDesc.select();
          }
        }
        return true;
      }
      currentNode.getParent().select(0, 0);
      mergeDelete(selection);
      return true;
    }

    // when to user tries to delete any other node
    // Removing content from the end of a string or deleting a single character from the content.
    if (anchorOffset == currentNode.getTextContent().length) {
      const deleteNode = $createDeleteNode(username);
      currentNode.insertAfter(deleteNode);
      const paraNode = $createParagraphNode();
      paraNode.append(currentNode);
      const splitNodes = currentNode.splitText(...[anchorOffset - 1]);
      if (splitNodes.length == 1) {
        deleteNode.append(splitNodes[0]);
        splitNodes[0].select(0, 0);
      } else {
        deleteNode.insertBefore(splitNodes[0]);
        deleteNode.append(splitNodes[1]);
        splitNodes[0].select();
      }
    }
    // Removing the content from the middle
    else {
      const deleteNode = $createDeleteNode(username);
      currentNode.insertAfter(deleteNode);
      const paraNode = $createParagraphNode();
      paraNode.append(currentNode);
      const splitNodes = currentNode.splitText(
        ...[anchorOffset - 1, anchorOffset],
      );
      if (splitNodes.length == 2) {
        deleteNode.append(splitNodes[0]);
        deleteNode.insertAfter(splitNodes[1]);
        splitNodes[0].select(0, 0);
      } else {
        deleteNode.append(splitNodes[1]);
        deleteNode.insertBefore(splitNodes[0]);
        deleteNode.insertAfter(splitNodes[2]);
        splitNodes[0].select();
      }
    }
    // merging duplicate delete nodes
    mergeDelete(selection);
  }
  return true;
}

export function TrackChangePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      handleInsertFromDiff([
        { word: "Hello ", type: "retained", created_by: "Naveen" },
        { word: "world", type: "retained", created_by: "Ankit" },
        { word: "there", type: "retained", created_by: "Ankit" },
        { word: "!", type: "retained", created_by: "Ankit" },
        { word: " How ", type: "retained", created_by: "Ankit" },
        { word: "are you?", type: "retained", created_by: "Naveen" },
      ]);
    });
  }, [editor]);

  // Overide any keypress operation
  // editor.registerCommand(
  //   KEY_DOWN_COMMAND,
  //   (event) => {
  //     const regex = /^[a-zA-Z0-9\s`~!@#$%^&*()_+={}\[\]:;"'<>,.?/|\\-]$/;
  //     if (!regex.test(event.key)) {
  //       // to ignore key press events like Enter, Left Arrow, Right Arrow etc
  //       return false;
  //     }
  //     event.preventDefault();
  //     return handleInsert(event.key);
  //   },
  //   COMMAND_PRIORITY_LOW,
  // );
  editor.registerCommand(
    KEY_DOWN_COMMAND,
    (event) => {
      const isCtrl = event.ctrlKey || event.metaKey;

      // ✅ Handle Undo (Ctrl + Z)
      if (isCtrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        editor.dispatchCommand(UNDO_COMMAND, undefined);
        return true;
      }

      // ✅ Handle Redo (Ctrl + Y or Ctrl + Shift + Z)
      if (
        (isCtrl && event.key.toLowerCase() === "y") ||
        (isCtrl && event.shiftKey && event.key.toLowerCase() === "z")
      ) {
        event.preventDefault();
        editor.dispatchCommand(REDO_COMMAND, undefined);
        return true;
      }

      // Your existing typing logic
      const regex = /^[a-zA-Z0-9\s`~!@#$%^&*()_+={}\[\]:;"'<>,.?/|\\-]$/;

      if (!regex.test(event.key)) {
        return false;
      }

      event.preventDefault();
      return handleInsert(event.key);
    },
    COMMAND_PRIORITY_HIGH,
  );

  // Override backspace keypress operation
  editor.registerCommand(
    KEY_BACKSPACE_COMMAND,
    (event) => {
      event.preventDefault();
      return handleDelete();
    },
    COMMAND_PRIORITY_HIGH,
  );

  // Override delete keypress operation
  editor.registerCommand(
    KEY_DELETE_COMMAND,
    (event) => {
      event.preventDefault();
      return handleDelete();
    },
    COMMAND_PRIORITY_HIGH,
  );

  // Override ctrl+backspace operation
  editor.registerCommand(
    DELETE_LINE_COMMAND,
    (_event) => {
      return handleDelete();
    },
    COMMAND_PRIORITY_HIGH,
  );

  // Override shift+delete operation
  editor.registerCommand(
    DELETE_CHARACTER_COMMAND,
    (_event) => {
      return handleDelete();
    },
    COMMAND_PRIORITY_HIGH,
  );

  // Override ctrl+delete operation
  editor.registerCommand(
    DELETE_WORD_COMMAND,
    (_event) => {
      return handleDelete();
    },
    COMMAND_PRIORITY_HIGH,
  );

  return null;
}
