const DEVICE_ID_KEY = 'rainlight.device_id';

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}
