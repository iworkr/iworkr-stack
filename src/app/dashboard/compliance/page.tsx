/**
 * @page /dashboard/compliance
 * @status COMPLETE
 * @description Redirect index page routing to compliance readiness dashboard
 * @dataSource static
 * @lastAudit 2026-03-22
 */
import { redirect } from "next/navigation";

export default function ComplianceIndexPage() {
  redirect("/dashboard/compliance/readiness");
}
