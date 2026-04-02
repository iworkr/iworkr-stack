/**
 * @component components/finance/editor/types.ts
 * @status STABLE
 * @description Moneta invoice canvas — types
 * @lastReview 2026-03-28
 */
import type { WorkspaceBrand } from "@/components/pdf/invoice-types";

export type InvoiceBlockType =
  | "header"
  | "client_details"
  | "meta"
  | "line_items"
  | "totals"
  | "notes"
  | "payment_button"
  | "signature"
  | "text"
  | "spacer"
  | "divider"
  | "progress_claim"
  | "ndis_line_items";

export interface HeaderContent {
  title: string;
  showLogo: boolean;
  showOrgDetails: boolean;
}

export interface ClientDetailsContent {
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  ndisNumber?: string | null;
}

export interface MetaContent {
  displayId: string;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  status: "draft" | "sent" | "paid" | "overdue" | "voided";
  terms: "due_receipt" | "net_7" | "net_14" | "net_30";
}

export interface EditorLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxOverride: number | null;
}

export interface LineItemsContent {
  items: EditorLineItem[];
  showQty: boolean;
  showDiscount: boolean;
  showTax: boolean;
}

export interface TotalsContent {
  showBreakdown: boolean;
}

export interface NotesContent {
  text: string;
}

export interface PaymentButtonContent {
  gateway: "stripe";
  label: string;
  fallbackText: string;
}

export interface SignatureContent {
  label: string;
  required: boolean;
  signatureDataUrl: string | null;
}

export interface TextContent {
  text: string;
  fontSize: number;
}

export interface SpacerContent {
  height: number;
}

export interface DividerContent {
  thickness: number;
  color: string;
}

export interface ProgressClaimMilestone {
  id: string;
  label: string;
  percentage: number;
  completed: boolean;
  invoicedAmount: number;
}

export interface ProgressClaimContent {
  contractValue: number;
  milestones: ProgressClaimMilestone[];
  previouslyClaimed: number;
  jobId: string | null;
}

export interface NdisLineItem {
  id: string;
  supportItemCode: string;
  description: string;
  dateOfSupport: string;
  hours: number;
  rate: number;
  claimType: "standard" | "cancellation" | "travel" | "report_writing";
  priceCap: number | null;
}

export interface NdisLineItemsContent {
  items: NdisLineItem[];
  participantNdisNumber: string;
  planManagedBy: string;
}

export type BlockContentMap = {
  header: HeaderContent;
  client_details: ClientDetailsContent;
  meta: MetaContent;
  line_items: LineItemsContent;
  totals: TotalsContent;
  notes: NotesContent;
  payment_button: PaymentButtonContent;
  signature: SignatureContent;
  text: TextContent;
  spacer: SpacerContent;
  divider: DividerContent;
  progress_claim: ProgressClaimContent;
  ndis_line_items: NdisLineItemsContent;
};

export interface InvoiceBlock<T extends InvoiceBlockType = InvoiceBlockType> {
  id: string;
  type: T;
  content: BlockContentMap[T];
  locked?: boolean;
  deletable?: boolean;
}

export interface GlobalSettings {
  brandColor: string;
  fontFamily: string;
  currency: string;
  taxInclusive: boolean;
  taxRate: number;
  discountType: "percent" | "fixed" | null;
  discountValue: number;
}

export interface BlockRendererProps<T extends InvoiceBlockType = InvoiceBlockType> {
  block: InvoiceBlock<T>;
  isActive: boolean;
  isEditing: boolean;
  settings: GlobalSettings;
  workspace: WorkspaceBrand;
  onContentChange: (content: Partial<BlockContentMap[T]>) => void;
}

export type { WorkspaceBrand };

export const BLOCK_LABELS: Record<InvoiceBlockType, string> = {
  header: "Header",
  client_details: "Client Details",
  meta: "Invoice Meta",
  line_items: "Line Items",
  totals: "Totals",
  notes: "Notes",
  payment_button: "Payment Button",
  signature: "Signature",
  text: "Text Block",
  spacer: "Spacer",
  divider: "Divider",
  progress_claim: "Progress Claim",
  ndis_line_items: "NDIS Line Items",
};

let _blockCounter = 0;
export function makeBlockId(): string {
  return `blk_${Date.now()}_${(++_blockCounter).toString(36)}`;
}
