/**
 * @component components/finance/editor/math.ts
 * @status STABLE
 * @description Moneta invoice canvas — math
 * @lastReview 2026-03-28
 */
import type {
  InvoiceBlock,
  GlobalSettings,
  LineItemsContent,
  NdisLineItemsContent,
  ProgressClaimContent,
  EditorLineItem,
} from "./types";

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcLineTotal(qty: number, unitPrice: number): number {
  return r2(qty * unitPrice);
}

export function calcLineTax(lineTotal: number, taxRate: number): number {
  return r2(lineTotal * taxRate);
}

function sumLineItems(
  items: EditorLineItem[],
  globalTaxRate: number,
): { subtotal: number; tax: number } {
  let subtotal = 0;
  let tax = 0;
  for (const item of items) {
    const lt = calcLineTotal(item.quantity, item.unitPrice);
    subtotal += lt;
    const effectiveRate = item.taxOverride ?? globalTaxRate / 100;
    tax += calcLineTax(lt, effectiveRate);
  }
  return { subtotal: r2(subtotal), tax: r2(tax) };
}

function sumNdisItems(
  items: NdisLineItemsContent["items"],
  globalTaxRate: number,
): { subtotal: number; tax: number } {
  let subtotal = 0;
  let tax = 0;
  for (const item of items) {
    const lt = calcLineTotal(item.hours, item.rate);
    subtotal += lt;
    tax += calcLineTax(lt, globalTaxRate / 100);
  }
  return { subtotal: r2(subtotal), tax: r2(tax) };
}

function sumProgressClaim(content: ProgressClaimContent): {
  subtotal: number;
  tax: number;
} {
  const activeMilestones = content.milestones.filter((m) => m.completed);
  const claimable = activeMilestones.reduce(
    (sum, m) => sum + r2(content.contractValue * (m.percentage / 100)),
    0,
  );
  const subtotal = r2(Math.max(0, claimable - content.previouslyClaimed));
  return { subtotal, tax: 0 };
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function calcTotals(
  blocks: InvoiceBlock[],
  settings: GlobalSettings,
): InvoiceTotals {
  let subtotal = 0;
  let rawTax = 0;

  for (const block of blocks) {
    if (block.type === "line_items") {
      const c = block.content as LineItemsContent;
      const s = sumLineItems(c.items, settings.taxRate);
      subtotal += s.subtotal;
      rawTax += s.tax;
    } else if (block.type === "ndis_line_items") {
      const c = block.content as NdisLineItemsContent;
      const s = sumNdisItems(c.items, settings.taxRate);
      subtotal += s.subtotal;
      rawTax += s.tax;
    } else if (block.type === "progress_claim") {
      const c = block.content as ProgressClaimContent;
      const s = sumProgressClaim(c);
      subtotal += s.subtotal;
      rawTax += s.tax;
    }
  }

  subtotal = r2(subtotal);

  let discount = 0;
  if (settings.discountType === "percent") {
    discount = r2(subtotal * (settings.discountValue / 100));
  } else if (settings.discountType === "fixed") {
    discount = r2(settings.discountValue);
  }

  if (settings.taxInclusive) {
    // Prices already include tax — extract tax from the subtotal
    const taxableBase = subtotal - discount;
    const tax = r2(taxableBase - taxableBase / (1 + settings.taxRate / 100));
    const total = r2(subtotal - discount);
    return { subtotal, discount, tax, total };
  }

  // Tax-exclusive: add tax on top
  const tax = r2(rawTax - (discount > 0 ? r2(rawTax * (discount / subtotal || 0)) : 0));
  const total = r2(subtotal - discount + tax);
  return { subtotal, discount, tax, total };
}
