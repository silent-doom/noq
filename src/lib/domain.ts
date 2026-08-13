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
