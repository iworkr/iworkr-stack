export const queryKeys = {
  participants: {
    all: (orgId: string) => ["participants", orgId] as const,
    list: (orgId: string, filters?: { search?: string; status?: string }) =>
      ["participants", orgId, "list", filters] as const,
    detail: (id: string) => ["participants", "detail", id] as const,
    dossier: (id: string) => ["participants", "dossier", id] as const,
    budget: (id: string) => ["participants", "budget", id] as const,
    timeline: (id: string) => ["participants", "timeline", id] as const,
  },
  jobs: {
    all: (orgId: string) => ["jobs", orgId] as const,
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["jobs", orgId, "list", filters] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
  },
  clients: {
    all: (orgId: string) => ["clients", orgId] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
  },
  schedule: {
    all: (orgId: string) => ["schedule", orgId] as const,
  },
  agencies: {
    list: (orgId: string) => ["agencies", orgId] as const,
  },
  care: {
    snapshot: (orgId: string) => ["care", "snapshot", orgId] as const,
    alerts: (orgId: string) => ["care", "alerts", orgId] as const,
    sentinel: (orgId: string, status?: string) => ["care", "sentinel", orgId, status] as const,
    quality: (orgId: string) => ["care", "quality", orgId] as const,
    behaviour: (orgId: string) => ["care", "behaviour", orgId] as const,
    fundingClaims: (orgId: string) => ["care", "fundingClaims", orgId] as const,
    ndisCatalogue: (search?: string, category?: string) => ["care", "ndisCatalogue", search, category] as const,
    comms: (orgId: string) => ["care", "comms", orgId] as const,
    medications: (orgId: string) => ["care", "medications", orgId] as const,
    prodaClaims: (orgId: string) => ["care", "prodaClaims", orgId] as const,
    facilities: (orgId: string) => ["care", "facilities", orgId] as const,
    routines: (orgId: string) => ["care", "routines", orgId] as const,
    planReviews: (orgId: string) => ["care", "planReviews", orgId] as const,
    planReviewDetail: (orgId: string, participantId: string) => ["care", "planReviewDetail", orgId, participantId] as const,
    planReviewBuild: (orgId: string) => ["care", "planReviewBuild", orgId] as const,
    planReviewReport: (reportId: string) => ["care", "planReviewReport", reportId] as const,
    asclepius: (orgId: string) => ["care", "asclepius", orgId] as const,
    templateRules: (orgId: string) => ["care", "templateRules", orgId] as const,
  },
  finance: {
    oracleTriage: (orgId: string, status?: string) => ["finance", "oracleTriage", orgId, status] as const,
    triageStats: (orgId: string) => ["finance", "triageStats", orgId] as const,
    claims: (orgId: string) => ["finance", "claims", orgId] as const,
    coordinationLedger: (orgId: string) => ["finance", "coordinationLedger", orgId] as const,
    connect: (orgId: string) => ["finance", "connect", orgId] as const,
    quoteDetail: (id: string) => ["finance", "quote", id] as const,
  },
  workforce: {
    directory: (orgId: string) => ["workforce", "directory", orgId] as const,
    dossier: (orgId: string, userId: string) => ["workforce", "dossier", orgId, userId] as const,
    workerCredentials: (orgId: string, userId: string) =>
      ["workforce", "workerCredentials", orgId, userId] as const,
    workerActivity: (orgId: string, userId: string) =>
      ["workforce", "workerActivity", orgId, userId] as const,
    payrollRules: (orgId: string) => ["workforce", "payrollRules", orgId] as const,
    payrollExport: (orgId: string) => ["workforce", "payrollExport", orgId] as const,
  },
  team: {
    all: (orgId: string) => ["team", orgId] as const,
    leave: (orgId: string) => ["team", "leave", orgId] as const,
    profile: (orgId: string, userId: string) => ["team", "profile", orgId, userId] as const,
  },
  timesheets: {
    triage: (orgId: string) => ["timesheets", "triage", orgId] as const,
    telemetry: (orgId: string) => ["timesheets", "telemetry", orgId] as const,
  },
  compliance: {
    readiness: (orgId: string) => ["compliance", "readiness", orgId] as const,
    audits: (orgId: string) => ["compliance", "audits", orgId] as const,
  },
  governance: {
    policies: (orgId: string) => ["governance", "policies", orgId] as const,
  },
  settings: {
    complianceEngine: (orgId: string) => ["settings", "complianceEngine", orgId] as const,
    integrationHealth: (orgId: string) => ["settings", "integrationHealth", orgId] as const,
    yieldProfiles: (orgId: string) => ["settings", "yieldProfiles", orgId] as const,
  },
  clinical: {
    sirsTriage: (orgId: string) => ["clinical", "sirsTriage", orgId] as const,
    goals: (orgId: string) => ["clinical", "goals", orgId] as const,
  },
  communications: {
    feed: (orgId: string, filters?: Record<string, unknown>) => ["communications", "feed", orgId, filters] as const,
    stats: (orgId: string) => ["communications", "stats", orgId] as const,
  },
  analytics: {
    dashboard: (orgId: string) => ["analytics", "dashboard", orgId] as const,
  },
  roster: {
    master: (orgId: string) => ["roster", "master", orgId] as const,
  },
  ops: {
    inventory: (orgId: string) => ["ops", "inventory", orgId] as const,
    kits: (orgId: string) => ["ops", "kits", orgId] as const,
    suppliers: (orgId: string) => ["ops", "suppliers", orgId] as const,
  },
  fleet: {
    vehicles: (orgId: string) => ["fleet", "vehicles", orgId] as const,
    overview: (orgId: string) => ["fleet", "overview", orgId] as const,
  },
  tracking: {
    sessions: (orgId: string, status?: string) => ["tracking", "sessions", orgId, status] as const,
    stats: (orgId: string) => ["tracking", "stats", orgId] as const,
  },
  aiAgent: {
    config: (orgId: string) => ["aiAgent", "config", orgId] as const,
    calls: (orgId: string) => ["aiAgent", "calls", orgId] as const,
  },
  ambient: {
    debrief: (orgId: string, debriefId: string) => ["ambient", "debrief", orgId, debriefId] as const,
  },
  admin: {
    audit: (orgId: string) => ["admin", "audit", orgId] as const,
  },
  crm: {
    pipeline: (orgId: string) => ["crm", "pipeline", orgId] as const,
  },
} as const;
