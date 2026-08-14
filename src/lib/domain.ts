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
