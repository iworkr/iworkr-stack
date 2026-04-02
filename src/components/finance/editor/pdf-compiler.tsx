/**
 * @component components/finance/editor/pdf-compiler.tsx
 * @status STABLE
 * @description Moneta invoice canvas — pdf-compiler
 * @lastReview 2026-03-28
 */
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceBlock, GlobalSettings, WorkspaceBrand, InvoiceBlockType } from "./types";
import {
  PdfHeaderBlock,
  PdfClientBlock,
  PdfMetaBlock,
  PdfLineItemsBlock,
  PdfTotalsBlock,
  PdfNotesBlock,
  PdfPaymentFallback,
  PdfSignaturePlaceholder,
  PdfTextBlock,
  PdfSpacerBlock,
  PdfDividerBlock,
  PdfProgressClaimBlock,
  PdfNdisLineItemsBlock,
} from "./blocks/pdf/PdfBlocks";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "JetBrains Mono",
  src: "https://fonts.gstatic.com/s/jetbrainsmono/v20/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.ttf",
});

const pageStyles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: "#1a1a1a",
    paddingTop: 40,
    paddingBottom: 60,
    backgroundColor: "#ffffff",
  },
  footer: {
    position: "absolute" as const,
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center" as const,
  },
  footerText: { fontSize: 7, color: "#cccccc" },
});

type PdfRenderer = React.ComponentType<{
  block: InvoiceBlock;
  blocks: InvoiceBlock[];
  settings: GlobalSettings;
  workspace: WorkspaceBrand;
}>;

const PDF_BLOCK_MAP: Record<InvoiceBlockType, PdfRenderer> = {
  header: PdfHeaderBlock,
  client_details: PdfClientBlock,
  meta: PdfMetaBlock,
  line_items: PdfLineItemsBlock,
  totals: PdfTotalsBlock,
  notes: PdfNotesBlock,
  payment_button: PdfPaymentFallback,
  signature: PdfSignaturePlaceholder,
  text: PdfTextBlock,
  spacer: PdfSpacerBlock,
  divider: PdfDividerBlock,
  progress_claim: PdfProgressClaimBlock,
  ndis_line_items: PdfNdisLineItemsBlock,
};

interface CompileProps {
  blocks: InvoiceBlock[];
  settings: GlobalSettings;
  workspace: WorkspaceBrand;
}

export function BlockInvoiceDocument({ blocks, settings, workspace }: CompileProps) {
  const metaBlock = blocks.find((b) => b.type === "meta");
  const displayId = metaBlock ? (metaBlock.content as any).displayId : "Invoice";

  return (
    <Document title={`Invoice ${displayId}`} author={workspace.name}>
      <Page size="A4" style={pageStyles.page}>
        {blocks.map((block) => {
          const Renderer = PDF_BLOCK_MAP[block.type];
          if (!Renderer) return null;
          return (
            <Renderer
              key={block.id}
              block={block}
              blocks={blocks}
              settings={settings}
              workspace={workspace}
            />
          );
        })}

        <View style={pageStyles.footer} fixed>
          <Text style={pageStyles.footerText}>
            {workspace.name} • {displayId}
          </Text>
          <Text style={pageStyles.footerText}>Powered by iWorkr</Text>
        </View>
      </Page>
    </Document>
  );
}
