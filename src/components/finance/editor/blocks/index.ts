/**
 * @component components/finance/editor/blocks/index.ts
 * @status STABLE
 * @description Moneta invoice canvas — index
 * @lastReview 2026-03-28
 */
import type { InvoiceBlockType, BlockRendererProps } from "../types";
import { HeaderBlock } from "./HeaderBlock";
import { ClientDetailsBlock } from "./ClientDetailsBlock";
import { MetaBlock } from "./MetaBlock";
import { LineItemsBlock } from "./LineItemsBlock";
import { TotalsBlock } from "./TotalsBlock";
import { NotesBlock } from "./NotesBlock";
import { PaymentButtonBlock } from "./PaymentButtonBlock";
import { SignatureBlock } from "./SignatureBlock";
import { TextBlock } from "./TextBlock";
import { SpacerBlock } from "./SpacerBlock";
import { DividerBlock } from "./DividerBlock";
import { ProgressClaimBlock } from "./ProgressClaimBlock";
import { NdisLineItemsBlock } from "./NdisLineItemsBlock";

type AnyBlockRenderer = React.ComponentType<BlockRendererProps<any>>;

export const BLOCK_RENDERER_MAP: Record<InvoiceBlockType, AnyBlockRenderer> = {
  header: HeaderBlock,
  client_details: ClientDetailsBlock,
  meta: MetaBlock,
  line_items: LineItemsBlock,
  totals: TotalsBlock,
  notes: NotesBlock,
  payment_button: PaymentButtonBlock,
  signature: SignatureBlock,
  text: TextBlock,
  spacer: SpacerBlock,
  divider: DividerBlock,
  progress_claim: ProgressClaimBlock,
  ndis_line_items: NdisLineItemsBlock,
};
