/**
 * @page app/editor-preview/preview/page.tsx
 * @status STABLE
 * @description Route — editor-preview/preview
 * @lastReview 2026-03-28
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  SiteBlock,
  SiteGlobalStyles,
  EditorToIframeMessage,
  IframeToEditorMessage,
} from "@/components/site-editor/types";
import { SiteCanvasBlock } from "@/components/site-editor/CanvasBlock";

const DEFAULT_STYLES: SiteGlobalStyles = {
  primaryColor: "#10B981",
  secondaryColor: "#0D9488",
  fontHeading: "Inter",
  fontBody: "Inter",
  buttonRadius: 8,
  headerStyle: "sticky",
  footerStyle: "standard",
};

function sendToParent(msg: IframeToEditorMessage) {
  window.parent?.postMessage(msg, "*");
}

export default function EditorPreviewPage() {
  const [blocks, setBlocks] = useState<SiteBlock[]>([]);
  const [globalStyles, setGlobalStyles] = useState<SiteGlobalStyles>(DEFAULT_STYLES);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent<EditorToIframeMessage>) {
      const msg = event.data;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;

      switch (msg.type) {
        case "UPDATE_LAYOUT":
          setBlocks(msg.payload);
          break;
        case "UPDATE_GLOBAL_STYLES":
          setGlobalStyles(msg.payload);
          break;
        case "SET_ACTIVE_BLOCK":
          setActiveBlockId(msg.payload);
          break;
        case "SET_EDITING_BLOCK":
          setEditingBlockId(msg.payload);
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    sendToParent({ type: "IFRAME_READY" });
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleBlockSelect = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
    sendToParent({ type: "BLOCK_CLICKED", payload: blockId });
  }, []);

  const handleBlockDoubleClick = useCallback((blockId: string) => {
    setEditingBlockId(blockId);
    sendToParent({ type: "BLOCK_CLICKED", payload: blockId });
  }, []);

  const handleContentChange = useCallback((blockId: string, patch: Record<string, unknown>) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, content: { ...b.content, ...patch } } : b,
      ),
    );
    sendToParent({ type: "BLOCK_CONTENT_CHANGED", payload: { blockId, patch } });
  }, []);

  const handleCanvasClick = useCallback(() => {
    setActiveBlockId(null);
    setEditingBlockId(null);
    sendToParent({ type: "CANVAS_CLICKED" });
  }, []);

  const cssVars = {
    "--site-primary": globalStyles.primaryColor,
    "--site-secondary": globalStyles.secondaryColor,
    "--site-font-heading": globalStyles.fontHeading,
    "--site-font-body": globalStyles.fontBody,
    "--site-button-radius": `${globalStyles.buttonRadius}px`,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen bg-white"
      style={{ ...cssVars, fontFamily: `${globalStyles.fontBody}, sans-serif` }}
      onClick={handleCanvasClick}
    >
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(globalStyles.fontHeading)}:wght@400;500;600;700;800&family=${encodeURIComponent(globalStyles.fontBody)}:wght@300;400;500;600&display=swap`}
      />
      <div className="pl-10">
        {blocks.map((block) => (
          <SiteCanvasBlock
            key={block.id}
            block={block}
            isActive={activeBlockId === block.id}
            isEditing={editingBlockId === block.id}
            globalStyles={globalStyles}
            onSelect={() => handleBlockSelect(block.id)}
            onDoubleClick={() => handleBlockDoubleClick(block.id)}
            onContentChange={(patch) => handleContentChange(block.id, patch as Record<string, unknown>)}
            onRemove={() => {
              setBlocks((prev) => prev.filter((b) => b.id !== block.id));
            }}
          />
        ))}
        {blocks.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-400">
            Drag blocks from the library to start building
          </div>
        )}
      </div>
    </div>
  );
}
