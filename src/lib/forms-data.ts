/* ── Forms & Compliance Data ────────────────────────── */

export type FormStatus = "draft" | "published" | "archived";
export type FormSource = "custom" | "library";
export type SubmissionStatus = "signed" | "pending" | "expired";

export type BlockType =
  | "heading"
  | "text"
  | "short_text"
  | "long_text"
  | "date"
  | "dropdown"
  | "signature"
  | "gps_stamp"
  | "photo_evidence"
  | "risk_matrix"
  | "checkbox";

export interface FormBlock {
  id: string;
  type: BlockType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for dropdown
  value?: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  source: FormSource;
  status: FormStatus;
  version: number;
  category: string;
  blocks: FormBlock[];
  usedCount: number;
  lastEdited: string;
  createdBy: string;
  verified: boolean; // gold shield for library templates
  tags: string[];
}

export interface SubmissionTelemetry {
  ip: string;
  browser: string;
  os: string;
  gpsLat: number;
  gpsLng: number;
  gpsAddress: string;
  timestamp: string; // to the millisecond
  sha256: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  formVersion: number;
  status: SubmissionStatus;
  submittedBy: string;
  submittedByInitials: string;
  jobRef?: string;
  clientName?: string;
  submittedAt: string;
  signedAt?: string;
  telemetry?: SubmissionTelemetry;
  fields: { label: string; value: string }[];
}

/* ── Mock Form Templates ───────────────────────────── */

export const formTemplates: FormTemplate[] = [
  {
    id: "frm-1",
    title: "Electrical SWMS v2",
    description: "Safe Work Method Statement for electrical installations and maintenance.",
    source: "library",
    status: "published",
    version: 2,
    category: "Safety",
    blocks: [
      { id: "b1", type: "heading", label: "Safe Work Method Statement", required: false },
      { id: "b2", type: "short_text", label: "Job Reference", required: true, placeholder: "e.g. JOB-402" },
      { id: "b3", type: "date", label: "Date of Works", required: true },
      { id: "b4", type: "short_text", label: "Site Address", required: true },
      { id: "b5", type: "dropdown", label: "Work Type", required: true, options: ["Installation", "Maintenance", "Repair", "Inspection"] },
      { id: "b6", type: "risk_matrix", label: "Risk Assessment", required: true },
      { id: "b7", type: "long_text", label: "Control Measures", required: true, placeholder: "Describe safety controls..." },
      { id: "b8", type: "photo_evidence", label: "Site Photo (Before)", required: true },
      { id: "b9", type: "checkbox", label: "PPE Confirmed", required: true },
      { id: "b10", type: "gps_stamp", label: "Location Verification", required: true },
      { id: "b11", type: "signature", label: "Worker Signature", required: true },
      { id: "b12", type: "signature", label: "Supervisor Signature", required: true },
    ],
    usedCount: 42,
    lastEdited: "2d ago",
    createdBy: "iWorkr",
    verified: true,
    tags: ["SWMS", "Electrical", "Safety"],
  },
  {
    id: "frm-2",
    title: "Plumbing Compliance Certificate",
    description: "AS/NZS 3500 compliance certification for plumbing work.",
    source: "library",
    status: "published",
    version: 1,
    category: "Compliance",
    blocks: [
      { id: "b1", type: "heading", label: "Plumbing Compliance Certificate", required: false },
      { id: "b2", type: "short_text", label: "Certificate Number", required: true },
      { id: "b3", type: "short_text", label: "License Number", required: true },
      { id: "b4", type: "date", label: "Date of Completion", required: true },
      { id: "b5", type: "long_text", label: "Work Description", required: true },
      { id: "b6", type: "dropdown", label: "Standard Compliance", required: true, options: ["AS/NZS 3500.1", "AS/NZS 3500.2", "AS/NZS 3500.4", "AS/NZS 3500.5"] },
      { id: "b7", type: "photo_evidence", label: "Completed Work Photo", required: true },
      { id: "b8", type: "signature", label: "Licensed Plumber Signature", required: true },
      { id: "b9", type: "gps_stamp", label: "Site Location", required: true },
    ],
    usedCount: 31,
    lastEdited: "5d ago",
    createdBy: "iWorkr",
    verified: true,
    tags: ["Compliance", "Plumbing", "Certificate"],
  },
  {
    id: "frm-3",
    title: "Hot Water System Handover",
    description: "Client handover form for hot water system installations.",
    source: "custom",
    status: "published",
    version: 3,
    category: "Handover",
    blocks: [
      { id: "b1", type: "heading", label: "Hot Water System Handover", required: false },
      { id: "b2", type: "short_text", label: "System Model", required: true },
      { id: "b3", type: "short_text", label: "Serial Number", required: true },
      { id: "b4", type: "date", label: "Installation Date", required: true },
      { id: "b5", type: "dropdown", label: "System Type", required: true, options: ["Electric", "Gas", "Solar", "Heat Pump"] },
      { id: "b6", type: "long_text", label: "Operating Instructions", required: true },
      { id: "b7", type: "photo_evidence", label: "Installation Photo", required: true },
      { id: "b8", type: "checkbox", label: "Safety valve tested", required: true },
      { id: "b9", type: "checkbox", label: "Temperature set to 60°C", required: true },
      { id: "b10", type: "signature", label: "Technician Signature", required: true },
      { id: "b11", type: "signature", label: "Client Signature", required: true },
    ],
    usedCount: 18,
    lastEdited: "1d ago",
    createdBy: "Mike Thompson",
    verified: false,
    tags: ["Handover", "Hot Water", "Client"],
  },
  {
    id: "frm-4",
    title: "Daily Job Safety Checklist",
    description: "Pre-start safety checklist for all field technicians.",
    source: "custom",
    status: "published",
    version: 1,
    category: "Safety",
    blocks: [
      { id: "b1", type: "heading", label: "Daily Safety Checklist", required: false },
      { id: "b2", type: "date", label: "Date", required: true },
      { id: "b3", type: "checkbox", label: "PPE available and in good condition", required: true },
      { id: "b4", type: "checkbox", label: "Vehicle inspected (tires, lights, fluids)", required: true },
      { id: "b5", type: "checkbox", label: "Tools inspected and tagged", required: true },
      { id: "b6", type: "checkbox", label: "First aid kit stocked", required: true },
      { id: "b7", type: "checkbox", label: "Emergency contacts accessible", required: true },
      { id: "b8", type: "long_text", label: "Additional Hazards Noted", required: false },
      { id: "b9", type: "signature", label: "Technician Signature", required: true },
    ],
    usedCount: 156,
    lastEdited: "Today",
    createdBy: "Sarah Chen",
    verified: false,
    tags: ["Safety", "Daily", "Checklist"],
  },
  {
    id: "frm-5",
    title: "Gas Compliance Certificate",
    description: "Gas fitting compliance under AS 5601.",
    source: "library",
    status: "published",
    version: 1,
    category: "Compliance",
    blocks: [
      { id: "b1", type: "heading", label: "Gas Compliance Certificate", required: false },
      { id: "b2", type: "short_text", label: "Gas Fitter License No.", required: true },
      { id: "b3", type: "dropdown", label: "Appliance Type", required: true, options: ["Water Heater", "Cooktop", "Space Heater", "BBQ", "Other"] },
      { id: "b4", type: "short_text", label: "Appliance Serial No.", required: true },
      { id: "b5", type: "long_text", label: "Work Performed", required: true },
      { id: "b6", type: "photo_evidence", label: "Gas Meter Photo", required: true },
      { id: "b7", type: "signature", label: "Gas Fitter Signature", required: true },
      { id: "b8", type: "gps_stamp", label: "Site Location", required: true },
    ],
    usedCount: 24,
    lastEdited: "1w ago",
    createdBy: "iWorkr",
    verified: true,
    tags: ["Gas", "Compliance", "Certificate"],
  },
  {
    id: "frm-6",
    title: "Client Satisfaction Survey",
    description: "Post-job satisfaction survey sent to clients.",
    source: "custom",
    status: "published",
    version: 2,
    category: "Feedback",
    blocks: [
      { id: "b1", type: "heading", label: "How did we do?", required: false },
      { id: "b2", type: "dropdown", label: "Overall Rating", required: true, options: ["5 - Excellent", "4 - Good", "3 - Average", "2 - Poor", "1 - Terrible"] },
      { id: "b3", type: "long_text", label: "Comments", required: false, placeholder: "Tell us about your experience..." },
      { id: "b4", type: "checkbox", label: "I would recommend this service", required: false },
      { id: "b5", type: "short_text", label: "Name", required: false },
    ],
    usedCount: 89,
    lastEdited: "3d ago",
    createdBy: "Sarah Chen",
    verified: false,
    tags: ["Survey", "Client", "Feedback"],
  },
  {
    id: "frm-7",
    title: "Confined Space Entry Permit",
    description: "Permit to work in confined spaces per AS 2865.",
    source: "library",
    status: "published",
    version: 1,
    category: "Safety",
    blocks: [
      { id: "b1", type: "heading", label: "Confined Space Entry Permit", required: false },
      { id: "b2", type: "short_text", label: "Permit Number", required: true },
      { id: "b3", type: "risk_matrix", label: "Hazard Assessment", required: true },
      { id: "b4", type: "long_text", label: "Atmospheric Test Results", required: true },
      { id: "b5", type: "checkbox", label: "Rescue plan confirmed", required: true },
      { id: "b6", type: "checkbox", label: "Communication established", required: true },
      { id: "b7", type: "signature", label: "Entrant Signature", required: true },
      { id: "b8", type: "signature", label: "Spotter Signature", required: true },
      { id: "b9", type: "gps_stamp", label: "Entry Location", required: true },
    ],
    usedCount: 8,
    lastEdited: "2w ago",
    createdBy: "iWorkr",
    verified: true,
    tags: ["Confined Space", "Permit", "Safety"],
  },
  {
    id: "frm-8",
    title: "Vehicle Inspection Report",
    description: "Weekly vehicle condition inspection.",
    source: "custom",
    status: "draft",
    version: 1,
    category: "Maintenance",
    blocks: [
      { id: "b1", type: "heading", label: "Vehicle Inspection", required: false },
      { id: "b2", type: "short_text", label: "Vehicle Rego", required: true },
      { id: "b3", type: "date", label: "Inspection Date", required: true },
      { id: "b4", type: "checkbox", label: "Tires — Good condition", required: true },
      { id: "b5", type: "checkbox", label: "Lights — All working", required: true },
      { id: "b6", type: "checkbox", label: "Fluids — Topped up", required: true },
      { id: "b7", type: "photo_evidence", label: "Vehicle Photo", required: false },
      { id: "b8", type: "long_text", label: "Issues Found", required: false },
      { id: "b9", type: "signature", label: "Inspector Signature", required: true },
    ],
    usedCount: 0,
    lastEdited: "Just now",
    createdBy: "Mike Thompson",
    verified: false,
    tags: ["Vehicle", "Inspection", "Maintenance"],
  },
];

/* ── Mock Submissions ──────────────────────────────── */

export const formSubmissions: FormSubmission[] = [
  {
    id: "sub-1",
    formId: "frm-1",
    formTitle: "Electrical SWMS v2",
    formVersion: 2,
    status: "signed",
    submittedBy: "Mike Thompson",
    submittedByInitials: "MT",
    jobRef: "JOB-401",
    clientName: "David Park",
    submittedAt: "Feb 15, 2026",
    signedAt: "Feb 15, 2026 — 09:42:12.847 AM",
    telemetry: {
      ip: "103.42.176.89",
      browser: "Chrome Mobile 122",
      os: "iOS 17.4",
      gpsLat: -27.4698,
      gpsLng: 153.0251,
      gpsAddress: "42 Creek Rd, Brisbane CBD 4000",
      timestamp: "2026-02-15T09:42:12.847Z",
      sha256: "a4f8c1e3b9d72f56...",
    },
    fields: [
      { label: "Job Reference", value: "JOB-401" },
      { label: "Date of Works", value: "Feb 15, 2026" },
      { label: "Site Address", value: "42 Creek Rd, Brisbane CBD 4000" },
      { label: "Work Type", value: "Installation" },
      { label: "Risk Assessment", value: "Medium (2B)" },
      { label: "Control Measures", value: "Isolation of power supply confirmed. RCD tested. PPE worn at all times." },
      { label: "PPE Confirmed", value: "Yes" },
    ],
  },
  {
    id: "sub-2",
    formId: "frm-2",
    formTitle: "Plumbing Compliance Certificate",
    formVersion: 1,
    status: "signed",
    submittedBy: "Sarah Chen",
    submittedByInitials: "SC",
    jobRef: "JOB-402",
    clientName: "Sarah Mitchell",
    submittedAt: "Feb 14, 2026",
    signedAt: "Feb 14, 2026 — 14:18:03.221 PM",
    telemetry: {
      ip: "103.42.176.92",
      browser: "Safari Mobile 17.2",
      os: "iOS 17.2",
      gpsLat: -27.4575,
      gpsLng: 153.0355,
      gpsAddress: "54 High St, Fortitude Valley 4006",
      timestamp: "2026-02-14T14:18:03.221Z",
      sha256: "d7e9a2f4c8b31d05...",
    },
    fields: [
      { label: "Certificate Number", value: "PCC-2026-0142" },
      { label: "License Number", value: "QLD-PL-44892" },
      { label: "Date of Completion", value: "Feb 14, 2026" },
      { label: "Work Description", value: "Kitchen repipe — full copper to PEX conversion. All joints tested to 1500kPa." },
      { label: "Standard Compliance", value: "AS/NZS 3500.1" },
    ],
  },
  {
    id: "sub-3",
    formId: "frm-3",
    formTitle: "Hot Water System Handover",
    formVersion: 3,
    status: "signed",
    submittedBy: "Mike Thompson",
    submittedByInitials: "MT",
    jobRef: "JOB-399",
    clientName: "David Park",
    submittedAt: "Feb 13, 2026",
    signedAt: "Feb 13, 2026 — 16:05:44.510 PM",
    telemetry: {
      ip: "103.42.176.89",
      browser: "Chrome Mobile 122",
      os: "Android 14",
      gpsLat: -27.4698,
      gpsLng: 153.0251,
      gpsAddress: "42 Creek Rd, Brisbane CBD 4000",
      timestamp: "2026-02-13T16:05:44.510Z",
      sha256: "b3c8e1d5a9f42e78...",
    },
    fields: [
      { label: "System Model", value: "Rheem Stellar 50L Gas" },
      { label: "Serial Number", value: "RHM-STR50-2024-08842" },
      { label: "Installation Date", value: "Feb 13, 2026" },
      { label: "System Type", value: "Gas" },
      { label: "Safety valve tested", value: "Yes" },
      { label: "Temperature set to 60°C", value: "Yes" },
    ],
  },
  {
    id: "sub-4",
    formId: "frm-4",
    formTitle: "Daily Job Safety Checklist",
    formVersion: 1,
    status: "signed",
    submittedBy: "James O'Brien",
    submittedByInitials: "JO",
    submittedAt: "Feb 15, 2026",
    signedAt: "Feb 15, 2026 — 06:58:22.103 AM",
    telemetry: {
      ip: "103.42.176.95",
      browser: "Chrome Mobile 122",
      os: "Android 14",
      gpsLat: -27.4710,
      gpsLng: 153.0234,
      gpsAddress: "HQ — 8 Merivale St, South Brisbane 4101",
      timestamp: "2026-02-15T06:58:22.103Z",
      sha256: "f2a7d4e8c1b93f60...",
    },
    fields: [
      { label: "Date", value: "Feb 15, 2026" },
      { label: "PPE available and in good condition", value: "Yes" },
      { label: "Vehicle inspected", value: "Yes" },
      { label: "Tools inspected and tagged", value: "Yes" },
      { label: "First aid kit stocked", value: "Yes" },
      { label: "Emergency contacts accessible", value: "Yes" },
    ],
  },
  {
    id: "sub-5",
    formId: "frm-4",
    formTitle: "Daily Job Safety Checklist",
    formVersion: 1,
    status: "pending",
    submittedBy: "Tom Liu",
    submittedByInitials: "TL",
    submittedAt: "Feb 15, 2026",
    fields: [
      { label: "Date", value: "Feb 15, 2026" },
      { label: "PPE available and in good condition", value: "Yes" },
      { label: "Vehicle inspected", value: "—" },
    ],
  },
  {
    id: "sub-6",
    formId: "frm-5",
    formTitle: "Gas Compliance Certificate",
    formVersion: 1,
    status: "signed",
    submittedBy: "Mike Thompson",
    submittedByInitials: "MT",
    jobRef: "JOB-404",
    clientName: "Tom Andrews",
    submittedAt: "Feb 12, 2026",
    signedAt: "Feb 12, 2026 — 11:24:38.892 PM",
    telemetry: {
      ip: "103.42.176.89",
      browser: "Chrome Mobile 122",
      os: "iOS 17.4",
      gpsLat: -27.4632,
      gpsLng: 153.0285,
      gpsAddress: "7 Albert St, Brisbane CBD 4000",
      timestamp: "2026-02-12T11:24:38.892Z",
      sha256: "c9d4e7a2f1b38c56...",
    },
    fields: [
      { label: "Gas Fitter License No.", value: "QLD-GF-22847" },
      { label: "Appliance Type", value: "Water Heater" },
      { label: "Work Performed", value: "Annual gas compliance inspection. All connections tested with leak detection fluid. No leaks detected. Flue tested for draft." },
    ],
  },
];

/* ── Helpers ────────────────────────────────────────── */

export function getTemplateCount(): number {
  return formTemplates.filter((f) => f.status !== "archived").length;
}

export function getSubmissionCount(): number {
  return formSubmissions.length;
}

export function getSignedCount(): number {
  return formSubmissions.filter((s) => s.status === "signed").length;
}
