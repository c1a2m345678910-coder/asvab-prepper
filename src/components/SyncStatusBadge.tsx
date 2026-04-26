'use client';

import { useAuthStore } from '@/store/authStore';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diff < 60_000) return rtf.format(-Math.round(diff / 1000), 'seconds');
  if (diff < 3_600_000) return rtf.format(-Math.round(diff / 60_000), 'minutes');
  return rtf.format(-Math.round(diff / 3_600_000), 'hours');
}

export default function SyncStatusBadge() {
  const { user, syncStatus, lastSyncedAt, syncError } = useAuthStore();

  if (!user) {
    return (
      <span className="text-xs text-slate-400">
        Not signed in — data stays local
      </span>
    );
  }

  if (syncStatus === 'syncing') {
    return (
      <span className="text-xs text-indigo-400 animate-pulse">Syncing…</span>
    );
  }

  if (syncStatus === 'error') {
    return (
      <span className="text-xs text-red-400" title={syncError ?? undefined}>
        Sync failed — will retry
      </span>
    );
  }

  const label = lastSyncedAt
    ? `Synced ${formatRelative(lastSyncedAt)}`
    : 'Not yet synced';

  return <span className="text-xs text-emerald-500">{label}</span>;
}
