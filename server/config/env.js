import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

function required(name, fallback = '') {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '8787')),
  appBaseUrl: optional('APP_BASE_URL', ''),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required(
    'SUPABASE_SERVICE_ROLE_KEY',
    optional('SUPABASE_ANON_KEY', ''),
  ),
  appleSharedSecret: optional('APPLE_SHARED_SECRET', ''),
  appleBundleId: optional('APPLE_BUNDLE_ID', ''),
  googlePackageName: optional('GOOGLE_PACKAGE_NAME', ''),
  googleServiceAccountJson: optional('GOOGLE_SERVICE_ACCOUNT_JSON', ''),
  fcmServiceAccountJson: optional('FCM_SERVICE_ACCOUNT_JSON', ''),
  adminApiKey: optional('ADMIN_API_KEY', ''),
  unlockTotalNeighborhoods: Number(optional('UNLOCK_TOTAL_NEIGHBORHOODS', '30')),
  timezone: optional('UNLOCK_TIMEZONE', 'Asia/Shanghai'),
};
