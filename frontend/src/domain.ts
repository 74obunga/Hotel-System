export interface Reservation {
  id: string;
  code: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  rate: number;
  status: string;
}

export interface Room {
  id: string;
  no: string;
  floor: number;
  typeId: string;
  hk: string;
  ooo: boolean;
}

export interface Guest {
  id: string;
  name: string;
}

export interface RoomType {
  id: string;
  code: string;
  name: string;
}

export interface CatalogItem {
  id: string;
  dept: string;
  name: string;
  price: number;
}

export interface Transaction {
  date: string;
  type: string;
  method: string;
  amount: number;
}

export interface HotelSettings {
  hotel: string;
  currency: string;
  vatRate: number;
  checkInTime: string;
}

export interface HotelState {
  settings: HotelSettings;
  rooms: Room[];
  roomTypes: RoomType[];
  guests: Guest[];
  reservations: Reservation[];
  catalog: CatalogItem[];
  transactions: Transaction[];
}

export interface FolioSummary {
  balance: number;
  totalAmount: number;
  totalPaid: number;
}

export interface Receivable {
  reservation: Reservation;
  folio: FolioSummary;
}
