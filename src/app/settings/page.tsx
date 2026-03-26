/**
 * @page /settings
 * @status COMPLETE
 * @description Settings index redirect to preferences page
 * @lastAudit 2026-03-22
 */
import { redirect } from "next/navigation";

export default function SettingsIndex() {
  redirect("/dashboard/settings/preferences");
}
