// Environment credentials (optional in dev)
const httpSmsKey = process.env.HTTPSMS_API_KEY;
const httpSmsFrom = process.env.HTTPSMS_FROM_NUMBER;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send SMS Alert (Supports httpSMS Android Gateway, Twilio, or Dev Mock)
 */
export async function sendSMS({ to, message }: { to: string; message: string }) {
  if (!to) return;

  const formattedTo = to.startsWith('+') ? to : `+91${to.replace(/\D/g, '')}`;

  // 1. httpSMS Android SIM Gateway Priority
  if (httpSmsKey && httpSmsFrom) {
    try {
      const res = await fetch('https://api.httpsms.com/v1/messages/send', {
        method: 'POST',
        headers: {
          'x-api-key': httpSmsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: httpSmsFrom,
          to: formattedTo,
          content: message,
        }),
      });

      const json = await res.json();
      if (res.ok && (json.status === 'success' || json.data)) {
        console.log(`[HTTPSMS SENT via ${httpSmsFrom}] to ${formattedTo}`);
      } else {
        console.error(`[HTTPSMS FAILED] to ${formattedTo}:`, json);
      }
    } catch (err) {
      console.error(`[HTTPSMS ERROR] to ${formattedTo}:`, err);
    }
  }
  // 2. Twilio Gateway Priority
  else if (accountSid && authToken && fromPhone) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        From: fromPhone,
        To: formattedTo,
        Body: message,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (res.ok) {
        console.log(`[SMS SENT] to ${formattedTo}`);
      } else {
        const errJson = await res.json();
        console.error(`[SMS FAILED] to ${formattedTo}:`, errJson);
      }
    } catch (err) {
      console.error(`[SMS FAILED] to ${formattedTo}:`, err);
    }
  }
  // 3. Dev Mock Priority
  else {
    console.log(`\n📲 [DEV MOCK SMS to ${formattedTo}]: "${message}"\n`);
  }
}

/**
 * Trigger: It's Your Turn
 */
export async function notifyNowServing(customerName: string, phone: string, tokenNumber: number) {
  const msg = `Hi ${customerName}! Your token #${tokenNumber} is NOW SERVING. Please proceed to the counter/reception immediately. - noQ`;
  await sendSMS({ to: phone, message: msg });
}

/**
 * Trigger: Upcoming Turn Alert (2-3 spots away)
 */
export async function notifyUpcomingTurn(customerName: string, phone: string, tokenNumber: number, spotsAhead: number) {
  const msg = `Hi ${customerName}! You are now ${spotsAhead} spots away (Token #${tokenNumber}). Please start heading towards the waiting area. - noQ`;
  await sendSMS({ to: phone, message: msg });
}

/**
 * Fix #6 — Trigger: Queue Delay Drift Alert
 *
 * Per spec: fires when the current session overruns by more than 15 minutes,
 * warning all waiting customers that their ETA has shifted significantly.
 * Called from the ETA engine whenever delay_mins crosses the 15-min threshold.
 *
 * @param customerName  - Name of the waiting patient
 * @param phone         - Phone number to SMS
 * @param tokenNumber   - Their assigned token number
 * @param newEtaMins    - Revised estimated wait in minutes
 * @param delayMins     - How many minutes the current session has overrun
 */
export async function notifyDelayDrift(
  customerName: string,
  phone: string,
  tokenNumber: number,
  newEtaMins: number,
  delayMins: number
) {
  const msg = `Hi ${customerName} (Token #${tokenNumber}), the queue is running ~${delayMins} min behind schedule. Your updated estimated wait is ~${newEtaMins} min. Apologies for the delay. - noQ`;
  await sendSMS({ to: phone, message: msg });
}