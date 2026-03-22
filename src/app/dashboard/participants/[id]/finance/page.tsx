/**
 * @page /dashboard/participants/[id]/finance
 * @status COMPLETE
 * @description Alias redirect to /dashboard/care/participants/[id]/finance
 * @dataSource static
 * @lastAudit 2026-03-22
 */
import { redirect } from "next/navigation";

export default async function ParticipantsFinanceAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  redirect(`/dashboard/care/participants/${p.id}/finance`);
}

