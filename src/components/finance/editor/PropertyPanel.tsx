/**
 * @component components/finance/editor/PropertyPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — PropertyPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { GlobalSettingsPanel } from "./panels/GlobalSettingsPanel";
import { HeaderPanel } from "./panels/HeaderPanel";
import { ClientPanel } from "./panels/ClientPanel";
import { MetaPanel } from "./panels/MetaPanel";
import { LineItemsPanel } from "./panels/LineItemsPanel";
import { TotalsPanel } from "./panels/TotalsPanel";
import { PaymentPanel } from "./panels/PaymentPanel";
import { SignaturePanel } from "./panels/SignaturePanel";
import { TextPanel } from "./panels/TextPanel";
import { SpacerPanel } from "./panels/SpacerPanel";
import { DividerPanel } from "./panels/DividerPanel";
import { ProgressClaimPanel } from "./panels/ProgressClaimPanel";
import { NdisPanel } from "./panels/NdisPanel";
import { BLOCK_LABELS } from "./types";
import { BlockLibrary } from "./BlockLibrary";

export function PropertyPanel() {
  const activeBlockId = useInvoiceEditorStore((s) => s.activeBlockId);
  const activeBlock = useInvoiceEditorStore((s) =>
    s.activeBlockId ? s.blocks.find((b) => b.id === s.activeBlockId) : null,
  );

  function renderBlockPanel() {
    if (!activeBlockId || !activeBlock) return <GlobalSettingsPanel />;

    switch (activeBlock.type) {
      case "header":
        return <HeaderPanel blockId={activeBlockId} />;
      case "client_details":
        return <ClientPanel blockId={activeBlockId} />;
      case "meta":
        return <MetaPanel blockId={activeBlockId} />;
      case "line_items":
        return <LineItemsPanel blockId={activeBlockId} />;
      case "totals":
        return <TotalsPanel blockId={activeBlockId} />;
      case "payment_button":
        return <PaymentPanel blockId={activeBlockId} />;
      case "signature":
        return <SignaturePanel blockId={activeBlockId} />;
      case "text":
      case "notes":
        return <TextPanel blockId={activeBlockId} />;
      case "spacer":
        return <SpacerPanel blockId={activeBlockId} />;
      case "divider":
        return <DividerPanel blockId={activeBlockId} />;
      case "progress_claim":
        return <ProgressClaimPanel blockId={activeBlockId} />;
      case "ndis_line_items":
        return <NdisPanel blockId={activeBlockId} />;
      default:
        return <GlobalSettingsPanel />;
    }
  }

  return (
    <div className="w-[380px] shrink-0 overflow-y-auto border-r border-[var(--border-base)] bg-[var(--surface-1)]">
      <div className="p-4">
        {/* Panel header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
            {activeBlock
              ? BLOCK_LABELS[activeBlock.type] || "Block"
              : "Document Settings"}
          </div>
          <BlockLibrary />
        </div>

        {renderBlockPanel()}
      </div>
    </div>
  );
}
