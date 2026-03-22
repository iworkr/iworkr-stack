/**
 * @page /dashboard/fleet
 * @status COMPLETE
 * @description Fleet index redirect to /dashboard/fleet/overview
 * @dataSource static
 * @lastAudit 2026-03-22
 */
import { redirect } from "next/navigation";

export default function FleetIndexPage() {
  redirect("/dashboard/fleet/overview");
}
