/**
 * @page app/dashboard/settings/page.tsx
 * @status STABLE
 * @description Route — dashboard/settings
 * @lastReview 2026-03-28
 */
import { redirect } from "next/navigation";

export default function DashboardSettingsIndexPage() {
  redirect("/settings/preferences");
}
