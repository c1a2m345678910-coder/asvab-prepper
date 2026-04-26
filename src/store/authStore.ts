import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  lastSyncedAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setLastSyncedAt: (iso: string | null) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'error', error?: string) => void;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  lastSyncedAt: null,
  syncStatus: 'idle',
  syncError: null,

  setUser: (user) => set({ user }),
  setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),
  setSyncStatus: (status, error) =>
    set({ syncStatus: status, syncError: error ?? null }),
}));
