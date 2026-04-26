'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useProgressStore } from '@/store/progressStore';
import { usePrefsStore } from '@/store/prefsStore';
import {
  syncOnSignIn,
  pullFromCloud,
  applyCloudToLocal,
  schedulePush,
} from '@/lib/sync';

export default function SyncManager() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        useAuthStore.getState().setUser(user);

        if (event === 'SIGNED_IN' && user) {
          useAuthStore.getState().setSyncStatus('syncing');
          try {
            await syncOnSignIn(user.id);
            useAuthStore.getState().setSyncStatus('idle');
          } catch (err) {
            useAuthStore.getState().setSyncStatus('error', String(err));
          }
        }

        if (event === 'INITIAL_SESSION' && user) {
          try {
            const cloud = await pullFromCloud(user.id);
            const localSyncedAt = useProgressStore.getState().syncedAt ?? '';
            if (cloud && cloud.synced_at > localSyncedAt) {
              applyCloudToLocal(cloud);
              useAuthStore.getState().setLastSyncedAt(cloud.synced_at);
            } else if (cloud) {
              useAuthStore.getState().setLastSyncedAt(cloud.synced_at);
            }
          } catch {
            // Non-fatal — app works offline
          }
        }

        if (event === 'SIGNED_OUT') {
          useAuthStore.getState().setUser(null);
          useAuthStore.getState().setLastSyncedAt(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const unsubProgress = useProgressStore.subscribe(() => {
      const user = useAuthStore.getState().user;
      if (user) schedulePush(user.id);
    });
    const unsubPrefs = usePrefsStore.subscribe(() => {
      const user = useAuthStore.getState().user;
      if (user) schedulePush(user.id);
    });
    return () => {
      unsubProgress();
      unsubPrefs();
    };
  }, []);

  return null;
}
