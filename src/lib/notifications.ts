/**
 * SMS alerts have been permanently disabled per system requirements.
 * Real-time queue notifications are delivered via Web Push, Live Pass Audio, and Ably WebSockets.
 */
export async function sendSMS({ to, message }: { to: string; message: string }) {
  // SMS feature is disabled. No external SMS gateways called.
  return;
}

/**
 * Trigger: It's Your Turn (Handled via Web Push & Customer Mobile Audio)
 */
export async function notifyNowServing(customerName: string, phone: string, tokenNumber: number) {
  // SMS disabled
  return;
}

/**
 * Trigger: Upcoming Turn Alert (2-3 spots away)
 */
export async function notifyUpcomingTurn(customerName: string, phone: string, tokenNumber: number, spotsAhead: number) {
  // SMS disabled
  return;
}

/**
 * Trigger: Queue Delay Drift Alert
 */
export async function notifyDelayDrift(
  customerName: string,
  phone: string,
  tokenNumber: number,
  newEtaMins: number,
  delayMins: number
) {
  // SMS disabled
  return;
}