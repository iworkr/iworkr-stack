import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const PROJECT_ROOT = process.cwd();
const OUT_JSON = join(PROJECT_ROOT, "audit-reports/golden-thread-post-asserts.json");
const OUT_MD = join(PROJECT_ROOT, "audit-reports/golden-thread-post-asserts.md");
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const IDS = {
  org: "00000000-0000-0000-0000-000000000010",
  admin: "00000000-0000-0000-0000-000000000001",
  clientCare: "00000000-0000-0000-0000-00000000ca01",
  participant: "00000000-0000-0000-0000-00000000aa01",
  careTimesheetA: "00000000-0000-0000-0000-00000000a1a1",
  careTimesheetB: "00000000-0000-0000-0000-00000000b1b1",
  tradeClient: "00000000-0000-0000-0000-00000000cc01",
  tradeJob: "00000000-0000-0000-0000-00000000dd01",
};

async function runCareThread(client, workerA, workerB) {
  await client.query("BEGIN");
  try {
    await client.query(
      `insert into public.clients (id, organization_id, name, status, type)
       values ($1, $2, 'Argus Care Participant', 'active', 'residential')
       on conflict (id) do nothing`,
      [IDS.clientCare, IDS.org]
    );

    await client.query(
      `insert into public.participant_profiles (id, client_id, organization_id, ndis_number)
       values ($1, $2, $3, '4300000000')
       on conflict (id) do nothing`,
      [IDS.participant, IDS.clientCare, IDS.org]
    );

    await client.query(
      `insert into public.service_agreements (organization_id, participant_id, title, total_budget, status)
       values ($1, $2, 'Argus 24/7 Care Plan', 50000, 'active')
       on conflict do nothing`,
      [IDS.org, IDS.participant]
    );

    const baseStart = new Date("2026-03-23T00:00:00Z");
    for (let i = 0; i < 42; i += 1) {
      const start = new Date(baseStart.getTime() + i * 8 * 3600 * 1000);
      const end = new Date(start.getTime() + 8 * 3600 * 1000);
      await client.query(
        `insert into public.schedule_blocks (organization_id, participant_id, technician_id, title, start_time, end_time, status)
         values ($1, $2, $3, $4, $5, $6, 'scheduled')`,
        [IDS.org, IDS.participant, i % 2 === 0 ? workerA : workerB, `Argus Shift ${i + 1}`, start.toISOString(), end.toISOString()]
      );
    }

    const { rows: shiftCountRows } = await client.query(
      `select count(*)::int as c from public.schedule_blocks where participant_id = $1`,
      [IDS.participant]
    );
    const generatedShifts = shiftCountRows[0].c;

    await client.query(
      `insert into public.timesheets (id, organization_id, worker_id, period_start, period_end, status)
       values ($1, $2, $3, current_date - 1, current_date, 'submitted')
       on conflict (id) do update set status = excluded.status`,
      [IDS.careTimesheetA, IDS.org, workerA]
    );
    await client.query(
      `insert into public.timesheets (id, organization_id, worker_id, period_start, period_end, status)
       values ($1, $2, $3, current_date - 1, current_date, 'submitted')
       on conflict (id) do update set status = excluded.status`,
      [IDS.careTimesheetB, IDS.org, workerB]
    );

    await client.query(
      `insert into public.time_entries (organization_id, timesheet_id, shift_id, worker_id, clock_in, clock_out, status, total_hours)
       select $1, $2, id, $3, start_time, end_time, 'completed', 8
       from public.schedule_blocks
       where participant_id = $4
       order by start_time asc
       limit 1`,
      [IDS.org, IDS.careTimesheetA, workerA, IDS.participant]
    );
    await client.query(
      `insert into public.time_entries (organization_id, timesheet_id, shift_id, worker_id, clock_in, clock_out, status, total_hours)
       select $1, $2, id, $3, start_time, end_time, 'completed', 8
       from public.schedule_blocks
       where participant_id = $4
       order by start_time asc
       offset 1 limit 1`,
      [IDS.org, IDS.careTimesheetB, workerB, IDS.participant]
    );

    await client.query(
      `update public.timesheets
       set status = 'approved', approved_at = now(), approved_by = $1
       where id in ($2, $3)`,
      [IDS.admin, IDS.careTimesheetA, IDS.careTimesheetB]
    );

    const { rows: approvedRows } = await client.query(
      `select count(*)::int as c from public.timesheets where id in ($1, $2) and status = 'approved'`,
      [IDS.careTimesheetA, IDS.careTimesheetB]
    );

    await client.query("COMMIT");
    return {
      generatedShifts,
      approvedTimesheets: approvedRows[0].c,
      pass: generatedShifts >= 42 && approvedRows[0].c === 2,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function runTradeThread(client, workerA) {
  await client.query("BEGIN");
  try {
    await client.query(
      `insert into public.clients (id, organization_id, name, status, type)
       values ($1, $2, 'Argus Trade Client', 'active', 'residential')
       on conflict (id) do nothing`,
      [IDS.tradeClient, IDS.org]
    );

    await client.query(
      `insert into public.jobs (id, organization_id, display_id, title, status, client_id, assignee_id)
       values ($1, $2, 'JOB-ARGUS-001', 'Reactive leak response', 'in_progress', $3, $4)
       on conflict (id) do nothing`,
      [IDS.tradeJob, IDS.org, IDS.tradeClient, workerA]
    );

    await client.query(
      `insert into public.invoices (organization_id, display_id, client_id, job_id, status, issue_date, due_date, subtotal, tax, total)
       values ($1, 'INV-ARGUS-001', $2, $3, 'paid', current_date, current_date + 7, 90, 9, 99)`,
      [IDS.org, IDS.tradeClient, IDS.tradeJob]
    );

    await client.query(
      `insert into public.purchase_orders (organization_id, display_id, supplier, supplier_name, status, source_job_id, subtotal, tax, total)
       values ($1, 'PO-ARGUS-001', 'REECE', 'REECE', 'APPROVED', $2, 120, 12, 132)`,
      [IDS.org, IDS.tradeJob]
    );

    const { rows: invoiceRows } = await client.query(
      `select count(*)::int as c from public.invoices where job_id = $1 and total = 99`,
      [IDS.tradeJob]
    );
    const { rows: poRows } = await client.query(
      `select count(*)::int as c from public.purchase_orders where source_job_id = $1`,
      [IDS.tradeJob]
    );

    await client.query("COMMIT");
    return {
      depositInvoices: invoiceRows[0].c,
      purchaseOrders: poRows[0].c,
      pass: invoiceRows[0].c >= 1 && poRows[0].c >= 1,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const { rows: workers } = await client.query(
    `select om.user_id
     from public.organization_members om
     where om.organization_id = $1
       and om.status = 'active'
     order by om.user_id asc
     limit 2`,
    [IDS.org]
  );
  if (workers.length < 2) {
    throw new Error("Need at least two active org members for golden-thread worker simulation.");
  }
  const workerA = workers[0].user_id;
  const workerB = workers[1].user_id;

  const care = await runCareThread(client, workerA, workerB);
  const trade = await runTradeThread(client, workerA);
  await client.end();

  const report = {
    generatedAt: new Date().toISOString(),
    careGoldenThread: care,
    tradeGoldenThread: trade,
    overallPass: care.pass && trade.pass,
  };
  await writeFile(OUT_JSON, JSON.stringify(report, null, 2), "utf8");
  await writeFile(
    OUT_MD,
    [
      "# Golden Thread Post-asserts",
      "",
      `Generated: ${report.generatedAt}`,
      `Overall pass: ${report.overallPass}`,
      "",
      "## Care Thread",
      `- Generated shifts: ${care.generatedShifts}`,
      `- Approved timesheets: ${care.approvedTimesheets}`,
      `- Pass: ${care.pass}`,
      "",
      "## Trade Thread",
      `- Deposit invoices: ${trade.depositInvoices}`,
      `- Purchase orders: ${trade.purchaseOrders}`,
      `- Pass: ${trade.pass}`,
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
