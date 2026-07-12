import { create } from "zustand";

/**
 * Global open/close state for the Rae concierge widget, so any CTA on the site
 * (e.g. "Talk to our team" buttons) can open it later via useRaeStore().open().
 */
interface RaeStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useRaeStore = create<RaeStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
