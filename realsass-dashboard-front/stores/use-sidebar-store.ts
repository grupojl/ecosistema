/**
 * use-sidebar-store.ts — realsass-dashboard-front
 *
 * Estado de UI del sidebar mobile.
 * Solo open/close — sin datos de usuario ni navegación hardcodeada.
 *
 * Reemplaza el useState local en MobileHeader que se perdía entre renders.
 */
import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
