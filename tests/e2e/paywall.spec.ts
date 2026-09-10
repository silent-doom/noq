/**
 * E2E Test: Paywall Guard — Slot Booking
 *
 * Dedicated isolation tests verifying the paywall:
 * - Businesses without slot addon have ZERO slot UI visible to customers
 * - The `/api/slots/available` endpoint returns empty when addon disabled
 * - The booking page maintains correct single-tab layout
 */

import { test, expect } from '@playwright/test';

const STREAM_NO_SLOT = process.env.STREAM_ID_NO_SLOT || '9929870b-582b-40ef-909a-f885d609d94b';
const SUPERADMIN_KEY = process.env.SUPERADMIN_KEY || 'noq-vault-9842-x7k9p-mstr';
const BASE = 'http://localhost:3000';

async function ensureSlotDisabled(streamId: string) {
  const streamRes = await fetch(`${BASE}/api/queue/stream/${streamId}`);
  const streamJson = await streamRes.json();
  const businessId = streamJson.stream?.business_id;
  if (!businessId) return;

  await fetch(`${BASE}/api/superadmin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-superadmin-key': SUPERADMIN_KEY },
    body: JSON.stringify({ action: 'DISABLE_SLOT_ADDON', businessId }),
  });
}

test.beforeEach(async () => {
  await ensureSlotDisabled(STREAM_NO_SLOT);
});

test('PW-1: Booking page shows exactly 1 tab when slot addon disabled', async ({ page }) => {
  await page.goto(`${BASE}/book/${STREAM_NO_SLOT}`);
  await page.waitForSelector('#booking-mode-selector', { timeout: 10000 });

  const allTabs = await page.locator('#booking-mode-selector button').all();
  expect(allTabs).toHaveLength(1);
  expect(await allTabs[0].textContent()).toContain('Join Live Queue');
});

test('PW-2: "Book a Slot" tab element is absent from the DOM (not just hidden)', async ({ page }) => {
  await page.goto(`${BASE}/book/${STREAM_NO_SLOT}`);
  await page.waitForSelector('#booking-mode-selector', { timeout: 10000 });

  const slotTab = page.locator('#tab-book-slot');
  await expect(slotTab).toHaveCount(0);
});

test('PW-3: Slot calendar section is not present in DOM when addon disabled', async ({ page }) => {
  await page.goto(`${BASE}/book/${STREAM_NO_SLOT}`);
  await page.waitForSelector('#booking-mode-selector', { timeout: 10000 });

  await expect(page.locator('#slot-booking-section')).toHaveCount(0);
  await expect(page.locator('#date-strip')).toHaveCount(0);
  await expect(page.locator('#slot-grid')).toHaveCount(0);
});

test('PW-4: API /slots/available returns empty array when addon disabled', async () => {
  const today = new Date().toISOString().substring(0, 10);
  const res = await fetch(`${BASE}/api/slots/available?streamId=${STREAM_NO_SLOT}&date=${today}`);
  const json = await res.json();

  expect(res.ok).toBe(true);
  expect(json.success).toBe(true);
  expect(json.slots).toEqual([]);
  expect(json.count).toBe(0);
});

test('PW-5: Slot booking POST returns 400 when addon disabled', async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const res = await fetch(`${BASE}/api/slots/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      streamId: STREAM_NO_SLOT,
      customerName: 'Paywall Test',
      customerPhone: '5555555555',
      slotDate: tomorrow,
      slotTime: '10:00',
    }),
  });
  const json = await res.json();

  expect(res.ok).toBe(false);
  expect(json.success).toBe(false);
  expect(json.error).toContain('not enabled');
});

test('PW-6: /api/slots/config returns slotBookingEnabled=false', async () => {
  const res = await fetch(`${BASE}/api/slots/config?streamId=${STREAM_NO_SLOT}`);
  const json = await res.json();

  expect(json.success).toBe(true);
  expect(json.slotBookingEnabled).toBe(false);
});

test('PW-7: Live queue booking still works normally on a no-slot business', async ({ page }) => {
  await page.goto(`${BASE}/book/${STREAM_NO_SLOT}`);
  await page.waitForSelector('#tab-live-queue', { timeout: 10000 });

  // The live queue form should be rendered and interactive
  const nameInput = page.locator('input[placeholder*="Name"], input[placeholder*="Rahul"]');
  await expect(nameInput).toBeVisible();

  const phoneInput = page.locator('input[type="tel"]');
  await expect(phoneInput).toBeVisible();

  const submitBtn = page.locator('#btn-join-queue');
  await expect(submitBtn).toBeVisible();
  await expect(submitBtn).toBeDisabled(); // Disabled until name+phone filled
});
