/**
 * use-ui-store.ts — realsass-sass-front
 *
 * Estado de UI puro del dashboard de dueños.
 * Agrupa estado que es UI-only y no pertenece a ningún dato de servidor.
 *
 * loginModalOpen:     modal de login visible o no
 * activeBottomTab:    tab activo en la barra inferior mobile
 * mobileMenuOpen:     menú mobile del navbar
 */
import { create } from 'zustand';

type BottomTab = 'home' | 'profile' | 'config' | 'explore';

interface UIState {
  // Login modal
  loginModalOpen:    boolean;
  openLoginModal:    () => void;
  closeLoginModal:   () => void;

  // Bottom tab (mobile)
  activeBottomTab:   BottomTab;
  setActiveBottomTab: (tab: BottomTab) => void;

  // Mobile menu navbar
  mobileMenuOpen:    boolean;
  toggleMobileMenu:  () => void;
  closeMobileMenu:   () => void;
}

export const useUIStore = create<UIState>((set) => ({
  loginModalOpen:    false,
  openLoginModal:    () => set({ loginModalOpen: true }),
  closeLoginModal:   () => set({ loginModalOpen: false }),

  activeBottomTab:    'home',
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),

  mobileMenuOpen:    false,
  toggleMobileMenu:  () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  closeMobileMenu:   () => set({ mobileMenuOpen: false }),
}));
