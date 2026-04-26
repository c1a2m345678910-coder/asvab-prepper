import { supabase } from '@/lib/supabase';
import { useProgressStore } from '@/store/progressStore';
import { usePrefsStore } from '@/store/prefsStore';
import { useAuthStore } from '@/store/authStore';

interface CloudRow {
  progress: Record<string, unknown>;
  prefs: Record<string, unknown>;
  synced_at: string;
}

export async function pullFromCloud(userId: string): Promise<CloudRow | null> {
  const { data, error } = await supabase
    .from('user_sync')
    .select('progress, prefs, synced_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as CloudRow | null;
}

export async function pushToCloud(userId: string): Promise<void> {
  const syncedAt = new Date().toISOString();
  const progress = useProgressStore.getState();
  const prefs = usePrefsStore.getState();

  const { error } = await supabase.from('user_sync').upsert(
    { user_id: userId, progress, prefs, synced_at: syncedAt },
    { onConflict: 'user_id' },
  );

  if (error) throw error;

  useProgressStore.setState({ syncedAt });
  useAuthStore.getState().setLastSyncedAt(syncedAt);
}

export function applyCloudToLocal(cloud: CloudRow): void {
  // Full replace — cloud wins entirely. Cast through unknown because JSONB
  // arrives as Record<string, unknown> but structurally matches the store types.
  useProgressStore.setState(cloud.progress as unknown as Parameters<typeof useProgressStore.setState>[0], true);
  usePrefsStore.setState(cloud.prefs as unknown as Parameters<typeof usePrefsStore.setState>[0], true);
  useProgressStore.setState({ syncedAt: cloud.synced_at });
}

export async function syncOnSignIn(userId: string): Promise<void> {
  const cloud = await pullFromCloud(userId);
  const localProgress = useProgressStore.getState();
  const hasLocalData = localProgress.lastActiveDate !== null || localProgress.totalXP > 0;

  if (!cloud) {
    if (hasLocalData) await pushToCloud(userId);
    return;
  }

  const localSyncedAt = localProgress.syncedAt ?? localProgress.lastActiveDate ?? '';
  const cloudIsNewer = cloud.synced_at > localSyncedAt;

  if (cloudIsNewer) {
    applyCloudToLocal(cloud);
    useAuthStore.getState().setLastSyncedAt(cloud.synced_at);
  } else {
    await pushToCloud(userId);
  }
}

// ── Debounced push ─────────────────────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(userId: string): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    try {
      await pushToCloud(userId);
    } catch {
      // Silent — next store change will retry
    }
  }, 3000);
}
