import cron from 'node-cron';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { getMaxUnlockIndex } from '../services/unlock.js';
import { sendUnlockPush } from '../services/push.js';

async function processExpirations(nowIso) {
  const { data, error } = await supabase
    .from('purchases')
    .select('device_id, product_id, expire_at')
    .eq('product_id', 'dream_dlc')
    .not('expire_at', 'is', null)
    .lt('expire_at', nowIso);
  if (error) throw error;
  if (!data.length) return;

  const deviceIds = [...new Set(data.map((row) => row.device_id))];
  for (const deviceId of deviceIds) {
    await supabase.from('unlocks').delete().eq('device_id', deviceId).in('neighborhood_index', [31, 32]);
  }
}

async function processDailyUnlocks() {
  const now = new Date();
  const nowIso = now.toISOString();
  await processExpirations(nowIso);

  const { data: devices, error } = await supabase
    .from('devices')
    .select('id, created_at, fcm_token')
    .order('created_at', { ascending: true });
  if (error) throw error;

  for (const device of devices) {
    const shouldUnlockIndex = getMaxUnlockIndex(device.created_at, now);
    const { data: existing } = await supabase
      .from('unlocks')
      .select('device_id')
      .eq('device_id', device.id)
      .eq('neighborhood_index', shouldUnlockIndex)
      .maybeSingle();

    if (existing) continue;

    await supabase.from('unlocks').upsert(
      {
        device_id: device.id,
        neighborhood_index: shouldUnlockIndex,
        unlocked_at: nowIso,
      },
      { onConflict: 'device_id,neighborhood_index' },
    );

    try {
      await sendUnlockPush(device.fcm_token, shouldUnlockIndex);
    } catch (err) {
      console.warn(`Failed push for ${device.id}:`, err.message);
    }
  }
}

export function startDailyUnlockJob() {
  const task = cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        await processDailyUnlocks();
        console.info('Daily unlock job done.');
      } catch (err) {
        console.error('Daily unlock job failed:', err);
      }
    },
    { timezone: env.timezone },
  );
  return task;
}
