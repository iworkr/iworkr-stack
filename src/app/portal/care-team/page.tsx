import { getPortalCareTeam, getPortalDocuments } from "@/app/actions/portal-family";
import { FamilyPortalShell } from "@/components/portal/family-portal-shell";
import { PortalSignDocumentButton } from "@/components/portal/portal-sign-document-button";

function fmtDate(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PortalCareTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string }>;
}) {
  const params = await searchParams;
  const [team, docs] = await Promise.all([
    getPortalCareTeam(params.participant),
    getPortalDocuments(params.participant),
  ]);

  if ("error" in team) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <h1 className="text-2xl font-semibold">Care Team</h1>
        <p className="mt-4 text-zinc-400">{team.error}</p>
      </main>
    );
  }

  const documents = "documents" in docs ? docs.documents : [];
  const messages = team.messages as Array<{ id: string; content: string; created_at: string }>;
  const familyNotes = team.family_notes as Array<{ id: string; narrative: string; created_at: string }>;
  const observations = team.observations as Array<{
    id: string;
    observation_type: string;
    value_numeric?: number | null;
    value_text?: string | null;
    value_systolic?: number | null;
    value_diastolic?: number | null;
    unit?: string | null;
    observed_at: string;
  }>;
  const docList = documents as Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    requires_signature: boolean;
  }>;

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-50">
      <FamilyPortalShell
        participants={team.linked_participants}
        activeParticipantId={team.active_participant_id}
      />
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 md:grid-cols-12">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:col-span-6">
          <h2 className="text-lg font-semibold">External Family Thread</h2>
          <div className="mt-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500">No messages have been posted yet.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-sm text-zinc-200">{msg.content}</p>
                <p className="mt-1 text-xs text-zinc-500">{fmtDate(msg.created_at)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:col-span-6">
          <h2 className="text-lg font-semibold">Family Shift Notes</h2>
          <div className="mt-3 space-y-2">
            {familyNotes.length === 0 && (
              <p className="text-sm text-zinc-500">No published family notes yet.</p>
            )}
            {familyNotes.map((note) => (
              <div key={note.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-sm text-zinc-200">{note.narrative}</p>
                <p className="mt-1 text-xs text-zinc-500">{fmtDate(note.created_at)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:col-span-6">
          <h2 className="text-lg font-semibold">Health Observations</h2>
          <div className="mt-3 space-y-2">
            {observations.length === 0 && (
              <p className="text-sm text-zinc-500">
                Observation sharing is disabled or no observations have been recorded.
              </p>
            )}
            {observations.map((o) => (
              <div key={o.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-sm font-semibold text-zinc-100">{String(o.observation_type).replace(/_/g, " ")}</p>
                <p className="text-sm text-zinc-300">
                  {o.value_systolic && o.value_diastolic
                    ? `${o.value_systolic}/${o.value_diastolic} ${o.unit || ""}`
                    : o.value_numeric != null
                      ? `${o.value_numeric} ${o.unit || ""}`
                      : o.value_text || "Recorded"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{fmtDate(o.observed_at)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:col-span-6">
          <h2 className="text-lg font-semibold">Document Vault</h2>
          <div className="mt-3 space-y-2">
            {docList.length === 0 && (
              <p className="text-sm text-zinc-500">No published documents are available.</p>
            )}
            {docList.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-sm font-semibold text-zinc-100">{doc.title}</p>
                <p className="text-xs text-zinc-500">{fmtDate(doc.created_at)}</p>
                <p className="mt-1 text-xs text-zinc-400">Status: {doc.status}</p>
                <div className="mt-2 flex items-center gap-2">
                  {doc.requires_signature && doc.status !== "signed" && (
                    <PortalSignDocumentButton documentId={doc.id} />
                  )}
                  {doc.status === "signed" && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                      Signed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
