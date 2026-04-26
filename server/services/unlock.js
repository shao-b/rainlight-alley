import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { HttpError } from '../lib/http.js';
import { diffLocalDays } from '../lib/time.js';

export function getMaxUnlockIndex(createdAt, now = new Date()) {
  const dayDiff = diffLocalDays(createdAt, now, env.timezone);
  return Math.max(1, Math.min(env.unlockTotalNeighborhoods, dayDiff + 1));
}

export async function getUnlockIndexes(deviceId) {
  const { data, error } = await supabase
    .from('unlocks')
    .select('neighborhood_index')
    .eq('device_id', deviceId)
    .order('neighborhood_index', { ascending: true });
  if (error) throw error;
  return data.map((row) => row.neighborhood_index);
}

export async function ensureDeviceExists(deviceId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('devices')
    .upsert({ id: deviceId, last_active_at: now }, { onConflict: 'id' })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function unlockWithDailyRule({ deviceId, neighborhoodIndex }) {
  const device = await ensureDeviceExists(deviceId);
  const maxAllowedIndex = getMaxUnlockIndex(device.created_at, new Date());
  if (neighborhoodIndex > maxAllowedIndex) {
    throw new HttpError(400, 'UNLOCK_LIMIT_EXCEEDED', 'Requested district exceeds daily unlock limit', {
      maxAllowedIndex,
    });
  }

  const { error } = await supabase.from('unlocks').upsert(
    {
      device_id: deviceId,
      neighborhood_index: neighborhoodIndex,
      unlocked_at: new Date().toISOString(),
    },
    { onConflict: 'device_id,neighborhood_index' },
  );
  if (error) throw error;
}
