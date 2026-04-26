export interface RegisterResponse {
  deviceId: string;
  createdAt: string;
}

export interface UnlocksResponse {
  deviceId: string;
  unlocks: number[];
}

export interface StoryPayload {
  deviceId: string;
  neighborhoodIndex: number;
  storyId: string;
}

export interface StatsPayload {
  deviceId: string;
  neighborhoodIndex: number;
  durationSeconds: number;
}

export interface VerifyPurchasePayload {
  deviceId: string;
  productId: string;
  receiptData: string;
  platform: 'ios' | 'android';
}

export interface VerifyPurchaseResponse {
  success: boolean;
  message: string;
  unlocks: number[];
}

export interface ApiService {
  register(deviceId: string): Promise<RegisterResponse>;
  getUnlocks(deviceId: string): Promise<UnlocksResponse>;
  postStory(payload: StoryPayload): Promise<void>;
  postStats(payload: StatsPayload): Promise<void>;
  verifyPurchase(payload: VerifyPurchasePayload): Promise<VerifyPurchaseResponse>;
}
