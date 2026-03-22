/**
 * @page /dashboard/coordination
 * @status COMPLETE
 * @description Redirect index page routing to coordination ledger
 * @dataSource static
 * @lastAudit 2026-03-22
 */
import { redirect } from "next/navigation";

export default function CoordinationIndexPage() {
  redirect("/dashboard/coordination/ledger");
}
