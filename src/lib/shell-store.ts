import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ShellState {
  sidebarCollapsed: boolean;
  commandMenuOpen: boolean;
  slideOverOpen: boolean;
  slideOverContent: { type: string; id: string; title: string } | null;
  activeNavItem: string;
  createClientModalOpen: boolean;
  createJobModalOpen: boolean;
  createInvoiceModalOpen: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandMenuOpen: (open: boolean) => void;
  openSlideOver: (content: { type: string; id: string; title: string }) => void;
  closeSlideOver: () => void;
  setActiveNavItem: (id: string) => void;
  setCreateClientModalOpen: (open: boolean) => void;
  setCreateJobModalOpen: (open: boolean) => void;
  setCreateInvoiceModalOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandMenuOpen: false,
      slideOverOpen: false,
      slideOverContent: null,
      activeNavItem: "nav_dashboard",
      createClientModalOpen: false,
      createJobModalOpen: false,
      createInvoiceModalOpen: false,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),
      setCommandMenuOpen: (open) => set({ commandMenuOpen: open }),
      openSlideOver: (content) =>
        set({ slideOverOpen: true, slideOverContent: content }),
      closeSlideOver: () =>
        set({ slideOverOpen: false, slideOverContent: null }),
      setActiveNavItem: (id) => set({ activeNavItem: id }),
      setCreateClientModalOpen: (open) => set({ createClientModalOpen: open }),
      setCreateJobModalOpen: (open) => set({ createJobModalOpen: open }),
      setCreateInvoiceModalOpen: (open) => set({ createInvoiceModalOpen: open }),
    }),
    { name: "iworkr-shell" }
  )
);
