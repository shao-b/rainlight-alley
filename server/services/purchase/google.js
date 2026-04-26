import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http.js';
import { withRetry } from '../../lib/retry.js';

function parseServiceAccount() {
  if (!env.googleServiceAccountJson) {
    throw new HttpError(400, 'GOOGLE_SERVICE_ACCOUNT_MISSING', 'GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
  }
  try {
    return JSON.parse(env.googleServiceAccountJson);
  } catch {
    throw new HttpError(400, 'GOOGLE_SERVICE_ACCOUNT_INVALID', 'GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON');
  }
}

export async function verifyGooglePurchase({ receiptData, productId }) {
  if (!env.googlePackageName) {
    throw new HttpError(400, 'GOOGLE_PACKAGE_MISSING', 'GOOGLE_PACKAGE_NAME is not configured');
  }
  const serviceAccount = parseServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const publisher = google.androidpublisher({ version: 'v3', auth: client });

  const token = receiptData;
  const isSubscription = productId === 'dream_dlc';

  if (isSubscription) {
    const response = await withRetry(() =>
      publisher.purchases.subscriptions.get({
        packageName: env.googlePackageName,
        subscriptionId: productId,
        token,
      }),
    );
    const item = response.data;
    if (!item.expiryTimeMillis) {
      throw new HttpError(400, 'GOOGLE_SUBSCRIPTION_INVALID', 'Subscription response missing expiry');
    }
    return {
      raw: item,
      expireAt: new Date(Number(item.expiryTimeMillis)).toISOString(),
      transactionId: item.orderId ?? token,
    };
  }

  const response = await withRetry(() =>
    publisher.purchases.products.get({
      packageName: env.googlePackageName,
      productId,
      token,
    }),
  );
  const item = response.data;
  if (item.purchaseState !== 0) {
    throw new HttpError(400, 'GOOGLE_PRODUCT_NOT_PURCHASED', 'Product purchase is not completed');
  }
  return {
    raw: item,
    expireAt: null,
    transactionId: item.orderId ?? token,
  };
}
