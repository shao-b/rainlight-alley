import type {
  ApiService,
  RegisterResponse,
  StatsPayload,
  StoryPayload,
  UnlocksResponse,
  VerifyPurchasePayload,
  VerifyPurchaseResponse,
} from '../types/api';
import { mockApiService } from './mock';

class ApiError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getApiBaseUrl(): string | null {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.replace(/\/$/, '');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError('Missing VITE_API_BASE_URL', 0);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

const httpApiService: ApiService = {
  register(deviceId: string): Promise<RegisterResponse> {
    return request<RegisterResponse>('/api/register', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
  },

  getUnlocks(deviceId: string): Promise<UnlocksResponse> {
    return request<UnlocksResponse>(`/api/unlocks/${deviceId}`);
  },

  postStory(payload: StoryPayload): Promise<void> {
    return request<void>('/api/story', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  postStats(payload: StatsPayload): Promise<void> {
    return request<void>('/api/stats', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyPurchase(payload: VerifyPurchasePayload): Promise<VerifyPurchaseResponse> {
    return request<VerifyPurchaseResponse>('/api/verify-purchase', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

const useMock = !getApiBaseUrl();

export const apiService: ApiService = useMock ? mockApiService : httpApiService;
