import { redirect } from "next/navigation";

export default async function ParticipantsFinanceAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  redirect(`/dashboard/care/participants/${p.id}/finance`);
}

