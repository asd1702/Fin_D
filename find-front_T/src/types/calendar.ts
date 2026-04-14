export type EventType = 'earnings' | 'earnings_auto' | 'economic_event' | 'conference' | 'dividend' | 'split' | 'economic' | 'personal';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: EventType;
  description?: string;
  time?: string; // e.g., "10:00 AM" or "After Market Close"
  companySymbol?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}
