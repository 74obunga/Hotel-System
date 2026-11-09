/**
 * Hotel PMS Central Reactive State Store
 * Manages domain data, calculations (folios, trial balance, ledger),
 * and local persistence with automatic subscriber notification.
 */

const STORAGE_KEY = 'hotel_ops_store_v2';

export class Store {
  constructor() {
    this.subscribers = new Set();
    this.state = null;
    this.init();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    this.save();
    for (const sub of this.subscribers) {
      try {
        sub(this.state);
      } catch (err) {
        console.error('[Store] Subscriber error:', err);
      }
    }
  }

  init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        if (['Savannah Crest Luxury Hotel', 'Vavanna Hotel'].includes(this.state.settings?.hotel)) {
          this.state.settings.hotel = 'Savanna Crest Hotel System';
          this.save();
        }
        return;
      }
    } catch (e) {
      console.warn('[Store] Could not load saved state, seeding defaults');
    }
    this.state = this.createSeedData();
    this.save();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('[Store] LocalStorage save failed:', e);
    }
  }

  // --- Date and Formatting Utilities ---
  todayISO() {
    const d = new Date();
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  nightsBetween(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  }

  fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  fmtShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  dow(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
  }

  formatMoney(amount, showDecimals = false) {
    const cur = this.state?.settings?.currency || 'KES';
    const num = Math.abs(amount || 0);
    const formatted = showDecimals
      ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(num).toLocaleString('en-US');
    return `${amount < 0 ? '-' : ''}${cur} ${formatted}`;
  }

  // --- Lookups ---
  getRoom(id) { return this.state.rooms.find(r => r.id === id); }
  getGuest(id) { return this.state.guests.find(g => g.id === id); }
  getReservation(id) { return this.state.reservations.find(r => r.id === id); }
  getRoomType(id) { return this.state.roomTypes.find(t => t.id === id); }

  // --- Financial & Folio Computations ---
  vatOf(net) {
    const vatRate = this.state.settings.vatRate || 16;
    return Math.round((net * vatRate / 100) * 100) / 100;
  }

  getFolio(reservation) {
    if (!reservation) return null;
    const r = typeof reservation === 'string' ? this.getReservation(reservation) : reservation;
    if (!r) return null;

    const nights = Math.max(0, this.nightsBetween(r.checkIn, r.checkOut));
    const postedNights = (r.status === 'checked_in' || r.status === 'checked_out')
      ? Math.max(0, Math.min(nights, this.nightsBetween(r.checkIn, this.addDays(this.todayISO(), 1))))
      : 0;

    const roomNet = postedNights * r.rate;
    const roomTax = this.vatOf(roomNet);
    const roomGross = Math.round((roomNet + roomTax) * 100) / 100;

    const charges = this.state.transactions.filter(t => t.resId === r.id && t.type === 'charge');
    const chargesNet = charges.reduce((acc, c) => acc + (c.net || 0), 0);
    const chargesTax = charges.reduce((acc, c) => acc + (c.tax || 0), 0);
    const chargesGross = Math.round((chargesNet + chargesTax) * 100) / 100;

    const payments = this.state.transactions.filter(t => t.resId === r.id && t.type === 'payment');
    const refunds = this.state.transactions.filter(t => t.resId === r.id && t.type === 'refund');

    const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0) - refunds.reduce((acc, rf) => acc + (rf.amount || 0), 0);
    const totalAmount = Math.round((roomGross + chargesGross) * 100) / 100;
    const balance = Math.round((totalAmount - totalPaid) * 100) / 100;

    return {
      nights,
      postedNights,
      roomNet,
      roomTax,
      roomGross,
      chargesNet,
      chargesTax,
      chargesGross,
      totalAmount,
      totalPaid,
      balance,
      charges,
      payments,
      refunds
    };
  }

  getReceivables() {
    return this.state.reservations
      .filter(r => r.status === 'checked_in' || r.status === 'checked_out')
      .map(r => ({ reservation: r, folio: this.getFolio(r) }))
      .filter(x => x.folio.balance > 0.5);
  }

  // --- Mutation Actions ---
  addReservation(data) {
    const id = 'res_' + Date.now().toString(36);
    const code = 'RES-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const newRes = {
      id,
      code,
      guestId: data.guestId,
      roomId: data.roomId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: data.adults || 1,
      children: data.children || 0,
      rate: Number(data.rate),
      source: data.source || 'Direct',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    this.state.reservations.push(newRes);
    this.notify();
    return newRes;
  }

  updateReservationStatus(resId, status) {
    const r = this.getReservation(resId);
    if (!r) return;
    r.status = status;
    if (status === 'checked_in') {
      const room = this.getRoom(r.roomId);
      if (room) room.hk = 'occupied';
    } else if (status === 'checked_out') {
      const room = this.getRoom(r.roomId);
      if (room) room.hk = 'dirty';
    }
    this.notify();
  }

  postCharge(resId, dept, name, netAmount) {
    const tax = this.vatOf(netAmount);
    const txn = {
      id: 'T' + String(++this.state.seq.txn).padStart(6, '0'),
      resId,
      date: this.todayISO(),
      time: new Date().toTimeString().slice(0, 5),
      type: 'charge',
      dept,
      method: '',
      net: netAmount,
      tax,
      amount: Math.round((netAmount + tax) * 100) / 100,
      ref: 'POS-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
      note: name
    };
    this.state.transactions.push(txn);
    this.notify();
    return txn;
  }

  postPayment(resId, amount, method, ref = '', note = '') {
    const txn = {
      id: 'T' + String(++this.state.seq.txn).padStart(6, '0'),
      resId,
      date: this.todayISO(),
      time: new Date().toTimeString().slice(0, 5),
      type: 'payment',
      dept: '',
      method,
      net: 0,
      tax: 0,
      amount: Math.round(amount * 100) / 100,
      ref: ref || (method === 'M-Pesa' ? 'S' + Math.random().toString(36).slice(2, 11).toUpperCase() : 'REC-' + Math.random().toString(36).slice(2, 7).toUpperCase()),
      note
    };
    this.state.transactions.push(txn);
    this.notify();
    return txn;
  }

  setRoomHkStatus(roomId, hkStatus) {
    const room = this.getRoom(roomId);
    if (room) {
      room.hk = hkStatus;
      this.notify();
    }
  }

  // --- Seed Data Generator ---
  createSeedData() {
    const today = this.todayISO();
    const settings = {
      hotel: 'Savanna Crest Hotel System',
      currency: 'KES',
      vatRate: 16,
      checkInTime: '14:00',
      checkOutTime: '10:00',
      openingCash: 2500000,
      sources: ['Direct', 'Walk-in', 'Corporate', 'Booking.com', 'Expedia', 'Travel Agent']
    };

    const roomTypes = [
      { id: 't_sgl', code: 'SGL', name: 'Standard Single', rate: 7000, cap: 1, beds: '1 single' },
      { id: 't_dbl', code: 'DBL', name: 'Superior Double', rate: 9500, cap: 2, beds: '1 queen' },
      { id: 't_dlx', code: 'DLX', name: 'Deluxe King', rate: 13500, cap: 2, beds: '1 king' },
      { id: 't_fam', code: 'FAM', name: 'Family Suite', rate: 18000, cap: 4, beds: '1 king + 2 twin' },
      { id: 't_ste', code: 'STE', name: 'Executive Suite', rate: 26000, cap: 3, beds: '1 super king' }
    ];

    const rooms = [];
    const layout = [
      [1, [['t_sgl', 4], ['t_dbl', 4]]],
      [2, [['t_dbl', 4], ['t_dlx', 4]]],
      [3, [['t_dlx', 4], ['t_fam', 3]]],
      [4, [['t_fam', 1], ['t_ste', 3]]]
    ];

    layout.forEach(([fl, parts]) => {
      let k = 0;
      parts.forEach(([tId, count]) => {
        for (let i = 0; i < count; i++) {
          k++;
          rooms.push({
            id: 'rm_' + (fl * 100 + k),
            no: String(fl * 100 + k),
            floor: fl,
            typeId: tId,
            hk: 'clean',
            ooo: false,
            assignee: ''
          });
        }
      });
    });

    const guests = [
      { id: 'g1', name: 'Dr. Jane Muthoni', phone: '+254712345678', email: 'jane.muthoni@example.com', company: 'Safaricom PLC', vip: true },
      { id: 'g2', name: 'Alexander Patel', phone: '+254723456789', email: 'alex.patel@example.com', company: 'Deloitte East Africa', vip: false },
      { id: 'g3', name: 'Lars Johansson', phone: '+46701234567', email: 'lars.johansson@nordic.se', company: 'UNEP', vip: true },
      { id: 'g4', name: 'Faith Chebet', phone: '+254734567890', email: 'chebet.faith@example.com', company: 'KCB Bank Group', vip: false },
      { id: 'g5', name: 'Marcus Sterling', phone: '+44789012345', email: 'm.sterling@ukinvest.co.uk', company: '', vip: false }
    ];

    // Seed Stays
    const reservations = [
      { id: 'res_1', code: 'RES-K8912A', guestId: 'g1', roomId: 'rm_201', checkIn: this.addDays(today, -2), checkOut: this.addDays(today, 2), adults: 2, children: 0, rate: 9500, source: 'Direct', status: 'checked_in' },
      { id: 'res_2', code: 'RES-P4410B', guestId: 'g2', roomId: 'rm_202', checkIn: today, checkOut: this.addDays(today, 3), adults: 1, children: 0, rate: 9500, source: 'Corporate', status: 'confirmed' },
      { id: 'res_3', code: 'RES-L9018C', guestId: 'g3', roomId: 'rm_301', checkIn: this.addDays(today, -1), checkOut: today, adults: 2, children: 0, rate: 13500, source: 'Booking.com', status: 'checked_in' },
      { id: 'res_4', code: 'RES-F1209D', guestId: 'g4', roomId: 'rm_102', checkIn: this.addDays(today, 1), checkOut: this.addDays(today, 4), adults: 1, children: 0, rate: 7000, source: 'Direct', status: 'confirmed' },
      { id: 'res_5', code: 'RES-M7721E', guestId: 'g5', roomId: 'rm_402', checkIn: this.addDays(today, -3), checkOut: this.addDays(today, -1), adults: 2, children: 0, rate: 26000, source: 'Expedia', status: 'checked_out' }
    ];

    const transactions = [
      { id: 'T000001', resId: 'res_1', date: this.addDays(today, -2), time: '14:20', type: 'payment', dept: '', method: 'M-Pesa', net: 0, tax: 0, amount: 22040, ref: 'SGH98124KK', note: 'Deposit STK push' },
      { id: 'T000002', resId: 'res_1', date: this.addDays(today, -1), time: '19:45', type: 'charge', dept: 'F&B', method: '', net: 4500, tax: 720, amount: 5220, ref: 'POS-DINNER', note: 'A la carte dinner' },
      { id: 'T000003', resId: 'res_3', date: this.addDays(today, -1), time: '15:10', type: 'payment', dept: '', method: 'Card', net: 0, tax: 0, amount: 15660, ref: 'AUTH872199', note: 'Visa •••• 4421' }
    ];

    const catalog = [
      { id: 'c1', dept: 'F&B', name: 'Breakfast Buffet', price: 2000 },
      { id: 'c2', dept: 'F&B', name: 'Set Lunch Menu', price: 2800 },
      { id: 'c3', dept: 'F&B', name: 'Prime Sirloin Steak', price: 3400 },
      { id: 'c4', dept: 'Spa', name: 'Aromatherapy Massage 60m', price: 6000 },
      { id: 'c5', dept: 'Laundry', name: 'Suit Dry Clean & Press', price: 1400 },
      { id: 'c6', dept: 'Transport', name: 'Airport VIP Transfer', price: 5000 }
    ];

    // Mark room occupancy
    const rm201 = rooms.find(r => r.id === 'rm_201');
    if (rm201) rm201.hk = 'occupied';
    const rm301 = rooms.find(r => r.id === 'rm_301');
    if (rm301) rm301.hk = 'occupied';

    return {
      settings,
      roomTypes,
      rooms,
      guests,
      reservations,
      transactions,
      catalog,
      seq: { txn: 10 }
    };
  }
}

export const store = new Store();
