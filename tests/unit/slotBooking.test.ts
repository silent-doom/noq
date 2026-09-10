import { generateTimeSlots, formatTimeLabel, getAvailableSlots } from '@/lib/slotBooking';
import { describe, it, expect } from 'vitest';

// ─── generateTimeSlots ────────────────────────────────────────────────────────

describe('generateTimeSlots', () => {
  it('generates 30-min slots between 10:00 and 13:00', () => {
    const slots = generateTimeSlots('10:00', '13:00', 30);
    expect(slots).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00', '12:30']);
  });

  it('generates 15-min slots between 09:00 and 09:45', () => {
    const slots = generateTimeSlots('09:00', '09:45', 15);
    expect(slots).toEqual(['09:00', '09:15', '09:30']);
  });

  it('generates 60-min slots between 10:00 and 17:00', () => {
    const slots = generateTimeSlots('10:00', '17:00', 60);
    expect(slots).toEqual(['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
  });

  it('returns empty array when open_time equals close_time', () => {
    const slots = generateTimeSlots('10:00', '10:00', 30);
    expect(slots).toEqual([]);
  });

  it('returns empty array when open_time is after close_time', () => {
    const slots = generateTimeSlots('14:00', '10:00', 30);
    expect(slots).toEqual([]);
  });

  it('handles midnight boundary (00:00 to 01:00)', () => {
    const slots = generateTimeSlots('00:00', '01:00', 30);
    expect(slots).toEqual(['00:00', '00:30']);
  });

  it('does not include the close_time itself (exclusive upper bound)', () => {
    const slots = generateTimeSlots('10:00', '11:00', 30);
    expect(slots).not.toContain('11:00');
    expect(slots).toEqual(['10:00', '10:30']);
  });
});

// ─── formatTimeLabel ──────────────────────────────────────────────────────────

describe('formatTimeLabel', () => {
  it('formats 10:00 as 10:00 AM', () => {
    expect(formatTimeLabel('10:00')).toBe('10:00 AM');
  });

  it('formats 00:00 as 12:00 AM', () => {
    expect(formatTimeLabel('00:00')).toBe('12:00 AM');
  });

  it('formats 12:00 as 12:00 PM', () => {
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
  });

  it('formats 13:30 as 1:30 PM', () => {
    expect(formatTimeLabel('13:30')).toBe('1:30 PM');
  });

  it('formats 23:59 as 11:59 PM', () => {
    expect(formatTimeLabel('23:59')).toBe('11:59 PM');
  });

  it('formats 09:05 with leading zero for minutes', () => {
    expect(formatTimeLabel('09:05')).toBe('9:05 AM');
  });
});

// ─── getAvailableSlots edge cases (pure logic, mocked DB) ────────────────────

describe('slot boundary logic (derived from generateTimeSlots)', () => {
  it('does not generate slots past close time for 30-min duration', () => {
    // 10:00 - 17:00, 30 min: last slot should be 16:30, not 17:00
    const slots = generateTimeSlots('10:00', '17:00', 30);
    expect(slots[slots.length - 1]).toBe('16:30');
    expect(slots).not.toContain('17:00');
  });

  it('generates correct count of slots', () => {
    // 10:00 - 17:00 = 7 hours = 420 mins / 30 = 14 slots
    const slots = generateTimeSlots('10:00', '17:00', 30);
    expect(slots).toHaveLength(14);
  });

  it('generates correct count with 60-min slots', () => {
    // 09:00 - 17:00 = 8 hours = 8 slots
    const slots = generateTimeSlots('09:00', '17:00', 60);
    expect(slots).toHaveLength(8);
  });
});
