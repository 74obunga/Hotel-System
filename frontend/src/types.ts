export interface AnalyticsOverview {
  from_date: string;
  to_date: string;
  total_rooms: number;
  sellable_rooms: number;
  occupied_rooms: number;
  occupancy_rate: number;
  arrivals_due: number;
  departures_due: number;
  adr: number;
  revpar: number;
  arrivals: { id: string; code: string; guest_name: string; room_number: string }[];
  occupancy_trend: { date: string; occupied_rooms: number; sellable_rooms: number; occupancy_rate: number }[];
  reservations_by_status: { status: string; count: number }[];
  journal_activity: { account_code: string; debit: number; credit: number }[];
  daily_journal_activity: { date: string; debit: number; credit: number }[];
}
