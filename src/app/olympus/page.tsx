/**
 * @page /olympus
 * @status COMPLETE
 * @description Super-admin Olympus index redirect to workspaces
 * @lastAudit 2026-03-22
 */
import { redirect } from "next/navigation";

export default function OlympusIndexPage() {
  redirect("/olympus/workspaces");
}
