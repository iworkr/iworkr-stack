/**
 * @page app/settings/[...slug]/page.tsx
 * @status STABLE
 * @description Route — settings/[...slug]
 * @lastReview 2026-03-28
 */
import { redirect } from "next/navigation";

export default async function LegacySettingsBridge({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard/settings/${slug.join("/")}`);
}
