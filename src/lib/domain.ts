export interface DomainTerminology {
  category: string;
  guestTerm: string;
  guestTermPlural: string;
  providerTerm: string;
  paceTerm: string;
  queueTitle: string;
  atRestStatus: string;
  noGuestMessage: string;
}

export function getDomainTerminology(category?: string): DomainTerminology {
  const norm = (category || '').toUpperCase().trim();

  if (norm === 'MEDICAL_OPD' || norm === 'DENTAL' || norm === 'DIAGNOSTIC' || norm.includes('CLINIC') || norm.includes('HEALTH') || norm.includes('DOCTOR')) {
    return {
      category: 'MEDICAL_OPD',
      guestTerm: 'Patient',
      guestTermPlural: 'Patients',
      providerTerm: 'Doctor / Specialist',
      paceTerm: 'Consultation Pace (Mins / Patient)',
      queueTitle: 'Main OPD Queue',
      atRestStatus: 'Doctor at Rest — Ready for Next Patient',
      noGuestMessage: 'No patient currently serving',
    };
  }

  if (norm === 'RESTAURANT' || norm.includes('HOTEL') || norm.includes('DINER') || norm.includes('FOOD') || norm.includes('CAFE')) {
    return {
      category: 'RESTAURANT',
      guestTerm: 'Diner',
      guestTermPlural: 'Guests',
      providerTerm: 'Table / Server',
      paceTerm: 'Table Turn Pace (Mins / Party)',
      queueTitle: 'Dining Waiting List',
      atRestStatus: 'Tables Clear & Ready — Counter at Rest',
      noGuestMessage: 'No active guest table',
    };
  }

  if (norm === 'SALON' || norm.includes('SPA') || norm.includes('BARBER') || norm.includes('BEAUTY')) {
    return {
      category: 'SALON',
      guestTerm: 'Client',
      guestTermPlural: 'Clients',
      providerTerm: 'Stylist / Specialist',
      paceTerm: 'Service Duration (Mins / Client)',
      queueTitle: 'Styling & Service Queue',
      atRestStatus: 'Stylist Station at Rest — Ready for Next Client',
      noGuestMessage: 'No active client in session',
    };
  }

  // Default RETAIL / OTHER / General
  return {
    category: 'RETAIL',
    guestTerm: 'Customer',
    guestTermPlural: 'Customers',
    providerTerm: 'Service Counter',
    paceTerm: 'Service Pace (Mins / Customer)',
    queueTitle: 'Main Service Queue',
    atRestStatus: 'Service Counter at Rest — Ready for Next Customer',
    noGuestMessage: 'No customer currently serving',
  };
}

export function formatWaitTime(totalMins: number): string {
  if (!totalMins || totalMins <= 0) return '0 min';
  if (totalMins <= 59) return `${totalMins} min`;

  const hrs = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;
  const hrLabel = hrs === 1 ? 'hr' : 'hrs';

  if (remainingMins === 0) {
    return `${hrs} ${hrLabel}`;
  }

  return `${hrs} ${hrLabel} ${remainingMins} min`;
}

export function generateDomainStations(category?: string, stationCounts?: Record<string, number>): string[] {
  const norm = (category || '').toUpperCase().trim();
  const stations: string[] = [];

  if (norm === 'MEDICAL_OPD' || norm === 'DENTAL' || norm === 'DIAGNOSTIC' || norm.includes('CLINIC') || norm.includes('HEALTH') || norm.includes('DOCTOR')) {
    const consultRooms = Math.max(1, stationCounts?.consultationRooms || 2);
    const examBeds = Math.max(0, stationCounts?.examBeds || 1);
    for (let i = 1; i <= consultRooms; i++) stations.push(`Doctor Room ${i}`);
    for (let i = 1; i <= examBeds; i++) stations.push(`Exam Bed ${i}`);
    return stations;
  }

  if (norm === 'SALON' || norm.includes('SPA') || norm.includes('BARBER') || norm.includes('BEAUTY')) {
    const chairs = Math.max(1, stationCounts?.stylingChairs || 3);
    const basins = Math.max(0, stationCounts?.washBasins || 1);
    for (let i = 1; i <= chairs; i++) stations.push(`Stylist Chair ${i}`);
    for (let i = 1; i <= basins; i++) stations.push(`Wash Station ${i}`);
    return stations;
  }

  if (norm === 'RESTAURANT' || norm.includes('HOTEL') || norm.includes('DINER') || norm.includes('FOOD') || norm.includes('CAFE')) {
    const tables = Math.max(1, stationCounts?.hostTables || 2);
    const express = Math.max(0, stationCounts?.expressCounters || 1);
    for (let i = 1; i <= tables; i++) stations.push(`Host Station ${i}`);
    for (let i = 1; i <= express; i++) stations.push(`Express Pickup ${i}`);
    return stations;
  }

  const counters = Math.max(1, stationCounts?.counters || 3);
  for (let i = 1; i <= counters; i++) stations.push(`Counter ${i}`);
  return stations;
}

export function generateAvailableTimeSlots(
  openingTime: string = '09:00',
  closingTime: string = '20:00',
  stepMins: number = 30
): string[] {
  const slots: string[] = [];
  try {
    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);

    let current = (openH || 9) * 60 + (openM || 0);
    const end = (closeH || 20) * 60 + (closeM || 0);

    while (current + stepMins <= end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = m < 10 ? `0${m}` : `${m}`;
      slots.push(`${displayH}:${displayM} ${ampm}`);
      current += stepMins;
    }
  } catch (e) {
    return ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
  }
  return slots.length > 0 ? slots : ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
}

export function isValidPhoneNumber(phone?: string): boolean {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

export function formatPhoneNumberE164(phone: string, defaultCountryCode: string = '+91'): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.replace(/\D/g, '');
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `${defaultCountryCode}${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length < 6) return '••••••';
  const last4 = clean.slice(-4);
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) : '';
  return `${prefix} •••••• ${last4}`.trim();
}

export function maskCustomerName(name?: string): string {
  if (!name) return 'Guest';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    const first = parts[0];
    return first.length > 2 ? `${first[0]}***${first[first.length - 1]}` : first;
  }
  return `${parts[0]} ${parts[1][0]}.`;
}

import crypto from 'crypto';

export function generateAdminSessionToken(streamId: string, passcode: string): string {
  const secret = process.env.ADMIN_JWT_SECRET || 'noq-vault-hmac-sec-84291-x7k9p';
  const timestamp = Date.now();
  const payload = `${streamId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${payload}:${passcode.trim()}`)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifyAdminSessionToken(token?: string | null, streamId?: string, passcode?: string): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [tStreamId, timestampStr, signature] = parts;
    const tokenTime = Number(timestampStr);
    if (isNaN(tokenTime)) return false;
    
    // Token valid for 7 days
    const isExpired = Date.now() - tokenTime > 7 * 24 * 60 * 60 * 1000;
    if (isExpired) return false;
    if (streamId && tStreamId !== streamId) return false;

    const secret = process.env.ADMIN_JWT_SECRET || 'noq-vault-hmac-sec-84291-x7k9p';

    if (passcode) {
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${tStreamId}:${timestampStr}:${passcode.trim()}`)
        .digest('hex');
      
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSig, 'hex');
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    }

    // Basic HMAC length & structural integrity verification
    return typeof signature === 'string' && signature.length === 64;
  } catch (e) {
    return false;
  }
}
