export const queryKeys = {
  participants: {
    all: (workspaceId: string) => ["participants", workspaceId] as const,
    list: (workspaceId: string, filters?: { search?: string; status?: string }) =>
      ["participants", workspaceId, "list", filters] as const,
    detail: (id: string) => ["participants", "detail", id] as const,
    dossier: (id: string) => ["participants", "dossier", id] as const,
    budget: (id: string) => ["participants", "budget", id] as const,
    timeline: (id: string) => ["participants", "timeline", id] as const,
  },
  jobs: {
    all: (workspaceId: string) => ["jobs", workspaceId] as const,
    list: (workspaceId: string, filters?: Record<string, unknown>) =>
      ["jobs", workspaceId, "list", filters] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
  },
  clients: {
    all: (workspaceId: string) => ["clients", workspaceId] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
  },
  schedule: {
    all: (workspaceId: string) => ["schedule", workspaceId] as const,
  },
  agencies: {
    list: (workspaceId: string) => ["agencies", workspaceId] as const,
  },
} as const;
