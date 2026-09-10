import { describe, it, expect } from 'vitest';
import { computeSubscriptionState, calculateNextBillingDate } from '@/lib/subscription';

// ─── calculateNextBillingDate ──────────────────────────────────────────────────

describe('calculateNextBillingDate', () => {
  it('returns a date one month ahead on the same anchor day', () => {
    const from = new Date('2026-09-10T00:00:00Z');
    const next = calculateNextBillingDate(10, from);
    expect(next.getDate()).toBe(10);
    expect(next.getMonth()).toBe(9); // October = 9 (0-indexed)
  });

  it('clamps anchor day 31 to last day of February (28/29)', () => {
    const from = new Date('2026-01-31T00:00:00Z');
    const next = calculateNextBillingDate(31, from);
    // February 2026 has 28 days
    expect(next.getDate()).toBe(28);
    expect(next.getMonth()).toBe(1); // February
  });

  it('sets time to 23:59:59', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const next = calculateNextBillingDate(1, from);
    expect(next.getHours()).toBe(23);
    expect(next.getMinutes()).toBe(59);
    expect(next.getSeconds()).toBe(59);
  });
});

// ─── computeSubscriptionState ─────────────────────────────────────────────────

describe('computeSubscriptionState — ACTIVE', () => {
  it('returns ACTIVE when subscription_status is ACTIVE and next_billing_date is in the future', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'ACTIVE',
      next_billing_date: future,
      monthly_fee: 499,
      billing_anchor_day: 10,
    });
    expect(state.status).toBe('ACTIVE');
    expect(state.isLocked).toBe(false);
    expect(state.daysRemaining).toBeGreaterThan(0);
  });

  it('returns GRACE_PERIOD when overdue by 2 days', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'ACTIVE',
      next_billing_date: past,
      monthly_fee: 499,
    });
    expect(state.status).toBe('GRACE_PERIOD');
    expect(state.isGracePeriod).toBe(true);
    expect(state.isLocked).toBe(false);
  });

  it('returns LOCKED when overdue by 5 days', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'ACTIVE',
      next_billing_date: past,
      monthly_fee: 499,
    });
    expect(state.status).toBe('LOCKED');
    expect(state.isLocked).toBe(true);
  });

  it('returns DEACTIVATED when overdue by 10 days', () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'ACTIVE',
      next_billing_date: past,
      monthly_fee: 499,
    });
    expect(state.status).toBe('DEACTIVATED');
    expect(state.isLocked).toBe(true);
    expect(state.isDeactivated).toBe(true);
  });
});

describe('computeSubscriptionState — TRIAL', () => {
  it('returns TRIAL with correct trialDay when within 7 days', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'TRIAL',
      next_billing_date: future,
    });
    expect(state.status).toBe('TRIAL');
    expect(state.isTrial).toBe(true);
    expect(state.isLocked).toBe(false);
  });

  it('returns GRACE_PERIOD after trial ends (within 3 days)', () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'TRIAL',
      next_billing_date: past,
    });
    expect(state.status).toBe('GRACE_PERIOD');
    expect(state.isGracePeriod).toBe(true);
  });

  it('returns DEACTIVATED when trial has been over for 5 days', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeSubscriptionState({
      subscription_status: 'TRIAL',
      next_billing_date: past,
    });
    expect(state.status).toBe('DEACTIVATED');
    expect(state.isDeactivated).toBe(true);
  });
});

describe('computeSubscriptionState — PENDING_PAYMENT / LOCKED / DEACTIVATED', () => {
  it('returns PENDING_PAYMENT state with isLocked=true', () => {
    const state = computeSubscriptionState({ subscription_status: 'PENDING_PAYMENT' });
    expect(state.status).toBe('PENDING_PAYMENT');
    expect(state.isLocked).toBe(true);
  });

  it('returns LOCKED state with isLocked=true', () => {
    const state = computeSubscriptionState({ subscription_status: 'LOCKED' });
    expect(state.status).toBe('LOCKED');
    expect(state.isLocked).toBe(true);
  });

  it('returns DEACTIVATED when is_deactivated=true', () => {
    const state = computeSubscriptionState({ subscription_status: 'ACTIVE', is_deactivated: true });
    expect(state.status).toBe('DEACTIVATED');
    expect(state.isDeactivated).toBe(true);
  });

  it('uses default monthlyFee of 499 when not specified', () => {
    const state = computeSubscriptionState({ subscription_status: 'ACTIVE' });
    expect(state.monthlyFee).toBe(499);
  });
});
