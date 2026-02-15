/* ── Asset & Inventory Data ─────────────────────────── */

export type AssetStatus = "available" | "assigned" | "maintenance";
export type AssetCategory = "vehicle" | "tool" | "equipment";

export interface Asset {
  id: string;
  tag: string; // e.g. AST-001
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  assignee?: string;
  assigneeInitials?: string;
  image: string; // placeholder description
  purchaseDate: string;
  purchasePrice: number;
  serialNumber: string;
  warrantyExpiry: string;
  depreciationRate: number; // percent per year
  serviceInterval: number; // months
  lastServiceDate: string;
  nextServiceDate: string;
  serviceDuePercent: number; // 0-100, how close to service due (100 = overdue)
  location: string;
  locationCoords?: { lat: number; lng: number };
  notes?: string;
}

export interface AssetAuditEntry {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  type: "transfer" | "service" | "create" | "retire" | "stock_adjust";
  description: string;
  user: string;
  time: string;
}

export type StockAlertLevel = "ok" | "low" | "critical";

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentQty: number;
  maxQty: number;
  minLevel: number; // reorder point
  unitCost: number;
  supplier: string;
  binLocation: string;
  lastRestocked: string;
}

/* ── Mock Assets ───────────────────────────────────── */

export const assets: Asset[] = [
  {
    id: "ast-1",
    tag: "AST-001",
    name: "Toyota Hilux SR5 2024",
    category: "vehicle",
    status: "assigned",
    assignee: "Mike Thompson",
    assigneeInitials: "MT",
    image: "hilux",
    purchaseDate: "Jan 15, 2024",
    purchasePrice: 58500,
    serialNumber: "JTFDT4CD0M5123456",
    warrantyExpiry: "Jan 15, 2029",
    depreciationRate: 20,
    serviceInterval: 6,
    lastServiceDate: "Nov 10, 2025",
    nextServiceDate: "May 10, 2026",
    serviceDuePercent: 35,
    location: "42 Creek Rd, Brisbane CBD",
    locationCoords: { lat: -27.4698, lng: 153.0251 },
  },
  {
    id: "ast-2",
    tag: "AST-002",
    name: "Ford Ranger XLT 2023",
    category: "vehicle",
    status: "assigned",
    assignee: "Sarah Chen",
    assigneeInitials: "SC",
    image: "ranger",
    purchaseDate: "Mar 20, 2023",
    purchasePrice: 52000,
    serialNumber: "MNAUXXMF4P0654321",
    warrantyExpiry: "Mar 20, 2028",
    depreciationRate: 20,
    serviceInterval: 6,
    lastServiceDate: "Dec 5, 2025",
    nextServiceDate: "Jun 5, 2026",
    serviceDuePercent: 22,
    location: "54 High St, Fortitude Valley",
    locationCoords: { lat: -27.4575, lng: 153.0355 },
  },
  {
    id: "ast-3",
    tag: "AST-003",
    name: "Isuzu D-Max 2022",
    category: "vehicle",
    status: "available",
    image: "dmax",
    purchaseDate: "Aug 12, 2022",
    purchasePrice: 48000,
    serialNumber: "MPATFR87JN0987654",
    warrantyExpiry: "Aug 12, 2027",
    depreciationRate: 20,
    serviceInterval: 6,
    lastServiceDate: "Jan 8, 2026",
    nextServiceDate: "Jul 8, 2026",
    serviceDuePercent: 12,
    location: "HQ Warehouse",
    locationCoords: { lat: -27.4710, lng: 153.0234 },
  },
  {
    id: "ast-4",
    tag: "AST-004",
    name: "VW Transporter Van 2024",
    category: "vehicle",
    status: "maintenance",
    image: "transporter",
    purchaseDate: "Jun 1, 2024",
    purchasePrice: 62000,
    serialNumber: "WV2ZZZ7HZRH100234",
    warrantyExpiry: "Jun 1, 2029",
    depreciationRate: 20,
    serviceInterval: 6,
    lastServiceDate: "Sep 15, 2025",
    nextServiceDate: "Mar 15, 2026",
    serviceDuePercent: 92,
    location: "HQ Workshop",
    locationCoords: { lat: -27.4710, lng: 153.0234 },
    notes: "Transmission issue — awaiting parts from dealer.",
  },
  {
    id: "ast-5",
    tag: "AST-005",
    name: "Hilti TE 30-A36 Hammer Drill",
    category: "tool",
    status: "assigned",
    assignee: "James O'Brien",
    assigneeInitials: "JO",
    image: "hilti-drill",
    purchaseDate: "Feb 20, 2025",
    purchasePrice: 1850,
    serialNumber: "HLT-TE30-00492",
    warrantyExpiry: "Feb 20, 2027",
    depreciationRate: 33,
    serviceInterval: 12,
    lastServiceDate: "Feb 20, 2025",
    nextServiceDate: "Feb 20, 2026",
    serviceDuePercent: 98,
    location: "88 Wickham St, Valley",
    locationCoords: { lat: -27.4555, lng: 153.0372 },
  },
  {
    id: "ast-6",
    tag: "AST-006",
    name: "Milwaukee M18 Pipe Press Kit",
    category: "tool",
    status: "assigned",
    assignee: "Mike Thompson",
    assigneeInitials: "MT",
    image: "pipe-press",
    purchaseDate: "Apr 10, 2024",
    purchasePrice: 4200,
    serialNumber: "MLW-M18PP-03219",
    warrantyExpiry: "Apr 10, 2027",
    depreciationRate: 25,
    serviceInterval: 12,
    lastServiceDate: "Oct 10, 2025",
    nextServiceDate: "Oct 10, 2026",
    serviceDuePercent: 40,
    location: "42 Creek Rd, Brisbane CBD",
    locationCoords: { lat: -27.4698, lng: 153.0251 },
  },
  {
    id: "ast-7",
    tag: "AST-007",
    name: "RIDGID SeeSnake CCTV Camera",
    category: "equipment",
    status: "available",
    image: "seesnake",
    purchaseDate: "Sep 5, 2023",
    purchasePrice: 8900,
    serialNumber: "RDG-SS-CM300-7820",
    warrantyExpiry: "Sep 5, 2026",
    depreciationRate: 20,
    serviceInterval: 12,
    lastServiceDate: "Sep 5, 2025",
    nextServiceDate: "Sep 5, 2026",
    serviceDuePercent: 55,
    location: "HQ Warehouse",
    locationCoords: { lat: -27.4710, lng: 153.0234 },
  },
  {
    id: "ast-8",
    tag: "AST-008",
    name: "Rothenberger ROFROST Pipe Freezer",
    category: "equipment",
    status: "assigned",
    assignee: "Tom Liu",
    assigneeInitials: "TL",
    image: "pipe-freezer",
    purchaseDate: "Nov 15, 2024",
    purchasePrice: 3400,
    serialNumber: "RTB-RF-II-01847",
    warrantyExpiry: "Nov 15, 2026",
    depreciationRate: 25,
    serviceInterval: 12,
    lastServiceDate: "Nov 15, 2024",
    nextServiceDate: "Nov 15, 2025",
    serviceDuePercent: 100,
    location: "18 Stanley St, South Brisbane",
    locationCoords: { lat: -27.4785, lng: 153.0190 },
    notes: "Service overdue — calibration check required.",
  },
  {
    id: "ast-9",
    tag: "AST-009",
    name: "Makita 18V Impact Driver Kit",
    category: "tool",
    status: "available",
    image: "impact-driver",
    purchaseDate: "Jul 22, 2025",
    purchasePrice: 380,
    serialNumber: "MKT-DTD172-56789",
    warrantyExpiry: "Jul 22, 2028",
    depreciationRate: 33,
    serviceInterval: 12,
    lastServiceDate: "Jul 22, 2025",
    nextServiceDate: "Jul 22, 2026",
    serviceDuePercent: 58,
    location: "HQ Warehouse",
    locationCoords: { lat: -27.4710, lng: 153.0234 },
  },
  {
    id: "ast-10",
    tag: "AST-010",
    name: "Jetter King 4000 PSI Drain Cleaner",
    category: "equipment",
    status: "assigned",
    assignee: "Mike Thompson",
    assigneeInitials: "MT",
    image: "jetter",
    purchaseDate: "May 3, 2024",
    purchasePrice: 12500,
    serialNumber: "JTK-4000-PSI-00122",
    warrantyExpiry: "May 3, 2027",
    depreciationRate: 15,
    serviceInterval: 6,
    lastServiceDate: "Nov 3, 2025",
    nextServiceDate: "May 3, 2026",
    serviceDuePercent: 32,
    location: "42 Creek Rd, Brisbane CBD",
    locationCoords: { lat: -27.4698, lng: 153.0251 },
  },
];

/* ── Mock Stock Items ──────────────────────────────── */

export const stockItems: StockItem[] = [
  { id: "stk-1", sku: "COP-15MM", name: "15mm Copper Pipe (6m)", category: "Pipe", currentQty: 42, maxQty: 100, minLevel: 15, unitCost: 42.50, supplier: "Reece Plumbing", binLocation: "A1-S2", lastRestocked: "Feb 10, 2026" },
  { id: "stk-2", sku: "COP-22MM", name: "22mm Copper Pipe (3m)", category: "Pipe", currentQty: 8, maxQty: 60, minLevel: 10, unitCost: 38.00, supplier: "Reece Plumbing", binLocation: "A1-S3", lastRestocked: "Jan 28, 2026" },
  { id: "stk-3", sku: "PEX-16MM", name: "16mm PEX-a Pipe (50m coil)", category: "Pipe", currentQty: 15, maxQty: 30, minLevel: 5, unitCost: 185.00, supplier: "Reece Plumbing", binLocation: "A2-S1", lastRestocked: "Feb 5, 2026" },
  { id: "stk-4", sku: "SOLDER-SN", name: "Lead-free Solder 500g", category: "Consumable", currentQty: 3, maxQty: 20, minLevel: 5, unitCost: 28.50, supplier: "Tradelink", binLocation: "B1-S1", lastRestocked: "Jan 15, 2026" },
  { id: "stk-5", sku: "FLUX-250", name: "Soldering Flux 250ml", category: "Consumable", currentQty: 12, maxQty: 30, minLevel: 6, unitCost: 14.80, supplier: "Tradelink", binLocation: "B1-S2", lastRestocked: "Feb 2, 2026" },
  { id: "stk-6", sku: "PTFE-12MM", name: "PTFE Tape 12mm (10-pack)", category: "Consumable", currentQty: 35, maxQty: 100, minLevel: 20, unitCost: 8.90, supplier: "Bunnings Trade", binLocation: "B2-S1", lastRestocked: "Feb 12, 2026" },
  { id: "stk-7", sku: "SIL-CLR", name: "Silicone Sealant — Clear 300ml", category: "Sealant", currentQty: 18, maxQty: 50, minLevel: 10, unitCost: 12.50, supplier: "Bunnings Trade", binLocation: "B3-S1", lastRestocked: "Feb 8, 2026" },
  { id: "stk-8", sku: "BRS-BALL-15", name: "15mm Brass Ball Valve", category: "Fitting", currentQty: 22, maxQty: 40, minLevel: 8, unitCost: 18.90, supplier: "Reece Plumbing", binLocation: "C1-S1", lastRestocked: "Feb 11, 2026" },
  { id: "stk-9", sku: "BRS-BALL-22", name: "22mm Brass Ball Valve", category: "Fitting", currentQty: 5, maxQty: 30, minLevel: 6, unitCost: 24.50, supplier: "Reece Plumbing", binLocation: "C1-S2", lastRestocked: "Jan 20, 2026" },
  { id: "stk-10", sku: "FLEX-300", name: "300mm Braided Flexible Hose", category: "Hose", currentQty: 28, maxQty: 60, minLevel: 12, unitCost: 9.80, supplier: "Tradelink", binLocation: "C2-S1", lastRestocked: "Feb 14, 2026" },
  { id: "stk-11", sku: "FLEX-450", name: "450mm Braided Flexible Hose", category: "Hose", currentQty: 14, maxQty: 40, minLevel: 8, unitCost: 12.50, supplier: "Tradelink", binLocation: "C2-S2", lastRestocked: "Feb 7, 2026" },
  { id: "stk-12", sku: "TANK-SEAL", name: "Cistern Seal Kit Universal", category: "Part", currentQty: 2, maxQty: 25, minLevel: 5, unitCost: 15.80, supplier: "Reece Plumbing", binLocation: "D1-S1", lastRestocked: "Jan 5, 2026" },
  { id: "stk-13", sku: "GAS-TAPE", name: "Gas-rated Yellow PTFE Tape", category: "Consumable", currentQty: 45, maxQty: 80, minLevel: 15, unitCost: 6.20, supplier: "Bunnings Trade", binLocation: "B2-S2", lastRestocked: "Feb 13, 2026" },
  { id: "stk-14", sku: "PVC-50MM", name: "50mm PVC DWV Pipe (6m)", category: "Pipe", currentQty: 20, maxQty: 40, minLevel: 8, unitCost: 32.00, supplier: "Reece Plumbing", binLocation: "A3-S1", lastRestocked: "Feb 9, 2026" },
  { id: "stk-15", sku: "CEM-PVC", name: "PVC Cement 500ml", category: "Consumable", currentQty: 9, maxQty: 20, minLevel: 4, unitCost: 18.50, supplier: "Bunnings Trade", binLocation: "B3-S2", lastRestocked: "Feb 1, 2026" },
];

/* ── Mock Audit Log ────────────────────────────────── */

export const auditLog: AssetAuditEntry[] = [
  { id: "aud-1", assetId: "ast-4", assetTag: "AST-004", assetName: "VW Transporter Van", type: "service", description: "Sent to dealer for transmission repair", user: "Sarah Chen", time: "2h ago" },
  { id: "aud-2", assetId: "ast-5", assetTag: "AST-005", assetName: "Hilti Hammer Drill", type: "transfer", description: "Transferred from HQ to James O'Brien", user: "Mike Thompson", time: "4h ago" },
  { id: "aud-3", assetId: "stk-2", assetTag: "COP-22MM", assetName: "22mm Copper Pipe", type: "stock_adjust", description: "Stock adjusted -4 (used on JOB-403)", user: "Mike Thompson", time: "5h ago" },
  { id: "aud-4", assetId: "ast-1", assetTag: "AST-001", assetName: "Toyota Hilux SR5", type: "service", description: "Oil change & tire rotation completed", user: "System", time: "1d ago" },
  { id: "aud-5", assetId: "stk-12", assetTag: "TANK-SEAL", assetName: "Cistern Seal Kit", type: "stock_adjust", description: "Stock adjusted -3 (used on JOB-409)", user: "Tom Liu", time: "1d ago" },
  { id: "aud-6", assetId: "ast-6", assetTag: "AST-006", assetName: "Milwaukee Pipe Press", type: "transfer", description: "Checked out to Mike Thompson for JOB-401", user: "Mike Thompson", time: "2d ago" },
  { id: "aud-7", assetId: "ast-9", assetTag: "AST-009", assetName: "Makita Impact Driver", type: "transfer", description: "Returned to HQ Warehouse by James O'Brien", user: "James O'Brien", time: "2d ago" },
  { id: "aud-8", assetId: "ast-10", assetTag: "AST-010", assetName: "Jetter King Drain Cleaner", type: "create", description: "New asset registered in system", user: "Sarah Chen", time: "3d ago" },
  { id: "aud-9", assetId: "stk-1", assetTag: "COP-15MM", assetName: "15mm Copper Pipe", type: "stock_adjust", description: "Restocked +20 from Reece Plumbing (PO-1892)", user: "System", time: "5d ago" },
  { id: "aud-10", assetId: "ast-7", assetTag: "AST-007", assetName: "RIDGID SeeSnake CCTV", type: "service", description: "Annual calibration check — passed", user: "System", time: "1w ago" },
];

/* ── Helpers ────────────────────────────────────────── */

export function getStockAlertLevel(item: StockItem): StockAlertLevel {
  if (item.currentQty <= item.minLevel * 0.5) return "critical";
  if (item.currentQty <= item.minLevel) return "low";
  return "ok";
}

export function getTotalAssetValue(): number {
  return assets.reduce((sum, a) => sum + a.purchasePrice, 0);
}

export function getLowStockCount(): number {
  return stockItems.filter((s) => s.currentQty <= s.minLevel).length;
}

export function getActiveVehicleCount(): number {
  return assets.filter((a) => a.category === "vehicle" && a.status !== "maintenance").length;
}
