import { useState, type CSSProperties } from 'react';
import { api } from '../js/api.js';
import { store } from '../js/store.js';
import type { CatalogItem, FolioSummary, Guest, HotelState, Receivable, Reservation, Room, RoomType, Transaction } from './domain';

const cardStyle: CSSProperties = { padding: 14 };
const actionRowStyle: CSSProperties = { display: 'flex', gap: 8, marginTop: 10 };
const mutedStyle: CSSProperties = { color: 'var(--text-muted)' };
let tapeDaysPreference = 14;
let tapeStartDatePreference = store.addDays(store.todayISO(), -2);

function getHotelState(): HotelState {
  return store.state as HotelState;
}

function getRoom(state: HotelState, roomId: string): Room | undefined {
  return state.rooms.find(room => room.id === roomId);
}

function getGuest(state: HotelState, guestId: string): Guest | undefined {
  return state.guests.find(guest => guest.id === guestId);
}

function getRoomType(state: HotelState, typeId: string): RoomType | undefined {
  return state.roomTypes.find(roomType => roomType.id === typeId);
}

function getFolio(reservation: Reservation): FolioSummary | null {
  return store.getFolio(reservation) as FolioSummary | null;
}

function EmptyState({ children }: { children: string }) {
  return <div style={{ ...mutedStyle, padding: 24, textAlign: 'center' }}>{children}</div>;
}

export function FrontDeskView() {
  const state = getHotelState();
  const today = store.todayISO();
  const arrivals = state.reservations.filter(reservation => reservation.status === 'confirmed' && reservation.checkIn <= today);
  const inHouse = state.reservations.filter(reservation => reservation.status === 'checked_in');
  const departures = inHouse.filter(reservation => reservation.checkOut <= today);

  return (
    <div className="frontdesk-view" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-line)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" data-action="modal-walkin" type="button">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Walk-In Registration
        </button>
        <button className="btn" data-action="modal-newbooking" type="button">New Reservation</button>
        <div style={{ marginLeft: 'auto', fontSize: 13, ...mutedStyle }}>
          Operational Business Date: <strong>{store.fmtDate(today)}</strong>
        </div>
      </div>

      <div className="grid-3" style={{ alignItems: 'start', gap: 16 }}>
        <div className="card" style={cardStyle}>
          <div className="card-header" style={{ marginBottom: 10 }}>
            <h3 className="card-title">Expected Arrivals</h3>
            <span className="chip chip-brand" style={{ marginLeft: 'auto' }}>{arrivals.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {arrivals.map(reservation => {
              const guest = getGuest(state, reservation.guestId);
              const room = getRoom(state, reservation.roomId);
              const type = room ? getRoomType(state, room.typeId) : null;
              return (
                <div key={reservation.id} style={{ padding: 12, background: 'var(--bg-surface-subtle)', borderRadius: 8, border: '1px solid var(--border-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{room ? room.no : '-'}</span>
                    <span style={{ fontSize: 11, ...mutedStyle }}>{type ? type.name : ''}</span>
                    <span className="chip chip-clean" style={{ marginLeft: 'auto' }}>Ready</span>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 600 }}>{guest ? guest.name : 'Unknown Guest'}</div>
                  <div style={{ fontSize: 12, ...mutedStyle, marginTop: 2 }}>
                    Stay: {store.fmtShort(reservation.checkIn)} – {store.fmtShort(reservation.checkOut)} ({store.nightsBetween(reservation.checkIn, reservation.checkOut)} nts)
                  </div>
                  <div style={actionRowStyle}>
                    <button className="btn btn-sm btn-primary" style={{ flex: 1 }} data-action="checkin" data-id={reservation.id} type="button">Check In</button>
                    <button className="btn btn-sm" data-action="folio" data-id={reservation.id} type="button">Folio</button>
                  </div>
                </div>
              );
            })}
            {arrivals.length === 0 && <EmptyState>No arrivals pending</EmptyState>}
          </div>
        </div>

        <div className="card" style={cardStyle}>
          <div className="card-header" style={{ marginBottom: 10 }}>
            <h3 className="card-title">In-House Stays</h3>
            <span className="chip chip-occupied" style={{ marginLeft: 'auto' }}>{inHouse.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '68vh', overflowY: 'auto' }}>
            {inHouse.map(reservation => {
              const guest = getGuest(state, reservation.guestId);
              const room = getRoom(state, reservation.roomId);
              const folio = getFolio(reservation);
              if (!folio) return <div key={reservation.id} role="alert">Folio unavailable for {reservation.code}.</div>;
              return (
                <div key={reservation.id} style={{ padding: 12, background: 'var(--bg-surface-subtle)', borderRadius: 8, border: '1px solid var(--border-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{room ? room.no : '-'}</span>
                    <span className="chip chip-occupied" style={{ marginLeft: 'auto' }}>Occupied</span>
                  </div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{guest ? guest.name : 'Guest'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                    <span style={mutedStyle}>Balance:</span>
                    <strong style={{ color: folio.balance > 0.5 ? 'var(--status-dirty-fg)' : 'var(--status-clean-fg)' }}>{store.formatMoney(folio.balance)}</strong>
                  </div>
                  <div style={{ ...actionRowStyle, gap: 6 }}>
                    <button className="btn btn-sm" style={{ flex: 1 }} data-action="folio" data-id={reservation.id} type="button">Folio</button>
                    <button
                      className="btn btn-sm"
                      onClick={() => window.dispatchEvent(new CustomEvent('pos:open', { detail: { reservationId: reservation.id } }))}
                      type="button"
                    >
                      + Charge
                    </button>
                  </div>
                </div>
              );
            })}
            {inHouse.length === 0 && <EmptyState>No guests in house</EmptyState>}
          </div>
        </div>

        <div className="card" style={cardStyle}>
          <div className="card-header" style={{ marginBottom: 10 }}>
            <h3 className="card-title">Departures Due</h3>
            <span className="chip chip-dirty" style={{ marginLeft: 'auto' }}>{departures.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {departures.map(reservation => {
              const guest = getGuest(state, reservation.guestId);
              const room = getRoom(state, reservation.roomId);
              const folio = getFolio(reservation);
              if (!folio) return <div key={reservation.id} role="alert">Folio unavailable for {reservation.code}.</div>;
              const isSettled = folio.balance <= 0.5;
              return (
                <div key={reservation.id} style={{ padding: 12, background: 'var(--bg-surface-subtle)', borderRadius: 8, border: '1px solid var(--border-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{room ? room.no : '-'}</span>
                    <span className={`chip ${isSettled ? 'chip-clean' : 'chip-dirty'}`} style={{ marginLeft: 'auto' }}>
                      {isSettled ? 'Settled' : `Unpaid: ${store.formatMoney(folio.balance)}`}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{guest ? guest.name : 'Guest'}</div>
                  <div style={actionRowStyle}>
                    {isSettled
                      ? <button className="btn btn-sm btn-primary" style={{ flex: 1 }} data-action="checkout" data-id={reservation.id} type="button">Complete Check-Out</button>
                      : <button className="btn btn-sm btn-accent" style={{ flex: 1 }} data-action="pay" data-id={reservation.id} type="button">Collect &amp; Check Out</button>}
                    <button className="btn btn-sm" data-action="folio" data-id={reservation.id} type="button">Folio</button>
                  </div>
                </div>
              );
            })}
            {departures.length === 0 && <EmptyState>No departures remaining today</EmptyState>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TapeChartView() {
  const state = getHotelState();
  const today = store.todayISO();
  const [daysCount, setDaysCount] = useState(tapeDaysPreference);
  const [startDate, setStartDate] = useState(tapeStartDatePreference);
  const days = Array.from({ length: daysCount }, (_, index) => store.addDays(startDate, index));
  const gridStyle = { ['--days-count' as string]: daysCount } as CSSProperties;

  function changeStartDate(nextDate: string) {
    tapeStartDatePreference = nextDate;
    setStartDate(nextDate);
  }

  return (
    <div className="tapechart-view" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-line)', flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => changeStartDate(store.addDays(startDate, -7))} type="button">← Previous Week</button>
        <button className="btn btn-sm" onClick={() => changeStartDate(store.addDays(today, -2))} type="button">Today</button>
        <button className="btn btn-sm" onClick={() => changeStartDate(store.addDays(startDate, 7))} type="button">Next Week →</button>
        <div style={{ height: 20, width: 1, background: 'var(--border-line)', margin: '0 4px' }} />
        <div style={{ display: 'flex', border: '1px solid var(--border-line)', borderRadius: 6, overflow: 'hidden' }}>
          {[7, 14, 21, 30].map(count => (
            <button
              className="btn btn-sm"
              key={count}
              onClick={() => {
                tapeDaysPreference = count;
                setDaysCount(count);
              }}
              style={{ border: 0, borderRadius: 0, ...(daysCount === count ? { background: 'var(--brand-primary-light)', color: 'var(--brand-primary)', fontWeight: 600 } : {}) }}
              type="button"
            >
              {count} Days
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary)' }} />Confirmed</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--status-occupied-fg)' }} />In-House</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bg-surface-subtle)', border: '1px solid var(--border-line)' }} />Checked Out</span>
        </div>
      </div>

      <div className="tape-container">
        <div className="tape-row tape-header">
          <div className="tape-room-label"><strong style={{ fontSize: 12, ...mutedStyle, textTransform: 'uppercase' }}>Room</strong></div>
          <div className="tape-grid" style={gridStyle}>
            {days.map((date, index) => {
              const isWeekend = ['Sat', 'Sun'].includes(store.dow(date));
              return (
                <div className={`tape-header-cell${date === today ? ' today' : ''}${isWeekend ? ' weekend' : ''}`} key={date} style={{ gridColumn: index + 1, gridRow: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{store.dow(date)}</span>
                  <strong style={{ fontSize: 12 }}>{store.fmtShort(date)}</strong>
                </div>
              );
            })}
          </div>
        </div>

        {state.rooms.map(room => {
          const roomType = getRoomType(state, room.typeId);
          const activeStays = state.reservations.filter(reservation => (
            reservation.roomId === room.id
            && !['cancelled', 'no_show'].includes(reservation.status)
            && reservation.checkIn < store.addDays(startDate, daysCount)
            && reservation.checkOut > startDate
          ));
          return (
            <div className="tape-row" key={room.id}>
              <div className="tape-room-label">
                <strong>{room.no}</strong>
                <span>{roomType ? roomType.code : ''} · Fl {room.floor}</span>
              </div>
              <div className="tape-grid" style={gridStyle}>
                {days.map((date, index) => {
                  const isWeekend = ['Sat', 'Sun'].includes(store.dow(date));
                  return (
                    <button
                      aria-label={`Reserve Room ${room.no} on ${store.fmtDate(date)}`}
                      className={`tape-cell${date === today ? ' today' : ''}${isWeekend ? ' weekend' : ''}`}
                      data-action="tape-book"
                      data-date={date}
                      data-room={room.id}
                      key={date}
                      style={{ gridColumn: index + 1, gridRow: 1 }}
                      title={`Click to reserve Room ${room.no} on ${store.fmtDate(date)}`}
                      type="button"
                    />
                  );
                })}
                {activeStays.map(reservation => {
                  const startColumn = Math.max(0, store.nightsBetween(startDate, reservation.checkIn));
                  const endColumn = Math.min(daysCount, store.nightsBetween(startDate, reservation.checkOut));
                  if (endColumn <= startColumn) return null;
                  const guest = store.getGuest(reservation.guestId);
                  const guestName = guest ? guest.name : 'Reservation';
                  return (
                    <button
                      className={`tape-reservation-bar ${reservation.status}`}
                      data-action="folio"
                      data-id={reservation.id}
                      key={reservation.id}
                      style={{ gridColumn: `${startColumn + 1} / ${endColumn + 1}`, gridRow: 1 }}
                      title={`${guestName} (${reservation.code}): ${store.fmtShort(reservation.checkIn)} to ${store.fmtShort(reservation.checkOut)}`}
                      type="button"
                    >
                      <span style={{ fontWeight: 600, marginRight: 6 }}>{guestName}</span>
                      <span style={{ opacity: 0.8, fontSize: 11 }}>({reservation.code})</span>
                    </button>
                  );
                })}
                {room.ooo && <div className="tape-reservation-bar ooo" style={{ gridColumn: `1 / ${daysCount + 1}`, gridRow: 1 }}>Out of Order: Maintenance</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HousekeepingView() {
  const state = getHotelState();
  const rooms = state.rooms;
  const floors = [...new Set(rooms.map(room => room.floor))].sort((left, right) => left - right);
  const counts = {
    dirty: rooms.filter(room => room.hk === 'dirty').length,
    clean: rooms.filter(room => room.hk === 'clean').length,
    inspected: rooms.filter(room => room.hk === 'inspected').length,
    occupied: rooms.filter(room => room.hk === 'occupied').length
  };

  return (
    <div className="housekeeping-view" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="grid-4" style={{ gap: 12 }}>
        <div className="kpi-tile" style={{ borderLeft: '4px solid var(--status-dirty-fg)' }}><div className="label">Vacant Dirty</div><div className="value" style={{ color: 'var(--status-dirty-fg)' }}>{counts.dirty}</div><div className="subtext">Awaiting room attendant</div></div>
        <div className="kpi-tile" style={{ borderLeft: '4px solid var(--status-clean-fg)' }}><div className="label">Clean &amp; Ready</div><div className="value" style={{ color: 'var(--status-clean-fg)' }}>{counts.clean}</div><div className="subtext">Ready for inspection</div></div>
        <div className="kpi-tile" style={{ borderLeft: '4px solid var(--brand-primary)' }}><div className="label">Supervisor Inspected</div><div className="value" style={{ color: 'var(--brand-primary)' }}>{counts.inspected}</div><div className="subtext">Verified for VIP check-in</div></div>
        <div className="kpi-tile" style={{ borderLeft: '4px solid var(--status-occupied-fg)' }}><div className="label">Occupied Rooms</div><div className="value" style={{ color: 'var(--status-occupied-fg)' }}>{counts.occupied}</div><div className="subtext">Daily stayover service</div></div>
      </div>
      {floors.map((floor: number) => {
        const floorRooms = rooms.filter(room => room.floor === floor);
        return (
          <div className="card" key={floor} style={{ padding: 16 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h3 className="card-title">Floor {floor}</h3>
              <span style={{ fontSize: 12, ...mutedStyle, marginLeft: 'auto' }}>{floorRooms.length} Rooms</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {floorRooms.map(room => {
                const type = getRoomType(state, room.typeId);
                const occupied = room.hk === 'occupied';
                const dirty = room.hk === 'dirty';
                const clean = room.hk === 'clean';
                return (
                  <div key={room.id} style={{ padding: 12, border: '1px solid var(--border-line)', borderRadius: 8, background: 'var(--bg-surface-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>{room.no}</span>
                      <span className={`chip ${occupied ? 'chip-occupied' : dirty ? 'chip-dirty' : clean ? 'chip-clean' : 'chip-brand'}`}>
                        {occupied ? 'In-House' : dirty ? 'Dirty' : clean ? 'Clean' : 'Inspected'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, ...mutedStyle }}>{type ? type.name : ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8 }}>
                      {dirty && <button className="btn btn-sm btn-primary" style={{ flex: 1 }} data-action="hk-status" data-room={room.id} data-status="clean" type="button">Mark Clean</button>}
                      {clean && <button className="btn btn-sm btn-accent" style={{ flex: 1 }} data-action="hk-status" data-room={room.id} data-status="inspected" type="button">Approve (Inspect)</button>}
                      {!dirty && !occupied && <button className="btn btn-sm" style={{ flex: 1 }} data-action="hk-status" data-room={room.id} data-status="dirty" type="button">Mark Dirty</button>}
                      {occupied && <span style={{ fontSize: 11, ...mutedStyle, padding: '4px 0' }}>Guest in residence</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PosView({ initialReservationId }: { initialReservationId: string }) {
  const state = getHotelState();
  const inHouse = state.reservations.filter(reservation => reservation.status === 'checked_in');
  const catalog = state.catalog;
  const departments = [...new Set(catalog.map(item => item.dept))];
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedReservationId, setSelectedReservationId] = useState(initialReservationId);
  const selectedId = selectedReservationId || inHouse[0]?.id || '';
  const cartItems = Object.entries(cart)
    .map(([id, quantity]) => ({ item: catalog.find(entry => entry.id === id), quantity }))
    .filter((entry): entry is { item: CatalogItem; quantity: number } => Boolean(entry.item) && entry.quantity > 0)
    .map(({ item, quantity }) => ({ item, quantity, lineTotal: item.price * quantity }));
  const subtotal = cartItems.reduce((sum, entry) => sum + entry.lineTotal, 0);
  const vat = store.vatOf(subtotal);
  const grandTotal = Math.round((subtotal + vat) * 100) / 100;

  function updateQuantity(itemId: string, delta: number) {
    setCart(current => {
      const quantity = (current[itemId] || 0) + delta;
      const next = { ...current };
      if (quantity > 0) next[itemId] = quantity;
      else delete next[itemId];
      return next;
    });
  }

  function postCharge() {
    if (!selectedId) return;
    for (const { item, quantity, lineTotal } of cartItems) {
      store.postCharge(selectedId, item.dept, `${item.name} (x${quantity})`, lineTotal);
    }
    setCart({});
    window.dispatchEvent(new CustomEvent('toast:show', { detail: { message: 'Charges posted successfully to room folio!', type: 'success' } }));
  }

  return (
    <div className="pos-view" style={{ display: 'grid', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {departments.map(department => (
          <div className="card" key={department} style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 12, fontSize: 15, color: 'var(--text-main)' }}>{department}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              {catalog.filter(item => item.dept === department).map(item => (
                <button className="btn" key={item.id} onClick={() => updateQuantity(item.id, 1)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 12, textAlign: 'left', height: 'auto', position: 'relative' }} type="button">
                  <strong style={{ fontSize: 13.5, color: 'var(--text-main)' }}>{item.name}</strong>
                  <span style={{ fontSize: 13, color: 'var(--brand-primary)', fontWeight: 600, marginTop: 4 }}>{store.formatMoney(item.price)}</span>
                  {cart[item.id] > 0 && <span className="chip chip-brand" style={{ position: 'absolute', top: 8, right: 8, fontSize: 10 }}>{cart[item.id]} in cart</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ position: 'sticky', top: 80, padding: 18 }}>
        <h3 style={{ marginBottom: 14, fontSize: 16 }}>Post Charge to Room</h3>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="pos-room-select" style={{ display: 'block', fontSize: 12, fontWeight: 600, ...mutedStyle, marginBottom: 5 }}>Select In-House Room</label>
          <select id="pos-room-select" onChange={event => setSelectedReservationId(event.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-line)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: 13 }} value={selectedId}>
            {inHouse.map(reservation => {
              const guest = getGuest(state, reservation.guestId);
              const room = getRoom(state, reservation.roomId);
              return <option key={reservation.id} value={reservation.id}>Room {room ? room.no : '-'} — {guest ? guest.name : 'Guest'}</option>;
            })}
            {inHouse.length === 0 && <option value="">No guests in house</option>}
          </select>
        </div>
        <div style={{ borderTop: '1px solid var(--border-line)', borderBottom: '1px solid var(--border-line)', padding: '10px 0', margin: '10px 0', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cartItems.map(({ item, quantity, lineTotal }) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
              <div style={{ flex: 1 }}><div>{item.name}</div><div style={{ fontSize: 11, ...mutedStyle }}>{store.formatMoney(item.price)} each</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 12px' }}>
                <button className="btn btn-sm" onClick={() => updateQuantity(item.id, -1)} style={{ width: 24, height: 24, padding: 0 }} type="button">-</button>
                <strong>{quantity}</strong>
                <button className="btn btn-sm" onClick={() => updateQuantity(item.id, 1)} style={{ width: 24, height: 24, padding: 0 }} type="button">+</button>
              </div>
              <strong className="tabular" style={{ minWidth: 60, textAlign: 'right' }}>{store.formatMoney(lineTotal)}</strong>
            </div>
          ))}
          {cartItems.length === 0 && <div style={{ ...mutedStyle, textAlign: 'center', padding: 18 }}>Cart is empty. Select items to post.</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...mutedStyle }}><span>Subtotal (Net)</span><span className="tabular">{store.formatMoney(subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...mutedStyle }}><span>VAT (16%)</span><span className="tabular">{store.formatMoney(vat)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid var(--border-line)', paddingTop: 6 }}>
            <span>Total Billable</span><span className="tabular" style={{ color: 'var(--brand-primary)' }}>{store.formatMoney(grandTotal)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" disabled={cartItems.length === 0 || inHouse.length === 0} onClick={postCharge} style={{ flex: 1 }} type="button">Post to Guest Folio</button>
          <button className="btn" disabled={cartItems.length === 0} onClick={() => setCart({})} type="button">Clear</button>
        </div>
      </div>
    </div>
  );
}

export function CashierView() {
  const state = getHotelState();
  const receivables = store.getReceivables() as Receivable[];
  const today = store.todayISO();
  const payments = state.transactions.filter((transaction: Transaction) => transaction.date === today && transaction.type === 'payment');
  const totalByMethod = (method: string) => payments.filter(payment => payment.method === method).reduce((sum, payment) => sum + payment.amount, 0);
  const mpesaTotal = totalByMethod('M-Pesa');
  const cardTotal = totalByMethod('Card');
  const cashTotal = totalByMethod('Cash');
  const bankTotal = totalByMethod('Bank');
  const totalCollected = mpesaTotal + cardTotal + cashTotal + bankTotal;
  const totalReceivables = receivables.reduce((sum, entry) => sum + entry.folio.balance, 0);

  return (
    <div className="cashier-view" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="grid-4" style={{ gap: 12 }}>
        <div className="kpi-tile"><div className="label">M-Pesa Collections</div><div className="value" style={{ color: 'var(--status-clean-fg)' }}>{store.formatMoney(mpesaTotal)}</div><div className="subtext">Safaricom Daraja STK Push</div></div>
        <div className="kpi-tile"><div className="label">Card Clearing</div><div className="value" style={{ color: 'var(--status-occupied-fg)' }}>{store.formatMoney(cardTotal)}</div><div className="subtext">Awaiting bank settlement</div></div>
        <div className="kpi-tile"><div className="label">Cash on Hand</div><div className="value">{store.formatMoney(cashTotal)}</div><div className="subtext">Front desk cash drawer · Bank {store.formatMoney(bankTotal)}</div></div>
        <div className="kpi-tile"><div className="label">Total Collected Today</div><div className="value" style={{ color: 'var(--brand-primary)' }}>{store.formatMoney(totalCollected)}</div><div className="subtext">{payments.length} settled receipts</div></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 className="card-title">Open Folios with Balances</h3>
          <span style={{ fontSize: 13, ...mutedStyle }}>Total Outstanding: <strong style={{ color: 'var(--status-dirty-fg)' }}>{store.formatMoney(totalReceivables)}</strong></span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Booking Code</th><th>Guest</th><th>Room</th><th>Stay Dates</th><th className="tabular">Charges (Gross)</th><th className="tabular">Paid</th><th className="tabular">Balance Due</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {receivables.map(({ reservation, folio }) => {
                const guest = getGuest(state, reservation.guestId);
                const room = getRoom(state, reservation.roomId);
                return (
                  <tr key={reservation.id}>
                    <td><strong>{reservation.code}</strong></td><td>{guest ? guest.name : 'Guest'}</td><td><strong>{room ? room.no : '-'}</strong></td>
                    <td>{store.fmtShort(reservation.checkIn)} – {store.fmtShort(reservation.checkOut)}</td>
                    <td className="tabular">{store.formatMoney(folio.totalAmount)}</td><td className="tabular">{store.formatMoney(folio.totalPaid)}</td>
                    <td className="tabular" style={{ fontWeight: 700, color: 'var(--status-dirty-fg)' }}>{store.formatMoney(folio.balance)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm btn-primary" data-action="pay" data-id={reservation.id} type="button">Collect Payment</button>
                      <button className="btn btn-sm" data-action="folio" data-id={reservation.id} type="button">View Folio</button>
                    </td>
                  </tr>
                );
              })}
              {receivables.length === 0 && <tr><td colSpan={8} style={{ ...mutedStyle, textAlign: 'center', padding: 24 }}>All active guest folios are fully settled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const settings = getHotelState().settings;
  return (
    <div className="settings-view" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Property Identity &amp; Tax Parameters</h3>
        <div className="grid-2" style={{ gap: 14 }}>
          <label className="operational-field">Hotel Name<input id="set-hotel-name" defaultValue={settings.hotel} type="text" /></label>
          <label className="operational-field">Operating Currency<input id="set-currency" defaultValue={settings.currency} type="text" /></label>
          <label className="operational-field">Standard VAT Rate (%)<input id="set-vat" defaultValue={settings.vatRate} type="number" /></label>
          <label className="operational-field">Check-In Standard Time<input id="set-checkin" defaultValue={settings.checkInTime} type="time" /></label>
        </div>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Safaricom M-Pesa Daraja STK Push Gateway</h3>
          <span className="chip chip-brand" style={{ marginLeft: 'auto' }}>Integrated</span>
        </div>
        <p style={{ fontSize: 13, ...mutedStyle, marginBottom: 16 }}>Enables prompt STK PIN push requests directly to guest mobile handsets for instant room deposits and outlet settlements.</p>
        <div className="grid-2" style={{ gap: 14 }}>
          <label className="operational-field">Paybill or Till Number<input defaultValue="174379" type="text" /></label>
          <label className="operational-field">Environment<select defaultValue="sandbox"><option value="sandbox">Daraja Sandbox (Simulator)</option><option value="production">Daraja Live Production</option></select></label>
        </div>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>FastAPI Backend Operations Connection</h3>
        <p style={{ fontSize: 13, ...mutedStyle, marginBottom: 14 }}>Target API URL: <code>{api.baseUrl || 'http://localhost:8000'}</code></p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-primary" data-action="ping-backend" type="button">Ping Backend API Health</button>
          <button className="btn btn-sm" data-action="reset-demo-data" type="button">Reset Demo Data</button>
        </div>
      </div>
    </div>
  );
}
