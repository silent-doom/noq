import Ably from 'ably';

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
 * Publish a real-time event to Ably channel `queue:<streamId>`
 */
export async function publishQueueUpdate(
  streamId: string,
  event: 'TOKEN_CALLED' | 'TOKEN_ADDED' | 'TOKEN_UPDATED' | 'STREAM_UPDATED' | string,
  payload: Record<string, any>
) {
  if (!ablyRest || !streamId) {
    return;
  }

  try {
    const channel = ablyRest.channels.get(`queue:${streamId}`);
    await channel.publish(event, {
      ...payload,
      streamId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[ABLY PUBLISH ERROR] Failed to publish ${event} on queue:${streamId}:`, err);
  }
}
