/**
 * @component components/site-renderer/blocks/PublicSpacer.tsx
 * @status STABLE
 * @description Public Loom site render — PublicSpacer
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { SiteSpacerContent } from "@/components/site-editor/types";

export function PublicSpacer({ block }: PublicBlockProps<"spacer">) {
  const c = block.content as SiteSpacerContent;
  return <div style={{ height: c.height }} aria-hidden="true" />;
}
