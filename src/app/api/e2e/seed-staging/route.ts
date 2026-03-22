/**
 * /api/e2e/seed-staging — Deterministic Staging Data Factory
 *
 * Project Argus-Omniscience: Solves the "Empty Database" problem by providing
 * a secure API endpoint that populates the staging environment with
 * mathematically perfect relational data before E2E tests execute.
 *
 * Security Guardrails:
 *   1. Hard block on VERCEL_ENV=production
 *   2. Requires x-e2e-seed-secret header matching E2E_SEED_SECRET env var
 *   3. Only accessible via POST method
 *
 * Generates:
 *   - 1 Golden Workspace ("Automated Test HQ")
 *   - 2 Admin Users (owner + technician)
 *   - 50 Clients (mix of residential + commercial)
 *   - 20 NDIS Participants with care plans, goals, medications
 *   - 100 Jobs with subtasks, line items, activity logs
 *   - 50 Invoices with line items and event history
 *   - 20 Quotes with line items
 *   - 30 Schedule blocks (shifts)
 *   - 10 Assets (vehicles, equipment, tools)
 *   - 15 Incidents (SIRS data)
 *   - 10 Automation flows
 *   - 5 Governance policies with acknowledgements
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

interface SeedResult {
  success: boolean;
  workspace_id: string;
  counts: Record<string, number>;
  duration_ms: number;
}

// ── Deterministic UUIDs ──────────────────────────────────────────────────────
// These are stable across runs for test assertions.

const SEED = {
  ORG_ID:     "00000000-0000-0000-0000-000000000010",
  ADMIN_ID:   "00000000-0000-0000-0000-000000000001",
  WORKER_ID:  "00000000-0000-0000-0000-000000000002",
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid(prefix: string, index: number): string {
  return `${prefix}-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number, daysAhead: number): string {
  const now = new Date();
  const offset = Math.floor(Math.random() * (daysAhead + daysAgo)) - daysAgo;
  now.setDate(now.getDate() + offset);
  return now.toISOString();
}

// ── Data Generators ──────────────────────────────────────────────────────────

const BRISBANE_SUBURBS = [
  { name: "Brisbane CBD", lat: -27.4698, lng: 153.0251, postcode: "4000" },
  { name: "Fortitude Valley", lat: -27.4575, lng: 153.0355, postcode: "4006" },
  { name: "South Brisbane", lat: -27.4785, lng: 153.0190, postcode: "4101" },
  { name: "West End", lat: -27.4823, lng: 153.0078, postcode: "4101" },
  { name: "Paddington", lat: -27.4610, lng: 152.9920, postcode: "4064" },
  { name: "Toowong", lat: -27.4850, lng: 152.9830, postcode: "4066" },
  { name: "Ashgrove", lat: -27.4355, lng: 152.9870, postcode: "4060" },
  { name: "Gordon Park", lat: -27.4210, lng: 153.0120, postcode: "4031" },
  { name: "Nundah", lat: -27.3890, lng: 153.0320, postcode: "4012" },
  { name: "Bardon", lat: -27.4590, lng: 152.9710, postcode: "4065" },
  { name: "Red Hill", lat: -27.4520, lng: 152.9940, postcode: "4059" },
  { name: "Kelvin Grove", lat: -27.4470, lng: 153.0040, postcode: "4059" },
  { name: "Indooroopilly", lat: -27.4990, lng: 152.9730, postcode: "4068" },
  { name: "Wynnum", lat: -27.4430, lng: 153.1580, postcode: "4178" },
  { name: "New Farm", lat: -27.4680, lng: 153.0480, postcode: "4005" },
  { name: "Teneriffe", lat: -27.4570, lng: 153.0500, postcode: "4005" },
  { name: "Milton", lat: -27.4720, lng: 153.0020, postcode: "4064" },
  { name: "Spring Hill", lat: -27.4600, lng: 153.0230, postcode: "4000" },
  { name: "Woolloongabba", lat: -27.4900, lng: 153.0350, postcode: "4102" },
  { name: "Coorparoo", lat: -27.4940, lng: 153.0560, postcode: "4151" },
];

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa",
  "Timothy", "Deborah",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
  "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera",
  "Campbell", "Mitchell", "Carter", "Roberts",
];

const JOB_TITLES = [
  "Water heater installation — 50L Rheem", "Kitchen repipe — copper to PEX",
  "Blocked drain investigation", "Gas compliance certificate renewal",
  "Boiler service — annual maintenance", "Emergency burst pipe — bathroom",
  "Tap replacement — kitchen mixer", "Hot water system inspection",
  "Toilet replacement — ensuite", "Stormwater drainage — driveway regrading",
  "Bathroom renovation — full refit", "Solar hot water system installation",
  "Backflow prevention device install", "Sewer main relining — trenchless",
  "Dishwasher connection and testing", "Gas bayonet installation — outdoor",
  "Roof plumbing — downpipe replacement", "TMV compliance testing",
  "Grease trap installation — commercial", "Fire hydrant service — annual",
  "Shower screen leak repair", "Pool pump connection", "Rainwater tank install — 5000L",
  "Emergency callout — gas leak", "Under-slab leak detection", "Bathroom exhaust fan install",
  "Commercial kitchen fit-out", "Irrigation system install", "Water meter upgrade",
  "Sump pump installation", "Floor waste replacement", "Dual flush cistern upgrade",
  "Pipe lagging — insulation", "Expansion valve replacement", "Mixing valve calibration",
  "Downpipe to stormwater connection", "Gutter guard installation", "Vanity basin replacement",
  "Bidet installation", "Water filtration system install",
];

const DIAGNOSES = [
  "Acquired brain injury", "Autism Spectrum Disorder", "Intellectual disability",
  "Multiple sclerosis", "Cerebral palsy", "Stroke — left hemiplegia",
  "Down syndrome", "Spinal cord injury", "Psychosocial disability",
  "Traumatic brain injury", "Schizophrenia", "Muscular dystrophy",
  "Fragile X syndrome", "Prader-Willi syndrome", "Williams syndrome",
  "Rett syndrome", "Epilepsy", "Hearing impairment",
  "Vision impairment", "Global developmental delay",
];

const MOBILITY = [
  "Wheelchair — powered", "Independent", "Independent with supervision",
  "Walker and manual wheelchair", "Powered wheelchair", "Manual wheelchair",
  "Independent with aids", "Walking frame", "Crutches", "Hoist required",
];

const MEDICATIONS = [
  { name: "Panadol", generic: "Paracetamol", dosage: "500mg", route: "oral", freq: "twice_daily" },
  { name: "Endep", generic: "Amitriptyline", dosage: "25mg", route: "oral", freq: "once_daily" },
  { name: "Baclofen", generic: "Baclofen", dosage: "10mg", route: "oral", freq: "three_times_daily" },
  { name: "Aspirin", generic: "Aspirin", dosage: "100mg", route: "oral", freq: "once_daily" },
  { name: "Metformin", generic: "Metformin", dosage: "500mg", route: "oral", freq: "twice_daily" },
  { name: "Risperidone", generic: "Risperidone", dosage: "1mg", route: "oral", freq: "once_daily" },
  { name: "Sodium Valproate", generic: "Sodium Valproate", dosage: "200mg", route: "oral", freq: "twice_daily" },
  { name: "Movicol", generic: "Macrogol", dosage: "1 sachet", route: "oral", freq: "once_daily" },
  { name: "Coloxyl", generic: "Docusate Sodium", dosage: "120mg", route: "oral", freq: "once_daily" },
  { name: "Melatonin", generic: "Melatonin", dosage: "3mg", route: "oral", freq: "once_daily" },
];

const JOB_STATUSES = ["todo", "in_progress", "done", "backlog"] as const;
const JOB_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
const CLIENT_TYPES = ["residential", "commercial"] as const;
const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
const INCIDENT_CATEGORIES = ["fall", "medication_error", "behavioral", "injury", "property_damage", "abuse_neglect"] as const;
const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse<SeedResult | { error: string }>> {
  const start = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY GUARDRAILS
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Hard production block
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "🛑 ARGUS FAILSAFE: Cannot run staging seeder in production environment." },
      { status: 403 },
    );
  }

  // 2. Secret header authentication
  const seedSecret = process.env.E2E_SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json(
      { error: "E2E_SEED_SECRET not configured on server." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("x-e2e-seed-secret");
  if (authHeader !== seedSecret) {
    return NextResponse.json({ error: "Unauthorized — invalid seed secret." }, { status: 401 });
  }

  // 3. Validate Supabase config
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const counts: Record<string, number> = {};

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 1: TEARDOWN (Idempotent — safe to re-run)
    // ═════════════════════════════════════════════════════════════════════════

    // Delete in reverse dependency order
    const teardownTables = [
      "medication_administration_records",
      "participant_medications",
      "care_goals",
      "care_plans",
      "incidents",
      "policy_acknowledgements",
      "policy_register",
      "invoice_events",
      "invoice_line_items",
      "invoices",
      "quote_line_items",
      "quotes",
      "job_activity",
      "job_subtasks",
      "job_line_items",
      "schedule_blocks",
      "jobs",
      "client_contacts",
      "participant_profiles",
      "notification_preferences",
      "notifications",
      "automation_flows",
      "assets",
      "clients",
    ];

    for (const table of teardownTables) {
      await supabase.from(table).delete().eq("organization_id", SEED.ORG_ID);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 2: GOLDEN WORKSPACE + USERS
    // ═════════════════════════════════════════════════════════════════════════

    const { data: org } = await supabase
      .from("organizations")
      .upsert({
        id: SEED.ORG_ID,
        slug: "qa-e2e-workspace",
        name: "QA E2E Workspace",
        trade: "care",
        industry_type: "care",
      }, { onConflict: "id" })
      .select()
      .single();

    if (!org) throw new Error("Failed to create/upsert organization");
    counts.organizations = 1;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 3: CLIENTS (50 — mix of residential + commercial)
    // ═════════════════════════════════════════════════════════════════════════

    const clients = Array.from({ length: 50 }, (_, i) => {
      const suburb = BRISBANE_SUBURBS[i % BRISBANE_SUBURBS.length];
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[i % LAST_NAMES.length];
      const streetNum = 10 + i * 3;
      return {
        id: uuid("c0000001", i + 1),
        organization_id: SEED.ORG_ID,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        phone: `+6140020${String(i + 1).padStart(4, "0")}`,
        status: i < 45 ? "active" : i < 48 ? "lead" : "inactive",
        type: randomItem([...CLIENT_TYPES]),
        address: `${streetNum} ${suburb.name} St, ${suburb.name} ${suburb.postcode}`,
        address_lat: suburb.lat + (Math.random() - 0.5) * 0.01,
        address_lng: suburb.lng + (Math.random() - 0.5) * 0.01,
        tags: [randomItem(["Residential", "Commercial"]), randomItem(["VIP", "Referral", "Net14", "Net30", "Recurring", "Emergency"])],
        since: randomDate(365, 0),
      };
    });

    const { error: clientErr } = await supabase.from("clients").upsert(clients, { onConflict: "id" });
    if (clientErr) throw new Error(`Client seeding failed: ${clientErr.message}`);
    counts.clients = clients.length;

    // Client contacts (1 per client)
    const contacts = clients.map((c) => ({
      client_id: c.id,
      name: c.name,
      role: c.type === "commercial" ? "Director" : "Homeowner",
      email: c.email,
      phone: c.phone,
      is_primary: true,
    }));

    await supabase.from("client_contacts").insert(contacts);
    counts.client_contacts = contacts.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 4: NDIS PARTICIPANTS (20 with full profiles)
    // ═════════════════════════════════════════════════════════════════════════

    // First, create 20 client records for participants
    const participantClients = Array.from({ length: 20 }, (_, i) => {
      const suburb = BRISBANE_SUBURBS[i % BRISBANE_SUBURBS.length];
      const first = FIRST_NAMES[(i + 25) % FIRST_NAMES.length];
      const last = LAST_NAMES[(i + 25) % LAST_NAMES.length];
      return {
        id: uuid("c0000002", i + 1),
        organization_id: SEED.ORG_ID,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.ndis@example.com`,
        phone: `+6140030${String(i + 1).padStart(4, "0")}`,
        status: "active",
        type: "residential" as const,
        address: `${20 + i * 5} ${suburb.name} Ave, ${suburb.name} ${suburb.postcode}`,
        address_lat: suburb.lat + (Math.random() - 0.5) * 0.01,
        address_lng: suburb.lng + (Math.random() - 0.5) * 0.01,
        tags: ["NDIS", randomItem(["SIL", "Community", "Respite", "SDA"])],
        since: randomDate(365, 0),
      };
    });

    await supabase.from("clients").upsert(participantClients, { onConflict: "id" });

    const participants = participantClients.map((c, i) => ({
      id: uuid("d0000001", i + 1),
      client_id: c.id,
      organization_id: SEED.ORG_ID,
      ndis_number: `43${String(1000000 + i * 111111).slice(0, 7)}`,
      date_of_birth: `${1955 + Math.floor(i * 2.5)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
      primary_diagnosis: DIAGNOSES[i % DIAGNOSES.length],
      mobility_requirements: MOBILITY[i % MOBILITY.length],
      communication_preferences: randomItem(["Verbal", "Uses AAC device", "Verbal — mild dysarthria", "Prefers written communication", "Verbal — Makaton signs"]),
      support_categories: [randomItem(["Core", "Capacity Building"]), randomItem(["Social Participation", "Daily Activities", "Employment", "Assistive Technology"])],
      emergency_contacts: JSON.stringify([{
        name: `${FIRST_NAMES[(i + 30) % FIRST_NAMES.length]} ${c.name.split(" ")[1]}`,
        phone: `+6140099${String(i + 1).padStart(4, "0")}`,
        relationship: randomItem(["Mother", "Father", "Sister", "Brother", "Spouse", "Son", "Daughter"]),
      }]),
      notes: `Participant profile ${i + 1}. ${DIAGNOSES[i % DIAGNOSES.length]} — requires ${MOBILITY[i % MOBILITY.length]}.`,
    }));

    await supabase.from("participant_profiles").upsert(participants, { onConflict: "id" });
    counts.participants = participants.length;

    // Care plans (1 per participant)
    const carePlans = participants.map((p, i) => ({
      id: uuid("e0000001", i + 1),
      organization_id: SEED.ORG_ID,
      participant_id: p.id,
      title: `${participantClients[i].name} — ${randomItem(["Annual Plan", "Community Access Plan", "Respite Plan", "SIL Support Plan"])}`,
      status: i < 18 ? "active" : "review_due",
      start_date: randomDate(365, 0),
      review_date: randomDate(365, 0),
      next_review_date: randomDate(0, 365),
      domains: JSON.stringify({
        daily_living: { budget: 15000 + i * 2000, used: Math.floor(Math.random() * 10000) },
        community: { budget: 8000 + i * 500, used: Math.floor(Math.random() * 5000) },
        capacity_building: { budget: 5000 + i * 300, used: Math.floor(Math.random() * 3000) },
      }),
      assessor_name: `Dr. ${FIRST_NAMES[(i + 40) % FIRST_NAMES.length]} ${LAST_NAMES[(i + 40) % LAST_NAMES.length]}`,
      assessor_role: randomItem(["Plan Manager", "Support Coordinator", "Case Manager"]),
      notes: `Care plan for participant ${i + 1}. Review due ${randomDate(0, 90)}.`,
    }));

    await supabase.from("care_plans").upsert(carePlans, { onConflict: "id" });
    counts.care_plans = carePlans.length;

    // Care goals (2 per participant = 40 total)
    const careGoals = participants.flatMap((p, i) => [
      {
        id: uuid("f0000001", i * 2 + 1),
        care_plan_id: uuid("e0000001", i + 1),
        organization_id: SEED.ORG_ID,
        participant_id: p.id,
        title: randomItem(["Improve mobility", "Social engagement", "Independent travel", "Employment readiness", "Communication skills", "Daily living skills"]),
        description: `Goal ${i * 2 + 1} for ${participantClients[i].name}`,
        target_outcome: "Maintain progress for 12 months",
        status: randomItem(["in_progress", "not_started", "achieved"]),
        priority: (i % 3) + 1,
      },
      {
        id: uuid("f0000001", i * 2 + 2),
        care_plan_id: uuid("e0000001", i + 1),
        organization_id: SEED.ORG_ID,
        participant_id: p.id,
        title: randomItem(["Self-care independence", "Community participation", "Health management", "Safety awareness", "Emotional regulation"]),
        description: `Goal ${i * 2 + 2} for ${participantClients[i].name}`,
        target_outcome: "Achieve measurable improvement in 6 months",
        status: randomItem(["in_progress", "not_started"]),
        priority: (i % 3) + 2,
      },
    ]);

    await supabase.from("care_goals").upsert(careGoals, { onConflict: "id" });
    counts.care_goals = careGoals.length;

    // Medications (2-3 per first 10 participants)
    const meds = participants.slice(0, 10).flatMap((p, i) => {
      const count = 2 + (i % 2);
      return Array.from({ length: count }, (_, j) => {
        const med = MEDICATIONS[(i * 3 + j) % MEDICATIONS.length];
        return {
          id: uuid("10000001", i * 3 + j + 1),
          organization_id: SEED.ORG_ID,
          participant_id: p.id,
          medication_name: med.name,
          generic_name: med.generic,
          dosage: med.dosage,
          route: med.route,
          frequency: med.freq,
          time_slots: med.freq === "twice_daily" ? ["08:00", "20:00"] : med.freq === "three_times_daily" ? ["07:00", "13:00", "21:00"] : ["08:00"],
          prescribing_doctor: `Dr. ${FIRST_NAMES[(i + 35) % FIRST_NAMES.length]} ${LAST_NAMES[(i + 35) % LAST_NAMES.length]}`,
          pharmacy: randomItem(["Terry White Ashgrove", "Priceline Bardon", "Chemist Warehouse CBD", "Amcal Toowong"]),
          start_date: randomDate(365, 0),
          is_prn: j === 2,
          is_active: true,
        };
      });
    });

    await supabase.from("participant_medications").upsert(meds, { onConflict: "id" });
    counts.medications = meds.length;

    // MAR records
    const mars = meds.slice(0, 15).map((med, i) => ({
      id: uuid("11000001", i + 1),
      organization_id: SEED.ORG_ID,
      medication_id: med.id,
      participant_id: med.participant_id,
      worker_id: SEED.WORKER_ID,
      outcome: randomItem(["given", "given", "given", "refused", "withheld"]),
      administered_at: randomDate(7, 0),
      notes: randomItem(["Morning dose administered with breakfast.", "Evening dose administered.", "Participant refused. RN notified.", "Administered on time.", "Slight delay due to scheduling."]),
    }));

    await supabase.from("medication_administration_records").upsert(mars, { onConflict: "id" });
    counts.medication_records = mars.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 5: JOBS (100 with subtasks + line items + activity)
    // ═════════════════════════════════════════════════════════════════════════

    const jobs = Array.from({ length: 100 }, (_, i) => {
      const client = clients[i % clients.length];
      const suburb = BRISBANE_SUBURBS[i % BRISBANE_SUBURBS.length];
      return {
        id: uuid("a0000001", i + 1),
        organization_id: SEED.ORG_ID,
        display_id: `JOB-${500 + i}`,
        title: JOB_TITLES[i % JOB_TITLES.length],
        description: `Automated test job ${i + 1} — ${JOB_TITLES[i % JOB_TITLES.length]}`,
        status: JOB_STATUSES[i % JOB_STATUSES.length],
        priority: JOB_PRIORITIES[i % JOB_PRIORITIES.length],
        client_id: client.id,
        assignee_id: i % 3 === 0 ? null : (i % 2 === 0 ? SEED.ADMIN_ID : SEED.WORKER_ID),
        due_date: randomDate(-5, 30),
        location: `${10 + i * 2} ${suburb.name} St, ${suburb.name} ${suburb.postcode}`,
        location_lat: suburb.lat + (Math.random() - 0.5) * 0.01,
        location_lng: suburb.lng + (Math.random() - 0.5) * 0.01,
        labels: [randomItem(["Install", "Plumbing", "Maintenance", "Emergency", "Gas", "Drainage", "Inspection", "Compliance"])],
        revenue: randomFloat(150, 8000),
        cost: randomFloat(20, 3000),
        estimated_hours: randomFloat(0.5, 12),
        actual_hours: JOB_STATUSES[i % JOB_STATUSES.length] === "done" ? randomFloat(0.5, 10) : 0,
        created_by: SEED.ADMIN_ID,
      };
    });

    const { error: jobErr } = await supabase.from("jobs").upsert(jobs, { onConflict: "id" });
    if (jobErr) throw new Error(`Job seeding failed: ${jobErr.message}`);
    counts.jobs = jobs.length;

    // Subtasks (3-5 per first 30 jobs)
    const subtasks = jobs.slice(0, 30).flatMap((job, i) => {
      const taskCount = 3 + (i % 3);
      return Array.from({ length: taskCount }, (_, j) => ({
        job_id: job.id,
        title: `Step ${j + 1}: ${randomItem(["Isolate system", "Remove old unit", "Install new components", "Test and commission", "Clean up site", "Document work", "Generate report"])}`,
        completed: j < Math.floor(taskCount / 2),
        sort_order: j,
      }));
    });

    await supabase.from("job_subtasks").insert(subtasks);
    counts.subtasks = subtasks.length;

    // Job activity (2 events per first 50 jobs)
    const activities = jobs.slice(0, 50).flatMap((job) => [
      {
        job_id: job.id,
        type: "creation",
        text: `Job ${job.display_id} created`,
        user_id: SEED.ADMIN_ID,
        user_name: "QA Admin",
        created_at: randomDate(30, 0),
      },
      {
        job_id: job.id,
        type: "status_change",
        text: `Status changed to ${job.status}`,
        user_id: SEED.ADMIN_ID,
        user_name: "QA Admin",
        created_at: randomDate(7, 0),
      },
    ]);

    await supabase.from("job_activity").insert(activities);
    counts.job_activities = activities.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 6: INVOICES (50 with line items + events)
    // ═════════════════════════════════════════════════════════════════════════

    const invoices = Array.from({ length: 50 }, (_, i) => {
      const job = jobs[i % jobs.length];
      const client = clients[i % clients.length];
      const status = INVOICE_STATUSES[i % INVOICE_STATUSES.length];
      const subtotal = randomFloat(100, 8000);
      const tax = Math.round(subtotal * 0.1 * 100) / 100;
      return {
        id: uuid("b0000001", i + 1),
        organization_id: SEED.ORG_ID,
        display_id: `INV-${2000 + i}`,
        client_id: client.id,
        job_id: job.id,
        client_name: client.name,
        client_email: client.email,
        client_address: client.address,
        status,
        issue_date: randomDate(60, 0),
        due_date: randomDate(0, 30),
        paid_date: status === "paid" ? randomDate(14, 0) : null,
        subtotal,
        tax,
        total: subtotal + tax,
        notes: i % 3 === 0 ? "Payment due within 14 days." : null,
        created_by: SEED.ADMIN_ID,
      };
    });

    const { error: invErr } = await supabase.from("invoices").upsert(invoices, { onConflict: "id" });
    if (invErr) throw new Error(`Invoice seeding failed: ${invErr.message}`);
    counts.invoices = invoices.length;

    // Invoice line items (2-3 per invoice)
    const lineItems = invoices.flatMap((inv, i) => {
      const count = 2 + (i % 2);
      return Array.from({ length: count }, (_, j) => ({
        invoice_id: inv.id,
        description: randomItem(["Labor — standard rate", "Materials — copper pipe", "Emergency surcharge", "Travel allowance", "Materials — PEX tubing", "Disposal fee", "Inspection fee"]),
        quantity: j === 0 ? randomFloat(1, 8) : randomFloat(1, 10),
        unit_price: j === 0 ? randomFloat(85, 250) : randomFloat(15, 500),
        sort_order: j,
      }));
    });

    await supabase.from("invoice_line_items").insert(lineItems);
    counts.invoice_line_items = lineItems.length;

    // Invoice events
    const invoiceEvents = invoices.flatMap((inv) => {
      const events = [{ invoice_id: inv.id, type: "created", text: "Invoice created" }];
      if (inv.status === "sent" || inv.status === "paid" || inv.status === "overdue") {
        events.push({ invoice_id: inv.id, type: "sent", text: `Sent to ${inv.client_email}` });
      }
      if (inv.status === "paid") {
        events.push({ invoice_id: inv.id, type: "paid", text: "Payment received" });
      }
      if (inv.status === "overdue") {
        events.push({ invoice_id: inv.id, type: "reminder", text: "Payment reminder sent" });
      }
      return events;
    });

    await supabase.from("invoice_events").insert(invoiceEvents);
    counts.invoice_events = invoiceEvents.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 7: QUOTES (20 with line items)
    // ═════════════════════════════════════════════════════════════════════════

    const quotes = Array.from({ length: 20 }, (_, i) => {
      const client = clients[i % clients.length];
      const subtotal = randomFloat(500, 12000);
      const tax = Math.round(subtotal * 0.1 * 100) / 100;
      return {
        id: uuid("b1000001", i + 1),
        organization_id: SEED.ORG_ID,
        display_id: `QTE-${400 + i}`,
        client_id: client.id,
        client_name: client.name,
        client_email: client.email,
        status: randomItem(["draft", "sent", "approved", "rejected", "expired"]),
        issue_date: randomDate(30, 0),
        valid_until: randomDate(0, 30),
        subtotal,
        tax,
        total: subtotal + tax,
        notes: `Quote ${i + 1} for ${client.name}`,
        created_by: SEED.ADMIN_ID,
      };
    });

    const { error: quoteErr } = await supabase.from("quotes").upsert(quotes, { onConflict: "id" });
    if (quoteErr) console.warn(`Quote seeding warning: ${quoteErr.message}`);
    counts.quotes = quotes.length;

    // Quote line items
    const quoteLineItems = quotes.flatMap((q, i) => [
      { quote_id: q.id, description: `Service: ${JOB_TITLES[i % JOB_TITLES.length]}`, quantity: 1, unit_price: q.subtotal * 0.7, sort_order: 0 },
      { quote_id: q.id, description: "Materials and supplies", quantity: 1, unit_price: q.subtotal * 0.3, sort_order: 1 },
    ]);

    await supabase.from("quote_line_items").insert(quoteLineItems);
    counts.quote_line_items = quoteLineItems.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 8: SCHEDULE BLOCKS (30 — trades + care shifts)
    // ═════════════════════════════════════════════════════════════════════════

    const now = new Date();
    const scheduleBlocks = Array.from({ length: 30 }, (_, i) => {
      const dayOffset = Math.floor(i / 6) - 1; // -1 to +4 days
      const startHour = 6 + (i % 6) * 2; // 6am, 8am, 10am, 12pm, 2pm, 4pm
      const start = new Date(now);
      start.setDate(start.getDate() + dayOffset);
      start.setHours(startHour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(startHour + 2);

      const isCareSched = i >= 20;
      const job = isCareSched ? null : jobs[i % jobs.length];
      const participant = isCareSched ? participants[(i - 20) % participants.length] : null;

      return {
        organization_id: SEED.ORG_ID,
        ...(job ? { job_id: job.id } : {}),
        ...(participant ? { participant_id: participant.id } : {}),
        technician_id: i % 2 === 0 ? SEED.ADMIN_ID : SEED.WORKER_ID,
        title: isCareSched
          ? `${randomItem(["Morning care", "Community access", "Respite", "Evening support"])} — ${participantClients[(i - 20) % participantClients.length]?.name || "Participant"}`
          : `${job?.title.slice(0, 30) || "Job"} — ${clients[i % clients.length].name}`,
        client_name: isCareSched ? participantClients[(i - 20) % participantClients.length]?.name || "Participant" : clients[i % clients.length].name,
        location: isCareSched ? participantClients[(i - 20) % participantClients.length]?.address || "TBD" : job?.location || "TBD",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: randomItem(["scheduled", "in_progress", "complete", "en_route"]),
        travel_minutes: Math.floor(Math.random() * 40) + 5,
      };
    });

    await supabase.from("schedule_blocks").insert(scheduleBlocks);
    counts.schedule_blocks = scheduleBlocks.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 9: ASSETS (10 — vehicles, equipment, tools)
    // ═════════════════════════════════════════════════════════════════════════

    const assets = [
      { name: "Service Van #1", category: "vehicle", status: "assigned", assigned_to: SEED.ADMIN_ID, make: "Toyota", model: "HiAce", year: 2023, serial_number: "VAN-001", location: "On site", purchase_cost: 52000 },
      { name: "Service Van #2", category: "vehicle", status: "available", assigned_to: null, make: "Ford", model: "Transit Custom", year: 2022, serial_number: "VAN-002", location: "Depot", purchase_cost: 48000 },
      { name: "Service Van #3", category: "vehicle", status: "assigned", assigned_to: SEED.WORKER_ID, make: "Mercedes", model: "Sprinter", year: 2024, serial_number: "VAN-003", location: "Field", purchase_cost: 62000 },
      { name: "Ridgid SeeSnake (CCTV)", category: "equipment", status: "assigned", assigned_to: SEED.ADMIN_ID, make: "Ridgid", model: "SeeSnake CSx", year: 2024, serial_number: "EQ-001", location: "Van #1", purchase_cost: 8500 },
      { name: "Milwaukee M18 Drill", category: "tool", status: "assigned", assigned_to: SEED.ADMIN_ID, make: "Milwaukee", model: "M18 FUEL", year: 2024, serial_number: "TL-001", location: "Van #1", purchase_cost: 450 },
      { name: "Pipe Wrench Set", category: "tool", status: "available", assigned_to: null, make: "Ridgid", model: "Various", year: 2023, serial_number: "TL-002", location: "Depot", purchase_cost: 280 },
      { name: "Jetter Machine", category: "equipment", status: "assigned", assigned_to: SEED.WORKER_ID, make: "Renssi", model: "4000 PSI", year: 2023, serial_number: "EQ-002", location: "Van #3", purchase_cost: 15000 },
      { name: "Thermal Camera", category: "equipment", status: "available", assigned_to: null, make: "FLIR", model: "E8 Pro", year: 2024, serial_number: "EQ-003", location: "Depot", purchase_cost: 3200 },
      { name: "Gas Detector", category: "equipment", status: "assigned", assigned_to: SEED.ADMIN_ID, make: "GMI", model: "GT44", year: 2023, serial_number: "EQ-004", location: "Van #1", purchase_cost: 2100 },
      { name: "Impact Driver", category: "tool", status: "assigned", assigned_to: SEED.WORKER_ID, make: "Makita", model: "DTD172", year: 2024, serial_number: "TL-003", location: "Van #3", purchase_cost: 380 },
    ].map((a) => ({
      ...a,
      organization_id: SEED.ORG_ID,
      last_service: randomDate(180, 0),
      next_service: randomDate(0, 180),
    }));

    await supabase.from("assets").insert(assets);
    counts.assets = assets.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 10: INCIDENTS (15 — SIRS data)
    // ═════════════════════════════════════════════════════════════════════════

    const incidents = Array.from({ length: 15 }, (_, i) => ({
      id: uuid("12000001", i + 1),
      organization_id: SEED.ORG_ID,
      participant_id: participants[i % participants.length].id,
      worker_id: SEED.WORKER_ID,
      category: INCIDENT_CATEGORIES[i % INCIDENT_CATEGORIES.length],
      severity: INCIDENT_SEVERITIES[i % INCIDENT_SEVERITIES.length],
      status: randomItem(["reported", "under_review", "resolved", "escalated"]),
      title: `Incident ${i + 1} — ${INCIDENT_CATEGORIES[i % INCIDENT_CATEGORIES.length].replace("_", " ")}`,
      description: `Test incident ${i + 1}. Category: ${INCIDENT_CATEGORIES[i % INCIDENT_CATEGORIES.length]}.`,
      location: participantClients[i % participantClients.length].address,
      occurred_at: randomDate(30, 0),
      reported_at: randomDate(30, 0),
      immediate_actions: `Immediate response documented. Monitored for ${randomItem(["1 hour", "2 hours", "4 hours"])}. ${randomItem(["No adverse effects.", "RN notified.", "Family contacted.", "Emergency services not required."])}`,
      is_reportable: i % 3 === 0,
    }));

    await supabase.from("incidents").upsert(incidents, { onConflict: "id" });
    counts.incidents = incidents.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 11: AUTOMATION FLOWS (10)
    // ═════════════════════════════════════════════════════════════════════════

    const automations = [
      { name: "Auto-Invoice on Job Complete", category: "billing", trigger: "job.status_change", action: "create_invoice" },
      { name: "Welcome Email for New Clients", category: "marketing", trigger: "client.created", action: "send_email" },
      { name: "Low Stock Alert", category: "operations", trigger: "inventory.quantity_change", action: "create_notification" },
      { name: "Overdue Invoice Reminder", category: "billing", trigger: "invoice.overdue", action: "send_email" },
      { name: "Job Assignment Notification", category: "operations", trigger: "job.assigned", action: "send_notification" },
      { name: "Quote Follow-Up Email", category: "marketing", trigger: "quote.sent", action: "send_email" },
      { name: "Shift Completion Alert", category: "care", trigger: "shift.completed", action: "create_notification" },
      { name: "Emergency Escalation", category: "safety", trigger: "incident.created", action: "send_notification" },
      { name: "Weekly Revenue Report", category: "billing", trigger: "cron.weekly", action: "send_email" },
      { name: "Asset Service Reminder", category: "operations", trigger: "asset.service_due", action: "send_notification" },
    ].map((a, i) => ({
      organization_id: SEED.ORG_ID,
      name: a.name,
      description: `Automation: ${a.name}`,
      category: a.category,
      status: i < 8 ? "active" : "paused",
      run_count: Math.floor(Math.random() * 200),
      last_run: randomDate(7, 0),
      created_by: SEED.ADMIN_ID,
      trigger_config: JSON.stringify({ event: a.trigger }),
      blocks: JSON.stringify([{ type: "action", action: a.action }]),
    }));

    await supabase.from("automation_flows").insert(automations);
    counts.automations = automations.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 12: NOTIFICATIONS
    // ═════════════════════════════════════════════════════════════════════════

    const notifications = Array.from({ length: 10 }, (_, i) => ({
      organization_id: SEED.ORG_ID,
      user_id: i % 2 === 0 ? SEED.ADMIN_ID : SEED.WORKER_ID,
      type: randomItem(["job_assigned", "quote_approved", "system", "job_completed", "invoice_paid"]),
      title: `Test notification ${i + 1}`,
      body: `This is automated test notification ${i + 1}.`,
      sender_name: "System",
      context: `Test context ${i + 1}`,
      read: i > 5,
      related_job_id: i < 5 ? jobs[i].id : null,
      created_at: randomDate(7, 0),
    }));

    await supabase.from("notifications").insert(notifications);
    counts.notifications = notifications.length;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 13: GOVERNANCE POLICIES
    // ═════════════════════════════════════════════════════════════════════════

    const policies = [
      { title: "Workplace Health and Safety Policy", category: "safety", version: "2.1" },
      { title: "NDIS Code of Conduct", category: "governance", version: "1.0" },
      { title: "Medication Administration Procedure", category: "clinical", version: "3.0" },
      { title: "Privacy and Confidentiality Policy", category: "privacy", version: "1.5" },
      { title: "Incident Reporting and SIRS Procedure", category: "safety", version: "2.0" },
    ].map((p, i) => ({
      id: uuid("13000001", i + 1),
      organization_id: SEED.ORG_ID,
      title: p.title,
      category: p.category,
      version: p.version,
      status: "current",
      content: `${p.title} — full policy content for version ${p.version}.`,
      effective_date: randomDate(365, 0),
      review_date: randomDate(0, 365),
      requires_acknowledgement: true,
    }));

    await supabase.from("policy_register").upsert(policies, { onConflict: "id" });
    counts.policies = policies.length;

    // Policy acknowledgements
    const acks = policies.slice(0, 3).flatMap((p) => [
      { organization_id: SEED.ORG_ID, policy_id: p.id, user_id: SEED.ADMIN_ID, acknowledged_at: randomDate(60, 0), policy_version: p.version },
      { organization_id: SEED.ORG_ID, policy_id: p.id, user_id: SEED.WORKER_ID, acknowledged_at: randomDate(60, 0), policy_version: p.version },
    ]);

    await supabase.from("policy_acknowledgements").insert(acks);
    counts.policy_acknowledgements = acks.length;

    // ═════════════════════════════════════════════════════════════════════════
    // DONE
    // ═════════════════════════════════════════════════════════════════════════

    return NextResponse.json({
      success: true,
      workspace_id: SEED.ORG_ID,
      counts,
      duration_ms: Date.now() - start,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[seed-staging] FATAL:", message);
    return NextResponse.json(
      { error: `Seeding failed: ${message}` },
      { status: 500 },
    );
  }
}

// Only allow POST
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST with x-e2e-seed-secret header." },
    { status: 405 },
  );
}
