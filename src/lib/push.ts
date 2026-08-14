import webpush from 'web-push';
import { redis } from '@/lib/redis';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:support@noq.app';

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error('Failed to configure web-push VAPID details:', err);
  }
}

/**
 * Save browser PushSubscription for a specific tokenId in Upstash Redis
 */
export async function savePushSubscription(tokenId: string, subscription: any) {
  if (!tokenId || !subscription) return;
  try {
    const key = `push:sub:${tokenId}`;
    await redis.set(key, JSON.stringify(subscription), { ex: 86400 * 7 }); // expire after 7 days
    console.log(`[PUSH REGISTRATION SUCCESS] Saved push sub for token ${tokenId}`);
  } catch (err) {
    console.error(`[PUSH REGISTRATION ERROR] Failed to save sub for token ${tokenId}:`, err);
  }
}

/**
 * Dispatch Lock-Screen Web Push Notification to a customer device
 */
export async function sendTokenPushNotification({
  tokenId,
  title,
  body,
  url,
}: {
  tokenId: string;
  title: string;
  body: string;
  url: string;
}) {
  if (!tokenId || !publicKey || !privateKey) return;

  try {
    const key = `push:sub:${tokenId}`;
    const rawSub = await redis.get(key);

    if (!rawSub) {
      return;
    }

    const subscription = typeof rawSub === 'string' ? JSON.parse(rawSub) : rawSub;
    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/favicon.ico',
    });

    await webpush.sendNotification(subscription, payload);
    console.log(`[LOCK-SCREEN PUSH DELIVERED] to token ${tokenId}`);
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      // Subscription has expired or unregistered -> remove from Redis
      try {
        await redis.del(`push:sub:${tokenId}`);
      } catch (e) {}
    } else {
      console.error(`[LOCK-SCREEN PUSH ERROR] Failed to send push to token ${tokenId}:`, err);
    }
  }
}
