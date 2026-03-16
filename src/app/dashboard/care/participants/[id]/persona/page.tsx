"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Brain, Goal, Heart, Shield } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createParticipantBehaviorAction,
  createParticipantGoalAction,
  createParticipantMedicalAlertAction,
  fetchParticipantPersonaDossierAction,
  listParticipantBehaviorsAction,
  listParticipantGoalsAction,
  listParticipantMedicalAlertsAction,
  listProfileUpdateRequestsAction,
  reviewProfileUpdateRequestAction,
  upsertParticipantPreferencesAction,
} from "@/app/actions/participant-persona";

type Dossier = Record<string, any>;

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
      {label}
    </span>
  );
}

export default function ParticipantPersonaPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const participantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [behaviors, setBehaviors] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const [likesInput, setLikesInput] = useState("");
  const [dislikesInput, setDislikesInput] = useState("");
  const [comfortInput, setComfortInput] = useState("");

  async function loadAll() {
    if (!participantId) return;
    setLoading(true);
    try {
      const [d, a, b, g, r] = await Promise.all([
        fetchParticipantPersonaDossierAction(participantId),
        listParticipantMedicalAlertsAction(participantId),
        listParticipantBehaviorsAction(participantId),
        listParticipantGoalsAction(participantId),
        listProfileUpdateRequestsAction(participantId),
      ]);
      if (d.success) {
        setDossier(d.data as Dossier);
        const prefs = (d.data as any)?.preferences || {};
        setLikesInput((prefs.likes || []).join(", "));
        setDislikesInput((prefs.dislikes || []).join(", "));
        setComfortInput(prefs.routines_and_comfort || "");
      }
      setAlerts(a);
      setBehaviors(b);
      setGoals(g);
      setRequests(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  const participant = dossier?.participant;
  const criticalAlerts = useMemo(
    () => (alerts || []).filter((a) => a.severity === "critical" && a.is_active),
    [alerts],
  );

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading persona dossier...</div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6 text-zinc-200">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/dashboard/care/participants/${participantId}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <ArrowLeft size={14} />
            Back to Dossier
          </button>
        </div>

        <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">
                {participant?.preferred_name || participant?.client_name || "Participant"} Persona
              </h1>
              <p className="mt-1 text-sm text-zinc-400">{participant?.profile_summary || "No one-liner set yet."}</p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {criticalAlerts.length} critical alert(s)
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(participant?.dietary_requirements || []).map((d: string) => (
              <Pill key={d} label={d} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="mb-3 flex items-center gap-2 text-rose-300">
              <AlertTriangle size={16} />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Medical Alerts</h2>
            </div>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{a.title}</p>
                    <span className="text-xs text-zinc-400">{a.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{a.description}</p>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!orgId) return;
                const title = window.prompt("Alert title");
                if (!title) return;
                const description = window.prompt("Alert description");
                if (!description) return;
                await createParticipantMedicalAlertAction({
                  organization_id: orgId,
                  participant_id: participantId,
                  title,
                  description,
                  alert_type: "custom",
                  severity: "high",
                  is_active: true,
                });
                await loadAll();
              }}
              className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              Add Alert
            </button>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="mb-3 flex items-center gap-2 text-blue-300">
              <Heart size={16} />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Preferences</h2>
            </div>
            <div className="space-y-3">
              <textarea
                value={likesInput}
                onChange={(e) => setLikesInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200"
                rows={2}
                placeholder="Likes (comma separated)"
              />
              <textarea
                value={dislikesInput}
                onChange={(e) => setDislikesInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200"
                rows={2}
                placeholder="Dislikes (comma separated)"
              />
              <textarea
                value={comfortInput}
                onChange={(e) => setComfortInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200"
                rows={3}
                placeholder="Routines and comfort notes"
              />
              <button
                onClick={async () => {
                  if (!orgId) return;
                  await upsertParticipantPreferencesAction({
                    organization_id: orgId,
                    participant_id: participantId,
                    likes: likesInput.split(",").map((x) => x.trim()).filter(Boolean),
                    dislikes: dislikesInput.split(",").map((x) => x.trim()).filter(Boolean),
                    hobbies: [],
                    routines_and_comfort: comfortInput,
                  });
                  await loadAll();
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                Save Preferences
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <Brain size={16} />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Behavior Matrix</h2>
            </div>
            <div className="space-y-2">
              {behaviors.map((b) => (
                <div key={b.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-medium">{b.behavior_name}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Triggers: {(b.known_triggers || []).join(", ") || "None listed"}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!orgId) return;
                const name = window.prompt("Behavior name");
                if (!name) return;
                await createParticipantBehaviorAction({
                  organization_id: orgId,
                  participant_id: participantId,
                  behavior_name: name,
                  known_triggers: [],
                  early_warning_signs: [],
                  de_escalation_steps: [],
                  requires_restrictive_practice: false,
                  is_active: true,
                });
                await loadAll();
              }}
              className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              Add Behavior
            </button>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
            <div className="mb-3 flex items-center gap-2 text-emerald-300">
              <Goal size={16} />
              <h2 className="text-sm font-semibold uppercase tracking-wide">NDIS Goals</h2>
            </div>
            <div className="space-y-2">
              {goals.map((g) => (
                <div key={g.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-medium">{g.goal_statement}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {g.ndis_goal_category} • {g.status}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!orgId) return;
                const goalStatement = window.prompt("Goal statement");
                if (!goalStatement) return;
                await createParticipantGoalAction({
                  organization_id: orgId,
                  participant_id: participantId,
                  ndis_goal_category: "Daily Living",
                  goal_statement: goalStatement,
                  status: "in_progress",
                  timeframe: "short_term",
                  action_steps: [],
                });
                await loadAll();
              }}
              className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              Add Goal
            </button>
          </section>
        </div>

        <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
          <div className="mb-3 flex items-center gap-2 text-zinc-300">
            <Shield size={16} />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Family Update Requests</h2>
          </div>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{r.section}</span>
                  <span className="text-zinc-400">{r.status}</span>
                </div>
                <pre className="mt-2 overflow-auto text-[11px] text-zinc-400">{JSON.stringify(r.payload, null, 2)}</pre>
                {r.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        await reviewProfileUpdateRequestAction({ request_id: r.id, status: "approved" });
                        await loadAll();
                      }}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        await reviewProfileUpdateRequestAction({ request_id: r.id, status: "rejected" });
                        await loadAll();
                      }}
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

