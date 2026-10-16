export const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
export const PRESENCE_EXPIRY_MS = 120_000;
export const PRESENCE_REFRESH_INTERVAL_MS = 15_000;

export function getPresenceStatus({ active, lastSeen, available, now = Date.now() }) {
  if (active === false || (active !== true && active !== undefined)) return 'offline';
  if (!available || !Number.isFinite(lastSeen)) return 'unknown';

  const age = now - lastSeen;
  if (age < 0) return 'unknown';
  return age <= PRESENCE_EXPIRY_MS ? 'online' : 'offline';
}
