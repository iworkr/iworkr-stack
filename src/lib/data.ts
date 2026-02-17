/* ── Mock data for iWorkr modules ───────────────────── */

export type Priority = "urgent" | "high" | "medium" | "low" | "none";
export type JobStatus = "backlog" | "todo" | "in_progress" | "done" | "cancelled";
export type InboxItemType = "job_assigned" | "quote_approved" | "mention" | "system" | "review";

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ActivityEntry {
  id: string;
  type: "status_change" | "comment" | "photo" | "invoice" | "creation" | "assignment";
  text: string;
  user: string;
  time: string;
  photos?: string[];
}

export interface Job {
  id: string;
  title: string;
  priority: Priority;
  status: JobStatus;
  assignee: string;
  assigneeInitials: string;
  client: string;
  due: string;
  labels: string[];
  created: string;
  /* Extended fields for detail view */
  location?: string;
  locationCoords?: { lat: number; lng: number };
  description?: string;
  subtasks?: SubTask[];
  activity?: ActivityEntry[];
  revenue?: number;
  cost?: number;
  estimatedHours?: number;
  actualHours?: number;
}

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  jobRef?: string;
  sender: string;
  senderInitials: string;
  context?: string;
  snoozedUntil?: string | null;
  archived?: boolean;
}

export type ClientStatus = "active" | "lead" | "churned" | "inactive";

export interface ClientContact {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
}

export interface ClientActivity {
  id: string;
  type: "job_completed" | "invoice_paid" | "invoice_sent" | "quote_sent" | "note" | "job_created" | "call";
  text: string;
  amount?: string;
  jobRef?: string;
  time: string;
}

export interface SpendDataPoint {
  month: string;
  amount: number;
  label?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  totalJobs: number;
  lifetimeValue: string;
  lifetimeValueNum: number;
  lastJob: string;
  status: ClientStatus;
  /* Extended fields for dossier */
  type?: "residential" | "commercial";
  address?: string;
  addressCoords?: { lat: number; lng: number };
  tags?: string[];
  contacts?: ClientContact[];
  spendHistory?: SpendDataPoint[];
  activity?: ClientActivity[];
  notes?: string;
  since?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  status: "online" | "away" | "offline";
}

/* ── Jobs ──────────────────────────────────────────── */

export const jobs: Job[] = [
  {
    id: "JOB-401", title: "Water heater installation — 50L Rheem", priority: "high", status: "in_progress",
    assignee: "Mike Thompson", assigneeInitials: "MT", client: "David Park", due: "Today", labels: ["Install"], created: "2d ago",
    location: "42 Creek Rd, Brisbane CBD", locationCoords: { lat: -27.4698, lng: 153.0251 },
    description: "Install new 50L Rheem Stellar hot water system to replace existing unit. Customer requested same-day completion. Existing unit is electric — converting to gas. Requires new gas line from meter.",
    subtasks: [
      { id: "st1", title: "Isolate existing water heater", completed: true },
      { id: "st2", title: "Remove old unit and dispose", completed: true },
      { id: "st3", title: "Run new gas line from meter box", completed: false },
      { id: "st4", title: "Install 50L Rheem Stellar", completed: false },
      { id: "st5", title: "Test pressure and temperature", completed: false },
      { id: "st6", title: "Complete compliance certificate", completed: false },
    ],
    activity: [
      { id: "a1", type: "status_change", text: "changed status to In Progress", user: "Mike Thompson", time: "2h ago" },
      { id: "a2", type: "photo", text: "uploaded 2 photos of existing unit", user: "Mike Thompson", time: "3h ago", photos: ["before-1.jpg", "before-2.jpg"] },
      { id: "a3", type: "comment", text: "Customer confirmed gas conversion is approved by body corporate", user: "Sarah Chen", time: "5h ago" },
      { id: "a4", type: "assignment", text: "assigned this job to Mike Thompson", user: "System", time: "1d ago" },
      { id: "a5", type: "creation", text: "created this job from Quote #398", user: "System", time: "2d ago" },
    ],
    revenue: 2850, cost: 1420, estimatedHours: 6, actualHours: 3.5,
  },
  {
    id: "JOB-402", title: "Kitchen repipe — copper to PEX conversion", priority: "urgent", status: "todo",
    assignee: "Sarah Chen", assigneeInitials: "SC", client: "Sarah Mitchell", due: "Today", labels: ["Plumbing", "Urgent"], created: "1d ago",
    location: "54 High St, Fortitude Valley", locationCoords: { lat: -27.4575, lng: 153.0355 },
    description: "Full kitchen repipe from copper to PEX. Multiple leak points detected in existing copper work. Customer experiencing low pressure and discoloured water. Approved quote for full replacement.",
    subtasks: [
      { id: "st1", title: "Turn off mains water supply", completed: false },
      { id: "st2", title: "Remove existing copper pipework", completed: false },
      { id: "st3", title: "Install PEX manifold system", completed: false },
      { id: "st4", title: "Connect all fixtures", completed: false },
      { id: "st5", title: "Pressure test system at 1500kPa", completed: false },
    ],
    activity: [
      { id: "a1", type: "comment", text: "Quote approved by customer — $4,850 incl. GST", user: "Sarah Chen", time: "15m ago" },
      { id: "a2", type: "creation", text: "created this job", user: "System", time: "1d ago" },
    ],
    revenue: 4850, cost: 1890, estimatedHours: 8, actualHours: 0,
  },
  {
    id: "JOB-403", title: "Blocked drain investigation — ground floor", priority: "medium", status: "in_progress",
    assignee: "Mike Thompson", assigneeInitials: "MT", client: "Lisa Chen", due: "Tomorrow", labels: ["Drainage"], created: "3d ago",
    location: "18 Stanley St, South Brisbane", locationCoords: { lat: -27.4785, lng: 153.0190 },
    description: "Investigate and clear blockage in ground floor main drain. Customer reports slow drainage in kitchen and bathroom. CCTV inspection may be required if jet blasting does not resolve.",
    subtasks: [
      { id: "st1", title: "Locate drain access points", completed: true },
      { id: "st2", title: "Attempt jet blast clearing", completed: true },
      { id: "st3", title: "CCTV inspection if required", completed: false },
      { id: "st4", title: "Report findings to customer", completed: false },
    ],
    activity: [
      { id: "a1", type: "status_change", text: "changed status to In Progress", user: "Mike Thompson", time: "1d ago" },
      { id: "a2", type: "comment", text: "Jet blast partially cleared — need CCTV to check for root intrusion", user: "Mike Thompson", time: "1d ago" },
      { id: "a3", type: "creation", text: "created this job from inbound call", user: "System", time: "3d ago" },
    ],
    revenue: 680, cost: 120, estimatedHours: 3, actualHours: 1.5,
  },
  {
    id: "JOB-404", title: "Gas compliance certificate renewal", priority: "high", status: "todo",
    assignee: "James O'Brien", assigneeInitials: "JO", client: "Tom Andrews", due: "Feb 18", labels: ["Gas", "Compliance"], created: "5d ago",
    location: "7 Albert St, Brisbane CBD", locationCoords: { lat: -27.4710, lng: 153.0260 },
    description: "Annual gas compliance inspection and certificate renewal for commercial property. 4 gas appliances to inspect including commercial cooktop, 2x water heaters, and space heater.",
    subtasks: [
      { id: "st1", title: "Inspect gas line integrity", completed: false },
      { id: "st2", title: "Test each appliance for leaks", completed: false },
      { id: "st3", title: "Check ventilation requirements", completed: false },
      { id: "st4", title: "Issue compliance certificate", completed: false },
    ],
    activity: [
      { id: "a1", type: "creation", text: "created from recurring schedule", user: "System", time: "5d ago" },
    ],
    revenue: 450, cost: 60, estimatedHours: 2, actualHours: 0,
  },
  {
    id: "JOB-405", title: "Boiler service — annual maintenance", priority: "medium", status: "backlog",
    assignee: "Sarah Chen", assigneeInitials: "SC", client: "Rachel Kim", due: "Feb 20", labels: ["Maintenance"], created: "1w ago",
    location: "33 Grey St, South Bank", locationCoords: { lat: -27.4795, lng: 153.0210 },
    description: "Annual boiler service and maintenance. Check heat exchanger, descale if necessary, test safety valves and thermostat calibration.",
    subtasks: [
      { id: "st1", title: "Visual inspection of boiler", completed: false },
      { id: "st2", title: "Clean and descale heat exchanger", completed: false },
      { id: "st3", title: "Test safety relief valve", completed: false },
      { id: "st4", title: "Calibrate thermostat", completed: false },
    ],
    activity: [
      { id: "a1", type: "creation", text: "created from recurring schedule", user: "System", time: "1w ago" },
    ],
    revenue: 380, cost: 45, estimatedHours: 1.5, actualHours: 0,
  },
  {
    id: "JOB-406", title: "Emergency burst pipe — bathroom", priority: "urgent", status: "in_progress",
    assignee: "Mike Thompson", assigneeInitials: "MT", client: "John Harris", due: "Today", labels: ["Emergency", "Plumbing"], created: "2h ago",
    location: "12 Edward St, Brisbane CBD", locationCoords: { lat: -27.4688, lng: 153.0240 },
    description: "Emergency call — burst pipe in bathroom wall. Water is actively leaking. Customer has isolated mains. Need to locate burst, repair, and test before re-opening mains.",
    subtasks: [
      { id: "st1", title: "Locate burst section", completed: true },
      { id: "st2", title: "Cut out damaged pipe", completed: false },
      { id: "st3", title: "Install repair coupling", completed: false },
      { id: "st4", title: "Pressure test repair", completed: false },
      { id: "st5", title: "Patch wall access point", completed: false },
    ],
    activity: [
      { id: "a1", type: "status_change", text: "changed status to In Progress", user: "Mike Thompson", time: "30m ago" },
      { id: "a2", type: "photo", text: "uploaded photo of burst location", user: "Mike Thompson", time: "45m ago", photos: ["burst-1.jpg"] },
      { id: "a3", type: "assignment", text: "auto-assigned to nearest available tech", user: "System", time: "2h ago" },
      { id: "a4", type: "creation", text: "created from emergency call", user: "System", time: "2h ago" },
    ],
    revenue: 1200, cost: 280, estimatedHours: 3, actualHours: 1,
  },
  {
    id: "JOB-407", title: "Tap replacement — kitchen mixer", priority: "low", status: "todo",
    assignee: "James O'Brien", assigneeInitials: "JO", client: "Emma Wilson", due: "Feb 22", labels: ["Install"], created: "3d ago",
    location: "88 Wickham St, Fortitude Valley", locationCoords: { lat: -27.4560, lng: 153.0380 },
    description: "Replace existing kitchen mixer tap with customer-supplied Methven Aio tap. Standard installation — no modifications to pipework expected.",
    subtasks: [
      { id: "st1", title: "Remove existing mixer tap", completed: false },
      { id: "st2", title: "Install new Methven Aio", completed: false },
      { id: "st3", title: "Test hot and cold supply", completed: false },
    ],
    activity: [
      { id: "a1", type: "creation", text: "created this job", user: "James O'Brien", time: "3d ago" },
    ],
    revenue: 220, cost: 30, estimatedHours: 1, actualHours: 0,
  },
  {
    id: "JOB-408", title: "Hot water system inspection", priority: "medium", status: "done",
    assignee: "Mike Thompson", assigneeInitials: "MT", client: "David Park", due: "Feb 14", labels: ["Inspection"], created: "1w ago",
    location: "42 Creek Rd, Brisbane CBD", locationCoords: { lat: -27.4698, lng: 153.0251 },
    description: "Pre-purchase plumbing inspection for hot water system. Report on condition, remaining lifespan, and any immediate concerns.",
    subtasks: [
      { id: "st1", title: "Inspect anode rod condition", completed: true },
      { id: "st2", title: "Check valve operation", completed: true },
      { id: "st3", title: "Test temperature output", completed: true },
      { id: "st4", title: "Generate inspection report", completed: true },
    ],
    activity: [
      { id: "a1", type: "status_change", text: "marked as Done", user: "Mike Thompson", time: "1d ago" },
      { id: "a2", type: "comment", text: "Report sent to customer — unit has ~2 years remaining life", user: "Mike Thompson", time: "1d ago" },
      { id: "a3", type: "invoice", text: "Invoice #INV-398 sent — $180", user: "System", time: "1d ago" },
      { id: "a4", type: "creation", text: "created this job", user: "David Park", time: "1w ago" },
    ],
    revenue: 180, cost: 0, estimatedHours: 1, actualHours: 0.75,
  },
  {
    id: "JOB-409", title: "Toilet replacement — ensuite", priority: "low", status: "backlog",
    assignee: "Unassigned", assigneeInitials: "??", client: "Lisa Chen", due: "Feb 25", labels: ["Install"], created: "4d ago",
    location: "18 Stanley St, South Brisbane", locationCoords: { lat: -27.4785, lng: 153.0190 },
    description: "Remove existing toilet and install customer-supplied Caroma Luna. Includes new flexi connector and cistern fitting.",
    subtasks: [
      { id: "st1", title: "Remove existing toilet", completed: false },
      { id: "st2", title: "Install Caroma Luna", completed: false },
      { id: "st3", title: "Connect water supply", completed: false },
      { id: "st4", title: "Test flush and seal", completed: false },
    ],
    activity: [
      { id: "a1", type: "creation", text: "created this job from customer request", user: "System", time: "4d ago" },
    ],
    revenue: 350, cost: 40, estimatedHours: 1.5, actualHours: 0,
  },
  {
    id: "JOB-410", title: "Stormwater drainage — driveway regrading", priority: "high", status: "todo",
    assignee: "Sarah Chen", assigneeInitials: "SC", client: "Tom Andrews", due: "Feb 19", labels: ["Drainage", "Outdoor"], created: "2d ago",
    location: "7 Albert St, Brisbane CBD", locationCoords: { lat: -27.4710, lng: 153.0260 },
    description: "Regrade stormwater drainage at driveway entrance. Water pooling causing damage to concrete. Install new grated channel drain and connect to existing stormwater system.",
    subtasks: [
      { id: "st1", title: "Survey existing drainage layout", completed: false },
      { id: "st2", title: "Excavate channel for new drain", completed: false },
      { id: "st3", title: "Install grated channel drain", completed: false },
      { id: "st4", title: "Connect to stormwater", completed: false },
      { id: "st5", title: "Backfill and compact", completed: false },
    ],
    activity: [
      { id: "a1", type: "comment", text: "Site visit completed — confirmed scope of work", user: "Sarah Chen", time: "1d ago" },
      { id: "a2", type: "creation", text: "created this job", user: "Tom Andrews", time: "2d ago" },
    ],
    revenue: 3200, cost: 1100, estimatedHours: 8, actualHours: 0,
  },
];

/* ── Inbox ─────────────────────────────────────────── */

export const inboxItems: InboxItem[] = [
  { id: "n1", type: "job_assigned", sender: "Sarah Chen", senderInitials: "SC", title: "New job assigned to you", body: "JOB-406: Emergency burst pipe — bathroom has been assigned to Mike Thompson.", context: "Job #406 — Emergency Burst Pipe", time: "2m ago", read: false, jobRef: "JOB-406" },
  { id: "n2", type: "quote_approved", sender: "Sarah Mitchell", senderInitials: "SM", title: "Quote #402 approved", body: "Sarah Mitchell approved your quote for kitchen repipe ($4,850). Job created automatically.", context: "Quote #402 — Kitchen Repipe", time: "15m ago", read: false, jobRef: "JOB-402" },
  { id: "n3", type: "mention", sender: "Sarah Chen", senderInitials: "SC", title: "Sarah Chen mentioned you", body: "@Mike can you check the valve pressure on the Park job before the install tomorrow?", context: "Job #401 — Water Heater Install", time: "1h ago", read: false, jobRef: "JOB-401" },
  { id: "n4", type: "system", sender: "System", senderInitials: "iW", title: "Schedule conflict detected", body: "Mike Thompson has overlapping jobs at 2:00 PM on Feb 18. Review the schedule to resolve.", context: "Schedule — Feb 18", time: "2h ago", read: true },
  { id: "n5", type: "review", sender: "David Park", senderInitials: "DP", title: "New 5-star review", body: "David Park left a 5-star review: 'Excellent work on the water heater. Very professional.'", context: "Job #399 — Water Heater", time: "3h ago", read: true },
  { id: "n6", type: "system", sender: "System", senderInitials: "iW", title: "Part delivery confirmed", body: "Copper pipe 22mm x 3m (qty: 8) has been delivered to warehouse. Ready for pickup.", context: "Inventory — Copper Pipe 22mm", time: "5h ago", read: true },
  { id: "n7", type: "mention", sender: "James O'Brien", senderInitials: "JO", title: "James tagged you in a photo", body: "James uploaded 3 photos to the Creek Rd bathroom reno. \"Rough-in complete, ready for inspection.\"", context: "Job #405 — Bathroom Renovation", time: "6h ago", read: true, jobRef: "JOB-405" },
  { id: "n8", type: "job_assigned", sender: "Tom Liu", senderInitials: "TL", title: "Job reassigned to your team", body: "Hot water system replacement at 12 Boundary St has been moved to your team. Client wants morning slot.", context: "Job #407 — HWS Replacement", time: "8h ago", read: true, jobRef: "JOB-407" },
];

/* ── Clients ───────────────────────────────────────── */

export const clients: Client[] = [
  {
    id: "c1", name: "David Park", email: "david@parkresidence.com", phone: "+61 400 123 456", initials: "DP",
    totalJobs: 23, lifetimeValue: "$12,400", lifetimeValueNum: 12400, lastJob: "2 days ago", status: "active",
    type: "residential", address: "42 Creek Rd, Brisbane CBD 4000", addressCoords: { lat: -27.4698, lng: 153.0251 },
    tags: ["VIP", "Residential", "Net14"],
    since: "Jan 2024",
    contacts: [
      { id: "cc1", name: "David Park", initials: "DP", role: "Owner", email: "david@parkresidence.com", phone: "+61 400 123 456" },
      { id: "cc2", name: "Jenny Park", initials: "JP", role: "Co-owner", email: "jenny@parkresidence.com", phone: "+61 400 123 457" },
    ],
    spendHistory: [
      { month: "Mar", amount: 800 }, { month: "Apr", amount: 1200 }, { month: "May", amount: 600 },
      { month: "Jun", amount: 2100, label: "Boiler Install" }, { month: "Jul", amount: 400 },
      { month: "Aug", amount: 900 }, { month: "Sep", amount: 4200, label: "Hot Water System" },
      { month: "Oct", amount: 300 }, { month: "Nov", amount: 650 }, { month: "Dec", amount: 200 },
      { month: "Jan", amount: 1800 }, { month: "Feb", amount: 180 },
    ],
    activity: [
      { id: "ca1", type: "job_completed", text: "Hot water system inspection completed", jobRef: "JOB-408", time: "2 days ago" },
      { id: "ca2", type: "invoice_paid", text: "Invoice #INV-398 paid", amount: "$180", time: "2 days ago" },
      { id: "ca3", type: "job_created", text: "Water heater installation scheduled", jobRef: "JOB-401", time: "3 days ago" },
      { id: "ca4", type: "note", text: "Customer prefers morning appointments. Has two dogs — call before arriving.", time: "1 week ago" },
      { id: "ca5", type: "invoice_paid", text: "Invoice #INV-385 paid", amount: "$2,850", time: "2 weeks ago" },
      { id: "ca6", type: "call", text: "Called to discuss water heater replacement options", time: "3 weeks ago" },
    ],
  },
  {
    id: "c2", name: "Sarah Mitchell", email: "sarah.m@outlook.com", phone: "+61 400 234 567", initials: "SM",
    totalJobs: 15, lifetimeValue: "$8,200", lifetimeValueNum: 8200, lastJob: "Today", status: "active",
    type: "residential", address: "54 High St, Fortitude Valley 4006", addressCoords: { lat: -27.4575, lng: 153.0355 },
    tags: ["Residential", "Referral"],
    since: "Jun 2024",
    contacts: [
      { id: "cc3", name: "Sarah Mitchell", initials: "SM", role: "Homeowner", email: "sarah.m@outlook.com", phone: "+61 400 234 567" },
    ],
    spendHistory: [
      { month: "Mar", amount: 0 }, { month: "Apr", amount: 450 }, { month: "May", amount: 1200 },
      { month: "Jun", amount: 800 }, { month: "Jul", amount: 0 }, { month: "Aug", amount: 2400 },
      { month: "Sep", amount: 600 }, { month: "Oct", amount: 350 }, { month: "Nov", amount: 0 },
      { month: "Dec", amount: 800 }, { month: "Jan", amount: 1600 }, { month: "Feb", amount: 0 },
    ],
    activity: [
      { id: "ca7", type: "quote_sent", text: "Quote #Q-402 sent for kitchen repipe — $4,850", time: "Today" },
      { id: "ca8", type: "job_created", text: "Kitchen repipe job created", jobRef: "JOB-402", time: "Today" },
      { id: "ca9", type: "invoice_paid", text: "Invoice #INV-390 paid", amount: "$1,600", time: "1 week ago" },
    ],
  },
  {
    id: "c3", name: "Lisa Chen", email: "lisa.chen@gmail.com", phone: "+61 400 345 678", initials: "LC",
    totalJobs: 11, lifetimeValue: "$6,800", lifetimeValueNum: 6800, lastJob: "3 days ago", status: "active",
    type: "residential", address: "18 Stanley St, South Brisbane 4101", addressCoords: { lat: -27.4785, lng: 153.0190 },
    tags: ["Residential", "Recurring"],
    since: "Sep 2024",
    contacts: [
      { id: "cc4", name: "Lisa Chen", initials: "LC", role: "Owner", email: "lisa.chen@gmail.com", phone: "+61 400 345 678" },
      { id: "cc5", name: "Wei Chen", initials: "WC", role: "Tenant Contact", email: "wei.chen@gmail.com", phone: "+61 400 345 679" },
    ],
    spendHistory: [
      { month: "Mar", amount: 400 }, { month: "Apr", amount: 0 }, { month: "May", amount: 800 },
      { month: "Jun", amount: 1500 }, { month: "Jul", amount: 200 }, { month: "Aug", amount: 600 },
      { month: "Sep", amount: 1100 }, { month: "Oct", amount: 0 }, { month: "Nov", amount: 900 },
      { month: "Dec", amount: 400 }, { month: "Jan", amount: 580 }, { month: "Feb", amount: 350 },
    ],
    activity: [
      { id: "ca10", type: "job_completed", text: "Blocked drain investigation underway", jobRef: "JOB-403", time: "3 days ago" },
      { id: "ca11", type: "invoice_sent", text: "Invoice #INV-395 sent", amount: "$680", time: "3 days ago" },
    ],
  },
  {
    id: "c4", name: "Tom Andrews", email: "tom@andrewsprops.com.au", phone: "+61 400 456 789", initials: "TA",
    totalJobs: 9, lifetimeValue: "$5,100", lifetimeValueNum: 5100, lastJob: "5 days ago", status: "active",
    type: "commercial", address: "7 Albert St, Brisbane CBD 4000", addressCoords: { lat: -27.4710, lng: 153.0260 },
    tags: ["Commercial", "Net30", "Multi-property"],
    since: "Mar 2024",
    contacts: [
      { id: "cc6", name: "Tom Andrews", initials: "TA", role: "Director", email: "tom@andrewsprops.com.au", phone: "+61 400 456 789" },
      { id: "cc7", name: "Michelle Wong", initials: "MW", role: "Property Manager", email: "michelle@andrewsprops.com.au", phone: "+61 400 456 790" },
      { id: "cc8", name: "Site Office", initials: "SO", role: "Site Contact", email: "office@andrewsprops.com.au", phone: "+61 7 3456 7890" },
    ],
    spendHistory: [
      { month: "Mar", amount: 600 }, { month: "Apr", amount: 800 }, { month: "May", amount: 0 },
      { month: "Jun", amount: 450 }, { month: "Jul", amount: 1200 }, { month: "Aug", amount: 0 },
      { month: "Sep", amount: 700 }, { month: "Oct", amount: 350 }, { month: "Nov", amount: 0 },
      { month: "Dec", amount: 500 }, { month: "Jan", amount: 300 }, { month: "Feb", amount: 200 },
    ],
    activity: [
      { id: "ca12", type: "job_created", text: "Gas compliance cert renewal scheduled", jobRef: "JOB-404", time: "5 days ago" },
      { id: "ca13", type: "job_created", text: "Stormwater drainage job created", jobRef: "JOB-410", time: "2 days ago" },
    ],
  },
  {
    id: "c5", name: "Rachel Kim", email: "rachel.kim@email.com", phone: "+61 400 567 890", initials: "RK",
    totalJobs: 4, lifetimeValue: "$2,400", lifetimeValueNum: 2400, lastJob: "1 week ago", status: "active",
    type: "residential", address: "33 Grey St, South Bank 4101", addressCoords: { lat: -27.4795, lng: 153.0210 },
    tags: ["Residential"],
    since: "Nov 2025",
    contacts: [
      { id: "cc9", name: "Rachel Kim", initials: "RK", role: "Homeowner", email: "rachel.kim@email.com", phone: "+61 400 567 890" },
    ],
    spendHistory: [
      { month: "Mar", amount: 0 }, { month: "Apr", amount: 0 }, { month: "May", amount: 0 },
      { month: "Jun", amount: 0 }, { month: "Jul", amount: 0 }, { month: "Aug", amount: 0 },
      { month: "Sep", amount: 0 }, { month: "Oct", amount: 0 }, { month: "Nov", amount: 800 },
      { month: "Dec", amount: 1200 }, { month: "Jan", amount: 400 }, { month: "Feb", amount: 0 },
    ],
    activity: [
      { id: "ca14", type: "job_created", text: "Boiler service scheduled", jobRef: "JOB-405", time: "1 week ago" },
    ],
  },
  {
    id: "c6", name: "John Harris", email: "j.harris@bigpond.com", phone: "+61 400 678 901", initials: "JH",
    totalJobs: 7, lifetimeValue: "$4,200", lifetimeValueNum: 4200, lastJob: "Today", status: "active",
    type: "residential", address: "12 Edward St, Brisbane CBD 4000", addressCoords: { lat: -27.4688, lng: 153.0240 },
    tags: ["Residential", "Emergency"],
    since: "Aug 2024",
    contacts: [
      { id: "cc10", name: "John Harris", initials: "JH", role: "Owner", email: "j.harris@bigpond.com", phone: "+61 400 678 901" },
    ],
    spendHistory: [
      { month: "Mar", amount: 0 }, { month: "Apr", amount: 600 }, { month: "May", amount: 0 },
      { month: "Jun", amount: 800 }, { month: "Jul", amount: 400 }, { month: "Aug", amount: 1200 },
      { month: "Sep", amount: 0 }, { month: "Oct", amount: 500 }, { month: "Nov", amount: 0 },
      { month: "Dec", amount: 0 }, { month: "Jan", amount: 700 }, { month: "Feb", amount: 0 },
    ],
    activity: [
      { id: "ca15", type: "job_created", text: "Emergency burst pipe — bathroom", jobRef: "JOB-406", time: "Today" },
      { id: "ca16", type: "call", text: "Emergency call received — burst pipe", time: "Today" },
    ],
  },
  {
    id: "c7", name: "Emma Wilson", email: "emma.w@icloud.com", phone: "+61 400 789 012", initials: "EW",
    totalJobs: 2, lifetimeValue: "$890", lifetimeValueNum: 890, lastJob: "3 days ago", status: "inactive",
    type: "residential", address: "88 Wickham St, Fortitude Valley 4006", addressCoords: { lat: -27.4560, lng: 153.0380 },
    tags: ["Residential"],
    since: "Jan 2026",
    contacts: [
      { id: "cc11", name: "Emma Wilson", initials: "EW", role: "Tenant", email: "emma.w@icloud.com", phone: "+61 400 789 012" },
    ],
    spendHistory: [
      { month: "Mar", amount: 0 }, { month: "Apr", amount: 0 }, { month: "May", amount: 0 },
      { month: "Jun", amount: 0 }, { month: "Jul", amount: 0 }, { month: "Aug", amount: 0 },
      { month: "Sep", amount: 0 }, { month: "Oct", amount: 0 }, { month: "Nov", amount: 0 },
      { month: "Dec", amount: 0 }, { month: "Jan", amount: 670 }, { month: "Feb", amount: 220 },
    ],
    activity: [
      { id: "ca17", type: "job_created", text: "Tap replacement scheduled", jobRef: "JOB-407", time: "3 days ago" },
    ],
  },
];

/* ── Schedule ─────────────────────────────────────── */

export type ScheduleBlockStatus = "scheduled" | "en_route" | "in_progress" | "complete";

export interface ScheduleBlock {
  id: string;
  jobId: string;
  technicianId: string;
  title: string;
  client: string;
  location: string;
  startHour: number;  // decimal hours from midnight, e.g. 9.5 = 9:30 AM
  duration: number;   // in hours, e.g. 1.5 = 1h 30m
  status: ScheduleBlockStatus;
  travelTime?: number; // in minutes, shows as ghost block before this block
  conflict?: boolean;
}

export interface Technician {
  id: string;
  name: string;
  initials: string;
  skill: "plumber" | "electrician" | "general";
  status: "online" | "away" | "offline";
  hoursBooked: number;
  hoursAvailable: number;
  avatar?: string;
}

export const technicians: Technician[] = [
  { id: "tech-1", name: "Mike Thompson", initials: "MT", skill: "plumber", status: "online", hoursBooked: 6.5, hoursAvailable: 8 },
  { id: "tech-2", name: "Sarah Chen", initials: "SC", skill: "plumber", status: "online", hoursBooked: 5, hoursAvailable: 8 },
  { id: "tech-3", name: "James O'Brien", initials: "JO", skill: "electrician", status: "away", hoursBooked: 4.5, hoursAvailable: 8 },
  { id: "tech-4", name: "Tom Liu", initials: "TL", skill: "general", status: "offline", hoursBooked: 4, hoursAvailable: 8 },
];

export const scheduleBlocks: ScheduleBlock[] = [
  // Mike Thompson
  { id: "sb-1", jobId: "JOB-401", technicianId: "tech-1", title: "Water heater install", client: "David Park", location: "42 Creek Rd", startHour: 7, duration: 2, status: "complete", travelTime: 15 },
  { id: "sb-2", jobId: "JOB-403", technicianId: "tech-1", title: "Blocked drain investigation", client: "Lisa Chen", location: "18 Stanley St", startHour: 9.5, duration: 1.5, status: "in_progress", travelTime: 20 },
  { id: "sb-3", jobId: "JOB-406", technicianId: "tech-1", title: "Emergency burst pipe", client: "John Harris", location: "12 Edward St", startHour: 12, duration: 2, status: "en_route", travelTime: 25 },
  { id: "sb-4", jobId: "JOB-408", technicianId: "tech-1", title: "Hot water inspection", client: "David Park", location: "42 Creek Rd", startHour: 15, duration: 1, status: "scheduled", travelTime: 15 },

  // Sarah Chen
  { id: "sb-5", jobId: "JOB-402", technicianId: "tech-2", title: "Kitchen repipe — PEX", client: "Sarah Mitchell", location: "54 High St", startHour: 7.5, duration: 3, status: "scheduled", travelTime: 10 },
  { id: "sb-6", jobId: "JOB-405", technicianId: "tech-2", title: "Boiler service", client: "Rachel Kim", location: "33 Grey St", startHour: 11, duration: 1.5, status: "scheduled", travelTime: 20 },
  { id: "sb-7", jobId: "JOB-410", technicianId: "tech-2", title: "Stormwater drainage", client: "Tom Andrews", location: "7 Albert St", startHour: 13.5, duration: 3, status: "scheduled", travelTime: 15 },

  // James O'Brien
  { id: "sb-8", jobId: "JOB-404", technicianId: "tech-3", title: "Gas compliance cert", client: "Tom Andrews", location: "7 Albert St", startHour: 8, duration: 2, status: "in_progress", travelTime: 10 },
  { id: "sb-9", jobId: "JOB-407", technicianId: "tech-3", title: "Tap replacement", client: "Emma Wilson", location: "88 Wickham St", startHour: 11, duration: 1, status: "scheduled", travelTime: 25 },
  { id: "sb-10", jobId: "JOB-408", technicianId: "tech-3", title: "Pipe inspection", client: "David Park", location: "42 Creek Rd", startHour: 14, duration: 1.5, status: "scheduled", travelTime: 20, conflict: true },

  // Tom Liu
  { id: "sb-11", jobId: "JOB-409", technicianId: "tech-4", title: "Toilet replacement", client: "Lisa Chen", location: "18 Stanley St", startHour: 9, duration: 2, status: "scheduled", travelTime: 10 },
  { id: "sb-12", jobId: "JOB-406", technicianId: "tech-4", title: "Pipe repair backup", client: "John Harris", location: "12 Edward St", startHour: 13, duration: 2, status: "scheduled", travelTime: 30 },
];

/* ── Finance ─────────────────────────────────────────── */

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "voided";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceEvent {
  id: string;
  type: "created" | "sent" | "viewed" | "paid" | "voided" | "reminder";
  text: string;
  time: string;
}

export interface Invoice {
  id: string;
  dbId?: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentLink?: string;
  events: InvoiceEvent[];
  notes?: string;
}

export interface Payout {
  id: string;
  amount: number;
  date: string;
  bank: string;
  invoiceIds: string[];
  status: "completed" | "pending" | "processing";
}

export interface DailyRevenue {
  date: string;
  amount: number;
  invoiceCount: number;
}

export const invoices: Invoice[] = [
  {
    id: "INV-1250", clientId: "c2", clientName: "Sarah Mitchell", clientEmail: "sarah.m@outlook.com",
    clientAddress: "54 High St, Fortitude Valley 4006",
    status: "sent", issueDate: "Feb 15, 2026", dueDate: "Mar 1, 2026",
    lineItems: [
      { id: "li1", description: "Kitchen repipe — copper to PEX", quantity: 1, unitPrice: 3800 },
      { id: "li2", description: "Materials — PEX tubing 50m", quantity: 1, unitPrice: 650 },
      { id: "li3", description: "Disposal & waste removal", quantity: 1, unitPrice: 400 },
    ],
    subtotal: 4850, tax: 485, total: 5335,
    paymentLink: "https://pay.iworkr.app/inv-1250",
    events: [
      { id: "ev1", type: "created", text: "Invoice created", time: "Feb 15, 10:00 AM" },
      { id: "ev2", type: "sent", text: "Sent to sarah.m@outlook.com", time: "Feb 15, 10:05 AM" },
      { id: "ev3", type: "viewed", text: "Opened by recipient", time: "Feb 15, 11:22 AM" },
    ],
    notes: "Payment due within 14 days. Quote #Q-402.",
  },
  {
    id: "INV-1249", clientId: "c6", clientName: "John Harris", clientEmail: "j.harris@bigpond.com",
    clientAddress: "12 Edward St, Brisbane CBD 4000",
    status: "paid", issueDate: "Feb 14, 2026", dueDate: "Feb 28, 2026", paidDate: "Feb 14, 2026",
    lineItems: [
      { id: "li4", description: "Emergency burst pipe repair — bathroom", quantity: 1, unitPrice: 950 },
      { id: "li5", description: "Materials — copper fittings", quantity: 1, unitPrice: 180 },
      { id: "li6", description: "Emergency call-out surcharge", quantity: 1, unitPrice: 110 },
    ],
    subtotal: 1240, tax: 124, total: 1364,
    paymentLink: "https://pay.iworkr.app/inv-1249",
    events: [
      { id: "ev4", type: "created", text: "Invoice created", time: "Feb 14, 4:00 PM" },
      { id: "ev5", type: "sent", text: "Sent to j.harris@bigpond.com", time: "Feb 14, 4:05 PM" },
      { id: "ev6", type: "viewed", text: "Opened by recipient", time: "Feb 14, 4:12 PM" },
      { id: "ev7", type: "paid", text: "Payment received via Stripe", time: "Feb 14, 4:30 PM" },
    ],
  },
  {
    id: "INV-1248", clientId: "c1", clientName: "David Park", clientEmail: "david@parkresidence.com",
    clientAddress: "42 Creek Rd, Brisbane CBD 4000",
    status: "paid", issueDate: "Feb 13, 2026", dueDate: "Feb 27, 2026", paidDate: "Feb 13, 2026",
    lineItems: [
      { id: "li7", description: "Hot water system inspection", quantity: 1, unitPrice: 180 },
    ],
    subtotal: 180, tax: 18, total: 198,
    events: [
      { id: "ev8", type: "created", text: "Invoice created", time: "Feb 13, 2:00 PM" },
      { id: "ev9", type: "sent", text: "Sent to david@parkresidence.com", time: "Feb 13, 2:01 PM" },
      { id: "ev10", type: "paid", text: "Payment received via Stripe", time: "Feb 13, 3:15 PM" },
    ],
  },
  {
    id: "INV-1247", clientId: "c3", clientName: "Lisa Chen", clientEmail: "lisa.chen@gmail.com",
    clientAddress: "18 Stanley St, South Brisbane 4101",
    status: "paid", issueDate: "Feb 12, 2026", dueDate: "Feb 26, 2026", paidDate: "Feb 12, 2026",
    lineItems: [
      { id: "li8", description: "Blocked drain investigation — CCTV", quantity: 1, unitPrice: 680 },
      { id: "li9", description: "Hydro jetting (high pressure)", quantity: 1, unitPrice: 1420 },
    ],
    subtotal: 2100, tax: 210, total: 2310,
    events: [
      { id: "ev11", type: "created", text: "Invoice created", time: "Feb 12, 5:00 PM" },
      { id: "ev12", type: "sent", text: "Sent to lisa.chen@gmail.com", time: "Feb 12, 5:02 PM" },
      { id: "ev13", type: "paid", text: "Payment received via bank transfer", time: "Feb 12, 6:40 PM" },
    ],
  },
  {
    id: "INV-1246", clientId: "c4", clientName: "Tom Andrews", clientEmail: "tom@andrewsprops.com.au",
    clientAddress: "7 Albert St, Brisbane CBD 4000",
    status: "overdue", issueDate: "Feb 8, 2026", dueDate: "Feb 12, 2026",
    lineItems: [
      { id: "li10", description: "Stormwater drainage repair — full", quantity: 1, unitPrice: 2800 },
      { id: "li11", description: "Materials — PVC pipe 100mm", quantity: 4, unitPrice: 150 },
    ],
    subtotal: 3400, tax: 340, total: 3740,
    events: [
      { id: "ev14", type: "created", text: "Invoice created", time: "Feb 8, 3:00 PM" },
      { id: "ev15", type: "sent", text: "Sent to tom@andrewsprops.com.au", time: "Feb 8, 3:05 PM" },
      { id: "ev16", type: "reminder", text: "Payment reminder sent", time: "Feb 13, 9:00 AM" },
    ],
  },
  {
    id: "INV-1245", clientId: "c5", clientName: "Rachel Kim", clientEmail: "rachel.kim@email.com",
    clientAddress: "33 Grey St, South Bank 4101",
    status: "paid", issueDate: "Feb 7, 2026", dueDate: "Feb 21, 2026", paidDate: "Feb 9, 2026",
    lineItems: [
      { id: "li12", description: "Boiler service — annual", quantity: 1, unitPrice: 450 },
      { id: "li13", description: "Gas compliance certificate", quantity: 1, unitPrice: 200 },
    ],
    subtotal: 650, tax: 65, total: 715,
    events: [
      { id: "ev17", type: "created", text: "Invoice created", time: "Feb 7, 11:00 AM" },
      { id: "ev18", type: "sent", text: "Sent to rachel.kim@email.com", time: "Feb 7, 11:01 AM" },
      { id: "ev19", type: "paid", text: "Payment received via Stripe", time: "Feb 9, 2:20 PM" },
    ],
  },
  {
    id: "INV-1244", clientId: "c1", clientName: "David Park", clientEmail: "david@parkresidence.com",
    clientAddress: "42 Creek Rd, Brisbane CBD 4000",
    status: "paid", issueDate: "Feb 5, 2026", dueDate: "Feb 19, 2026", paidDate: "Feb 6, 2026",
    lineItems: [
      { id: "li14", description: "Water heater installation — Rinnai 26L", quantity: 1, unitPrice: 2200 },
      { id: "li15", description: "Old unit removal & disposal", quantity: 1, unitPrice: 350 },
      { id: "li16", description: "Materials — gas fitting kit", quantity: 1, unitPrice: 300 },
    ],
    subtotal: 2850, tax: 285, total: 3135,
    events: [
      { id: "ev20", type: "created", text: "Invoice created", time: "Feb 5, 4:00 PM" },
      { id: "ev21", type: "sent", text: "Sent to david@parkresidence.com", time: "Feb 5, 4:02 PM" },
      { id: "ev22", type: "paid", text: "Payment received via Stripe", time: "Feb 6, 9:45 AM" },
    ],
  },
  {
    id: "INV-1243", clientId: "c4", clientName: "Tom Andrews", clientEmail: "tom@andrewsprops.com.au",
    clientAddress: "7 Albert St, Brisbane CBD 4000",
    status: "overdue", issueDate: "Jan 28, 2026", dueDate: "Feb 11, 2026",
    lineItems: [
      { id: "li17", description: "Gas compliance cert renewal — commercial", quantity: 1, unitPrice: 1200 },
      { id: "li18", description: "Gas line pressure test", quantity: 1, unitPrice: 450 },
      { id: "li19", description: "Regulator replacement", quantity: 1, unitPrice: 380 },
    ],
    subtotal: 2030, tax: 203, total: 2233,
    events: [
      { id: "ev23", type: "created", text: "Invoice created", time: "Jan 28, 2:00 PM" },
      { id: "ev24", type: "sent", text: "Sent to tom@andrewsprops.com.au", time: "Jan 28, 2:05 PM" },
      { id: "ev25", type: "reminder", text: "Payment reminder sent", time: "Feb 12, 9:00 AM" },
    ],
  },
  {
    id: "INV-1242", clientId: "c6", clientName: "John Harris", clientEmail: "j.harris@bigpond.com",
    clientAddress: "12 Edward St, Brisbane CBD 4000",
    status: "draft", issueDate: "Feb 15, 2026", dueDate: "Mar 1, 2026",
    lineItems: [
      { id: "li20", description: "Burst pipe emergency repair — today", quantity: 1, unitPrice: 880 },
      { id: "li21", description: "Materials — emergency fittings", quantity: 1, unitPrice: 120 },
    ],
    subtotal: 1000, tax: 100, total: 1100,
    events: [
      { id: "ev26", type: "created", text: "Invoice created (draft)", time: "Feb 15, 3:00 PM" },
    ],
  },
];

export const payouts: Payout[] = [
  { id: "po-1", amount: 7587, date: "Feb 14, 2026", bank: "CommBank", invoiceIds: ["INV-1249", "INV-1248", "INV-1244"], status: "processing" },
  { id: "po-2", amount: 3025, date: "Feb 12, 2026", bank: "CommBank", invoiceIds: ["INV-1247", "INV-1245"], status: "completed" },
  { id: "po-3", amount: 4200, date: "Feb 7, 2026", bank: "CommBank", invoiceIds: [], status: "completed" },
  { id: "po-4", amount: 6800, date: "Jan 31, 2026", bank: "CommBank", invoiceIds: [], status: "completed" },
];

export const dailyRevenue: DailyRevenue[] = [
  { date: "Feb 1", amount: 0, invoiceCount: 0 },
  { date: "Feb 2", amount: 450, invoiceCount: 1 },
  { date: "Feb 3", amount: 0, invoiceCount: 0 },
  { date: "Feb 4", amount: 1200, invoiceCount: 2 },
  { date: "Feb 5", amount: 3135, invoiceCount: 1 },
  { date: "Feb 6", amount: 0, invoiceCount: 0 },
  { date: "Feb 7", amount: 715, invoiceCount: 1 },
  { date: "Feb 8", amount: 0, invoiceCount: 0 },
  { date: "Feb 9", amount: 650, invoiceCount: 1 },
  { date: "Feb 10", amount: 0, invoiceCount: 0 },
  { date: "Feb 11", amount: 800, invoiceCount: 1 },
  { date: "Feb 12", amount: 2310, invoiceCount: 1 },
  { date: "Feb 13", amount: 198, invoiceCount: 1 },
  { date: "Feb 14", amount: 1364, invoiceCount: 1 },
  { date: "Feb 15", amount: 0, invoiceCount: 0 },
];

/* ── Team ──────────────────────────────────────────── */

export const team: TeamMember[] = [
  { id: "t1", name: "Mike Thompson", initials: "MT", role: "admin", email: "mike@apexplumbing.com.au", status: "online" },
  { id: "t2", name: "Sarah Chen", initials: "SC", role: "member", email: "sarah@apexplumbing.com.au", status: "online" },
  { id: "t3", name: "James O'Brien", initials: "JO", role: "member", email: "james@apexplumbing.com.au", status: "away" },
  { id: "t4", name: "Tom Liu", initials: "TL", role: "member", email: "tom@apexplumbing.com.au", status: "offline" },
];
