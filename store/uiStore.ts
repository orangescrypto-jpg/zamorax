// store/uiStore.ts
// Zustand store for global UI state: modals, drawers, toasts, and nav state.
// Replaces scattered useState calls for drawer/modal/nav open state across
// layout components and pages.

import { create } from "zustand"

interface UiState {
  // Mobile drawer
  isMobileDrawerOpen: boolean
  openMobileDrawer():  void
  closeMobileDrawer(): void
  toggleMobileDrawer(): void

  // Global search overlay
  isSearchOpen: boolean
  openSearch():  void
  closeSearch(): void

  // Notification panel
  isNotifPanelOpen: boolean
  openNotifPanel():  void
  closeNotifPanel(): void

  // Active modal (one modal at a time; null = no modal)
  activeModal: string | null
  modalPayload: Record<string, unknown>
  openModal(id: string, payload?: Record<string, unknown>): void
  closeModal(): void

  // Page loading overlay (for full-page transitions)
  isPageLoading: boolean
  setPageLoading(loading: boolean): void
}

export const useUiStore = create<UiState>()((set) => ({
  isMobileDrawerOpen: false,
  openMobileDrawer:   () => set({ isMobileDrawerOpen: true }),
  closeMobileDrawer:  () => set({ isMobileDrawerOpen: false }),
  toggleMobileDrawer: () => set((s) => ({ isMobileDrawerOpen: !s.isMobileDrawerOpen })),

  isSearchOpen: false,
  openSearch:   () => set({ isSearchOpen: true }),
  closeSearch:  () => set({ isSearchOpen: false }),

  isNotifPanelOpen: false,
  openNotifPanel:   () => set({ isNotifPanelOpen: true }),
  closeNotifPanel:  () => set({ isNotifPanelOpen: false }),

  activeModal:  null,
  modalPayload: {},
  openModal:  (id, payload = {}) => set({ activeModal: id, modalPayload: payload }),
  closeModal: ()                  => set({ activeModal: null, modalPayload: {} }),

  isPageLoading: false,
  setPageLoading: (loading) => set({ isPageLoading: loading }),
}))
