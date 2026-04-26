import admin from 'firebase-admin';
import { env } from '../config/env.js';

let initialized = false;

function tryInit() {
  if (initialized) return true;
  if (!env.fcmServiceAccountJson) return false;
  try {
    const credential = JSON.parse(env.fcmServiceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(credential) });
    initialized = true;
    return true;
  } catch (err) {
    console.warn('FCM init skipped:', err.message);
    return false;
  }
}

export async function sendUnlockPush(token, districtIndex) {
  if (!token) return;
  if (!tryInit()) return;
  await admin.messaging().send({
    token,
    notification: {
      title: '雨光巷',
      body: `新街区已开放：第 ${districtIndex} 区`,
    },
    data: { districtIndex: String(districtIndex) },
  });
}
