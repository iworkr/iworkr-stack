import { getGlasshouseDailyUpdates, type DailyUpdate } from "@/app/actions/glasshouse";
import { FamilyPortalShell } from "@/components/portal/family-portal-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MessageCircle, Calendar, User } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Project Glasshouse — Daily Updates Feed
   Coordinator-sanitized clinical notes in a warm, social-media
   style feed. Zero jargon, face-first, trust-building.
   ═══════════════════════════════════════════════════════════════════ */

async function getLinkedParticipants(userId: string) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("participant_network_members")
    .select(`
      participant_id,
      participant_profiles!inner(preferred_name, clients!inner(name))
    `)
    .eq("user_id", userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    participant_id: row.participant_id as string,
    participant_name:
      (row.participant_profiles?.preferred_name as string) ||
      (row.participant_profiles?.clients?.name as string) ||
      "Participant",
  }));
}

export default async function PortalUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <p className="text-zinc-400">Please sign in to view updates.</p>
      </main>
    );
  }

  const linked = await getLinkedParticipants(user.id);
  if (linked.length === 0) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <p className="text-zinc-400">No linked participants found.</p>
      </main>
    );
  }

  const activeId = params.participant || linked[0]?.participant_id;
  const result = await getGlasshouseDailyUpdates(activeId);

  if ("error" in result) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <FamilyPortalShell participants={linked} activeParticipantId={activeId} />
        <p className="mt-4 text-zinc-400">{result.error}</p>
      </main>
    );
  }

  const updates = result.updates || [];

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-50">
      <FamilyPortalShell participants={linked} activeParticipantId={activeId} />

      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle size={18} className="text-teal-400" />
          <h1 className="text-lg font-semibold">Daily Updates</h1>
        </div>
        <p className="mb-6 text-sm text-zinc-400">
          Updates from {linked.find((p: { participant_id: string }) => p.participant_id === activeId)?.participant_name || "your participant"}&apos;s care team.
        </p>

        {updates.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <MessageCircle size={32} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-400">No updates yet.</p>
            <p className="mt-1 text-sm text-zinc-600">
              The care team will share updates about visits and activities here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update: DailyUpdate) => {
              const date = new Date(update.published_at);
              const formattedDate = date.toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "short",
              });
              const formattedTime = date.toLocaleTimeString("en-AU", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <article
                  key={update.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 transition hover:border-teal-500/20"
                >
                  {/* Header */}
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/15 text-teal-400">
                      <User size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-zinc-100">{update.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <Calendar size={10} />
                        {formattedDate} at {formattedTime}
                        {update.published_by_name && (
                          <span>· Shared by {update.published_by_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                    {update.sanitized_content}
                  </p>

                  {/* Media */}
                  {update.media_urls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {update.media_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-24 w-24 overflow-hidden rounded-xl border border-zinc-700"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
