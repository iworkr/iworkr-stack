import { create } from "zustand";
import { clients as initialClients, type Client } from "./data";

interface ClientsState {
  clients: Client[];
  focusedIndex: number;

  setFocusedIndex: (i: number) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  archiveClient: (id: string) => void;
  restoreClient: (client: Client) => void;
}

export const useClientsStore = create<ClientsState>((set) => ({
  clients: initialClients,
  focusedIndex: 0,

  setFocusedIndex: (i) => set({ focusedIndex: i }),

  addClient: (client) =>
    set((s) => ({ clients: [client, ...s.clients] })),

  updateClient: (id, patch) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  archiveClient: (id) =>
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
    })),

  restoreClient: (client) =>
    set((s) => ({
      clients: [...s.clients, client].sort((a, b) => a.id.localeCompare(b.id)),
    })),
}));
