/**
 * @store PortalStore
 * @status COMPLETE
 * @description Zustand store for client/family portal state — tenant branding,
 *   active entity, granted entities, and idle timeout management.
 *   Strictly isolated from apps/web internal stores.
 * @lastAudit 2026-03-24
 */

import { create } from "zustand";

export interface PortalTenant {
  workspace_id: string;
  name: string;
  slug: string;
  trade: string | null;
  logo_url: string | null;
  brand_color: string;
  text_on_brand: string;
  logo_light: string | null;
  logo_dark: string | null;
  app_name: string;
  welcome_text: string | null;
  idle_timeout: number;
}

export interface GrantedEntity {
  id: string;
  entity_type: string;
  entity_id: string;
  grant_type: string;
  entity_name: string;
}

interface PortalState {
  activeTenant: PortalTenant | null;
  grantedEntities: GrantedEntity[];
  activeEntityId: string | null;
  portalUser: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
  } | null;
  lastActivity: number;

  setTenant: (tenant: PortalTenant) => void;
  setGrantedEntities: (entities: GrantedEntity[]) => void;
  setActiveEntityId: (id: string | null) => void;
  setPortalUser: (user: PortalState["portalUser"]) => void;
  touchActivity: () => void;
  isIdle: () => boolean;
  reset: () => void;
}

export const usePortalStore = create<PortalState>()((set, get) => ({
  activeTenant: null,
  grantedEntities: [],
  activeEntityId: null,
  portalUser: null,
  lastActivity: Date.now(),

  setTenant: (tenant) => set({ activeTenant: tenant }),

  setGrantedEntities: (entities) => {
    set({ grantedEntities: entities });
    if (entities.length > 0 && !get().activeEntityId) {
      set({ activeEntityId: entities[0].entity_id });
    }
  },

  setActiveEntityId: (id) => set({ activeEntityId: id }),

  setPortalUser: (user) => set({ portalUser: user }),

  touchActivity: () => set({ lastActivity: Date.now() }),

  isIdle: () => {
    const tenant = get().activeTenant;
    const timeoutMs = (tenant?.idle_timeout || 15) * 60 * 1000;
    return Date.now() - get().lastActivity > timeoutMs;
  },

  reset: () =>
    set({
      activeTenant: null,
      grantedEntities: [],
      activeEntityId: null,
      portalUser: null,
      lastActivity: Date.now(),
    }),
}));
