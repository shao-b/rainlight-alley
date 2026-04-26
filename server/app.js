import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { fail, HttpError, ok } from './lib/http.js';
import { supabase } from './lib/supabase.js';
import { ensureDeviceExists, getMaxUnlockIndex, getUnlockIndexes, unlockWithDailyRule } from './services/unlock.js';
import { verifyAppleReceipt } from './services/purchase/apple.js';
import { verifyGooglePurchase } from './services/purchase/google.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => ok(res, { service: 'rainlight-backend' }));

app.post('/api/register', async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) throw new HttpError(400, 'INVALID_DEVICE_ID', 'deviceId is required');
    const device = await ensureDeviceExists(deviceId);
    const unlocks = await getUnlockIndexes(deviceId);
    return ok(res, { deviceId: device.id, createdAt: device.created_at, unlocks });
  } catch (err) {
    return fail(res, err);
  }
});

app.get('/api/unlocks/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) throw new HttpError(400, 'INVALID_DEVICE_ID', 'deviceId is required');
    await ensureDeviceExists(deviceId);
    const unlocks = await getUnlockIndexes(deviceId);
    return ok(res, { deviceId, unlocks });
  } catch (err) {
    return fail(res, err);
  }
});

app.post('/api/unlock', async (req, res) => {
  try {
    const { deviceId, neighborhoodIndex } = req.body;
    if (!deviceId) throw new HttpError(400, 'INVALID_DEVICE_ID', 'deviceId is required');
    if (!Number.isInteger(neighborhoodIndex) || neighborhoodIndex < 1) {
      throw new HttpError(400, 'INVALID_NEIGHBORHOOD_INDEX', 'neighborhoodIndex must be positive integer');
    }
    await unlockWithDailyRule({ deviceId, neighborhoodIndex });
    const unlocks = await getUnlockIndexes(deviceId);
    return ok(res, { deviceId, unlocks });
  } catch (err) {
    return fail(res, err);
  }
});

app.post('/api/story', async (req, res) => {
  try {
    const { deviceId, neighborhoodIndex, storyId } = req.body;
    if (!deviceId || !storyId) throw new HttpError(400, 'INVALID_STORY_PAYLOAD', 'deviceId and storyId are required');
    await ensureDeviceExists(deviceId);
    const { error } = await supabase.from('stories').upsert(
      {
        device_id: deviceId,
        neighborhood_index: neighborhoodIndex,
        story_id: storyId,
        discovered_at: new Date().toISOString(),
      },
      { onConflict: 'device_id,neighborhood_index,story_id' },
    );
    if (error) throw error;

    await supabase
      .from('stats')
      .upsert(
        {
          device_id: deviceId,
          neighborhood_index: neighborhoodIndex,
          date: new Date().toISOString().slice(0, 10),
          total_duration: 0,
          story_discoveries: 1,
        },
        { onConflict: 'device_id,neighborhood_index,date' },
      )
      .select();

    return ok(res, { deviceId, storyId });
  } catch (err) {
    return fail(res, err);
  }
});

app.post('/api/stats', async (req, res) => {
  try {
    const { deviceId, neighborhoodIndex, durationSeconds } = req.body;
    if (!deviceId) throw new HttpError(400, 'INVALID_DEVICE_ID', 'deviceId is required');
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw new HttpError(400, 'INVALID_DURATION', 'durationSeconds must be a non-negative number');
    }
    await ensureDeviceExists(deviceId);
    const date = new Date().toISOString().slice(0, 10);
    const { data: row, error: findError } = await supabase
      .from('stats')
      .select('total_duration, story_discoveries')
      .eq('device_id', deviceId)
      .eq('neighborhood_index', neighborhoodIndex)
      .eq('date', date)
      .maybeSingle();
    if (findError) throw findError;

    const nextDuration = (row?.total_duration ?? 0) + Math.floor(durationSeconds);
    const nextStories = row?.story_discoveries ?? 0;
    const { error } = await supabase.from('stats').upsert(
      {
        device_id: deviceId,
        neighborhood_index: neighborhoodIndex,
        date,
        total_duration: nextDuration,
        story_discoveries: nextStories,
      },
      { onConflict: 'device_id,neighborhood_index,date' },
    );
    if (error) throw error;
    return ok(res, { deviceId, neighborhoodIndex, totalDuration: nextDuration });
  } catch (err) {
    return fail(res, err);
  }
});

app.post('/api/fcm-token', async (req, res) => {
  try {
    const { deviceId, fcmToken } = req.body;
    if (!deviceId || !fcmToken) throw new HttpError(400, 'INVALID_FCM_PAYLOAD', 'deviceId and fcmToken are required');
    const { error } = await supabase
      .from('devices')
      .update({ fcm_token: fcmToken, last_active_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (error) throw error;
    return ok(res, { deviceId });
  } catch (err) {
    return fail(res, err);
  }
});

app.post('/api/verify-purchase', async (req, res) => {
  try {
    const { deviceId, productId, receiptData, platform } = req.body;
    if (!deviceId || !productId || !receiptData || !platform) {
      throw new HttpError(400, 'INVALID_PURCHASE_PAYLOAD', 'deviceId, productId, receiptData, platform are required');
    }
    await ensureDeviceExists(deviceId);

    let verified;
    if (platform === 'ios') {
      verified = await verifyAppleReceipt({ receiptData, productId });
    } else if (platform === 'android') {
      verified = await verifyGooglePurchase({ receiptData, productId });
    } else {
      throw new HttpError(400, 'INVALID_PLATFORM', 'platform must be ios or android');
    }

    const { error: purchaseError } = await supabase.from('purchases').upsert(
      {
        device_id: deviceId,
        product_id: productId,
        purchase_token: verified.transactionId ?? receiptData,
        verified_at: new Date().toISOString(),
        expire_at: verified.expireAt,
        platform,
      },
      { onConflict: 'device_id,product_id,purchase_token' },
    );
    if (purchaseError) throw purchaseError;

    if (productId === 'complete_city') {
      const allUnlocks = Array.from({ length: env.unlockTotalNeighborhoods }, (_, i) => i + 1);
      const rows = allUnlocks.map((index) => ({
        device_id: deviceId,
        neighborhood_index: index,
        unlocked_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('unlocks').upsert(rows, { onConflict: 'device_id,neighborhood_index' });
      if (error) throw error;
    } else if (productId === 'dream_dlc') {
      const { error } = await supabase.from('unlocks').upsert(
        [
          { device_id: deviceId, neighborhood_index: 31, unlocked_at: new Date().toISOString() },
          { device_id: deviceId, neighborhood_index: 32, unlocked_at: new Date().toISOString() },
        ],
        { onConflict: 'device_id,neighborhood_index' },
      );
      if (error) throw error;
    }

    const unlocks = await getUnlockIndexes(deviceId);
    return ok(res, { verified: true, productId, unlocks, expireAt: verified.expireAt });
  } catch (err) {
    return fail(res, err);
  }
});

app.get('/internal/stats', async (req, res) => {
  try {
    if (!env.adminApiKey || req.headers['x-admin-key'] !== env.adminApiKey) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid admin key');
    }
    const { data, error } = await supabase.from('stats').select('neighborhood_index,total_duration,story_discoveries');
    if (error) throw error;

    const grouped = new Map();
    for (const row of data) {
      const key = row.neighborhood_index;
      if (!grouped.has(key)) grouped.set(key, { visits: 0, totalDuration: 0, storyDiscoveries: 0 });
      const item = grouped.get(key);
      item.visits += 1;
      item.totalDuration += row.total_duration;
      item.storyDiscoveries += row.story_discoveries;
    }

    const result = [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([neighborhoodIndex, v]) => ({
        neighborhoodIndex,
        avgDurationSeconds: v.visits ? Math.round(v.totalDuration / v.visits) : 0,
        storyDiscoveryRate: v.visits ? Number((v.storyDiscoveries / v.visits).toFixed(2)) : 0,
      }));

    return ok(res, { stats: result });
  } catch (err) {
    return fail(res, err);
  }
});

app.use((err, _req, res, _next) => fail(res, err));

export default app;
