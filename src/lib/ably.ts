import Ably from 'ably';
import { maskPhoneNumber } from './domain';

const ablyKey = process.env.ABLY_API_KEY || process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY;

let ablyRest: Ably.Rest | null = null;

if (ablyKey) {
  try {
    ablyRest = new Ably.Rest(ablyKey);
  } catch (err) {
    console.error('Failed to initialize Ably REST client:', err);
  }
}

/**
 * Recursively sanitize any payload to ensure no raw phone numbers or credentials are broadcast
 */
function sanitizeAblyPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeAblyPayload);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'customer_phone' || key === 'phone' || key === 'customerPhone') {
      clean[key] = typeof value === 'string' && value ? maskPhoneNumber(value) : null;
    } else if (key === 'admin_passcode' || key === 'passcode' || key === 'superadmin_secret' || key === 'secret') {
      // Completely strip sensitive credentials
      continue;
    } else if (value && typeof value === 'object') {
      clean[key] = sanitizeAblyPayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Publish a real-time event to Ably channel `queue:<streamId>`
 */
export async function publishQueueUpdate(
  streamId: string,
  event: 'TOKEN_CALLED' | 'TOKEN_ADDED' | 'TOKEN_UPDATED' | 'STREAM_UPDATED' | 'EMERGENCY_CALL' | string,
  payload: Record<string, any>
) {
  if (!ablyRest || !streamId) {
    return;
  }

  try {
    const channel = ablyRest.channels.get(`queue:${streamId}`);
    const safePayload = sanitizeAblyPayload(payload);

    await channel.publish(event, {
      ...safePayload,
      streamId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[ABLY PUBLISH ERROR] Failed to publish ${event} on queue:${streamId}:`, err);
  }
}
