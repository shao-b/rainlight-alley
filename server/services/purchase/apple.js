import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http.js';
import { withRetry } from '../../lib/retry.js';

const PROD_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

async function callApple(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new HttpError(502, 'APPLE_VERIFY_HTTP_ERROR', `Apple verify failed: ${response.status}`);
  }
  return response.json();
}

export async function verifyAppleReceipt({ receiptData, productId }) {
  if (!env.appleSharedSecret) {
    throw new HttpError(400, 'APPLE_SECRET_MISSING', 'APPLE_SHARED_SECRET is not configured');
  }
  const body = {
    'receipt-data': receiptData,
    password: env.appleSharedSecret,
    'exclude-old-transactions': true,
  };
  const first = await withRetry(() => callApple(PROD_URL, body));
  const result = first.status === 21007 ? await withRetry(() => callApple(SANDBOX_URL, body)) : first;
  if (result.status !== 0) {
    throw new HttpError(400, 'APPLE_VERIFY_FAILED', `Apple receipt invalid, status=${result.status}`);
  }

  const latest = result.latest_receipt_info?.[0];
  const inApp = result.receipt?.in_app ?? [];
  const hasProduct = inApp.some((item) => item.product_id === productId) || latest?.product_id === productId;
  if (!hasProduct) {
    throw new HttpError(400, 'APPLE_PRODUCT_MISMATCH', 'Receipt does not include requested product');
  }

  return {
    raw: result,
    expireAt: latest?.expires_date_ms ? new Date(Number(latest.expires_date_ms)).toISOString() : null,
    transactionId: latest?.transaction_id ?? inApp[0]?.transaction_id ?? null,
  };
}
