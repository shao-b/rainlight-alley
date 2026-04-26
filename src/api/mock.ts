import type {
  ApiService,
  RegisterResponse,
  StatsPayload,
  StoryPayload,
  UnlocksResponse,
  VerifyPurchasePayload,
  VerifyPurchaseResponse,
} from '../types/api';

const CREATED_AT_PREFIX = 'rainlight.device_created_at.';
const UNLOCKS_PREFIX = 'rainlight.unlocks.';
const STORIES_PREFIX = 'rainlight.stories.';
const STATS_PREFIX = 'rainlight.stats.';

function seedUnlocks(deviceId: string): number[] {
  const key = `${UNLOCKS_PREFIX}${deviceId}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    return JSON.parse(existing) as number[];
  }

  const initial = [1, 2];
  localStorage.setItem(key, JSON.stringify(initial));
  return initial;
}

function storeCreatedAt(deviceId: string): string {
  const key = `${CREATED_AT_PREFIX}${deviceId}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const createdAt = new Date().toISOString();
  localStorage.setItem(key, createdAt);
  return createdAt;
}

async function delay(ms = 200): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function readUnlocks(deviceId: string): number[] {
  return seedUnlocks(deviceId);
}

function writeUnlocks(deviceId: string, unlocks: number[]): void {
  const key = `${UNLOCKS_PREFIX}${deviceId}`;
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(unlocks)).sort((a, b) => a - b)));
}

export const mockApiService: ApiService = {
  async register(deviceId: string): Promise<RegisterResponse> {
    await delay();
    return {
      deviceId,
      createdAt: storeCreatedAt(deviceId),
    };
  },

  async getUnlocks(deviceId: string): Promise<UnlocksResponse> {
    await delay();
    return {
      deviceId,
      unlocks: seedUnlocks(deviceId),
    };
  },

  async postStory(payload: StoryPayload): Promise<void> {
    await delay(120);
    const key = `${STORIES_PREFIX}${payload.deviceId}`;
    const existing = localStorage.getItem(key);
    const stories = existing ? (JSON.parse(existing) as StoryPayload[]) : [];
    stories.push(payload);
    localStorage.setItem(key, JSON.stringify(stories));
  },

  async postStats(payload: StatsPayload): Promise<void> {
    await delay(120);
    const key = `${STATS_PREFIX}${payload.deviceId}`;
    const existing = localStorage.getItem(key);
    const stats = existing ? (JSON.parse(existing) as StatsPayload[]) : [];
    stats.push(payload);
    localStorage.setItem(key, JSON.stringify(stats));
  },

  async verifyPurchase(payload: VerifyPurchasePayload): Promise<VerifyPurchaseResponse> {
    await delay(400);
    const currentUnlocks = readUnlocks(payload.deviceId);
    if (payload.productId === 'complete_city') {
      writeUnlocks(payload.deviceId, [...currentUnlocks, ...Array.from({ length: 30 }, (_, i) => i + 1)]);
      return {
        success: true,
        message: 'Mock purchase verified: Complete City unlocked.',
        unlocks: readUnlocks(payload.deviceId),
      };
    }

    if (payload.productId === 'dream_dlc') {
      writeUnlocks(payload.deviceId, [...currentUnlocks, 31, 32]);
      return {
        success: true,
        message: 'Mock subscription verified: Dream DLC districts unlocked.',
        unlocks: readUnlocks(payload.deviceId),
      };
    }

    return {
      success: false,
      message: `Mock purchase failed: unknown product ${payload.productId}.`,
      unlocks: currentUnlocks,
    };
  },
};
