/**
 * Shared types for the isomorphic invoice PDF template.
 * Used by both the web <PDFViewer> and the server-side generation.
 */

export interface InvoiceLineItemData {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate_percent: number | null;
  sort_order: number;
}

export interface InvoiceData {
  display_id: string;
  status: "draft" | "sent" | "paid" | "overdue" | "voided";
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  line_items: InvoiceLineItemData[];
  subtotal: number;
  tax_rate: number;
  tax: number;
  discount_type: "percent" | "fixed" | null;
  discount_value: number;
  discount_total: number;
  total: number;
  notes: string | null;
  payment_link: string | null;
}

export interface WorkspaceBrand {
  name: string;
  logo_url: string | null;
  brand_color_hex: string;
  tax_id: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * All monetary calculations use rounding at every step
 * to prevent IEEE 754 floating-point drift.
 */
export function calcLineTotal(qty: number, unitPrice: number): number {
  return Math.round(qty * unitPrice * 100) / 100;
}

export function calcLineTax(lineTotal: number, taxRate: number): number {
  return Math.round(lineTotal * taxRate * 100) / 100;
}

export function calcInvoiceTotals(
  lineItems: InvoiceLineItemData[],
  workspaceTaxRate: number,
  discountType: "percent" | "fixed" | null,
  discountValue: number,
) {
  let subtotal = 0;
  let taxTotal = 0;

  for (const item of lineItems) {
    const lineTotal = calcLineTotal(item.quantity, item.unit_price);
    subtotal += lineTotal;
    const effectiveTaxRate = item.tax_rate_percent ?? workspaceTaxRate / 100;
    taxTotal += calcLineTax(lineTotal, effectiveTaxRate);
  }

  subtotal = Math.round(subtotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;

  let discountTotal = 0;
  if (discountType === "percent") {
    discountTotal = Math.round(subtotal * (discountValue / 100) * 100) / 100;
  } else if (discountType === "fixed") {
    discountTotal = Math.round(discountValue * 100) / 100;
  }

  const total = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

  return { subtotal, taxTotal, discountTotal, total };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
