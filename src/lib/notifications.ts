/**
 * Real-time queue notifications are delivered directly to devices via:
 * 1. Native OS Lock-Screen Web Push (VAPID Service Worker)
 * 2. Mobile Browser Voice Announcements & Dual-Tone Chimes
 * 3. Ably Realtime WebSocket Pub/Sub
 */

export async function notifyNowServing(customerName: string, phone: string, tokenNumber: number) {
  // Handled via Ably stream broadcast and Web Push
  return;
}

export async function notifyUpcomingTurn(customerName: string, phone: string, tokenNumber: number, spotsAhead: number) {
  // Handled via Ably stream broadcast and Web Push
  return;
}

export async function notifyDelayDrift(
  customerName: string,
  phone: string,
  tokenNumber: number,
  newEtaMins: number,
  delayMins: number
) {
  // Handled via Ably stream broadcast and Web Push
  return;
}