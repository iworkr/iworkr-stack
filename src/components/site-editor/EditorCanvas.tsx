/**
 * @component components/site-editor/EditorCanvas.tsx
 * @status STABLE
 * @description Loom site builder — EditorCanvas
 * @lastReview 2026-03-28
 */
"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { IframeToEditorMessage, EditorToIframeMessage } from "./types";

export function EditorCanvas() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const store = useSiteEditorStore();

  const sendToIframe = useCallback((msg: EditorToIframeMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  useEffect(() => {
    sendToIframe({ type: "UPDATE_LAYOUT", payload: store.blocks });
  }, [store.blocks, sendToIframe]);

  useEffect(() => {
    sendToIframe({ type: "UPDATE_GLOBAL_STYLES", payload: store.globalStyles });
  }, [store.globalStyles, sendToIframe]);

  useEffect(() => {
    sendToIframe({ type: "SET_ACTIVE_BLOCK", payload: store.activeBlockId });
  }, [store.activeBlockId, sendToIframe]);

  useEffect(() => {
    sendToIframe({ type: "SET_EDITING_BLOCK", payload: store.editingBlockId });
  }, [store.editingBlockId, sendToIframe]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<IframeToEditorMessage>) {
      const msg = event.data;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;

      switch (msg.type) {
        case "BLOCK_CLICKED":
          store.setActiveBlock(msg.payload);
          break;
        case "BLOCK_CONTENT_CHANGED":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          store.updateBlockContent(msg.payload.blockId, msg.payload.patch as any);
          break;
        case "CANVAS_CLICKED":
          store.setActiveBlock(null);
          store.setEditingBlock(null);
          break;
        case "IFRAME_READY":
          sendToIframe({ type: "UPDATE_LAYOUT", payload: store.blocks });
          sendToIframe({ type: "UPDATE_GLOBAL_STYLES", payload: store.globalStyles });
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [store, sendToIframe]);

  const src = store.siteId && store.pageId
    ? `/editor-preview/preview?siteId=${store.siteId}&pageId=${store.pageId}`
    : "about:blank";

  return (
    <div className="flex-1 bg-[#1a1a1a] overflow-auto flex items-start justify-center p-8">
      <div className="w-full max-w-[1280px] bg-white rounded-lg shadow-2xl overflow-hidden">
        <iframe
          ref={iframeRef}
          src={src}
          className="w-full border-0"
          style={{ minHeight: "calc(100vh - 120px)" }}
          title="Site Preview"
        />
      </div>
    </div>
  );
}
