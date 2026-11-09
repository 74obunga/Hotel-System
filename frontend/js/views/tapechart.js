/**
 * Interactive Tape Chart (Room Rack Timeline)
 * Visual matrix of rooms vs. calendar days with booking spans and instant booking slots.
 */

import { store } from '../store.js';

let tapeDays = 14;
let tapeStartDate = store.addDays(store.todayISO(), -2);

export function renderTapeChart() {
  const today = store.todayISO();
  const rooms = store.state.rooms;
  const reservations = store.state.reservations;

  // Generate calendar days
  const days = [];
  for (let i = 0; i < tapeDays; i++) {
    days.push(store.addDays(tapeStartDate, i));
  }

  // Header row
  const headerCells = days.map((d, i) => {
    const isToday = d === today;
    const isWk = store.dow(d) === 'Sat' || store.dow(d) === 'Sun';
    return `
      <div class="tape-header-cell ${isToday ? 'today' : ''} ${isWk ? 'weekend' : ''}" style="grid-column:${i + 1};grid-row:1;">
        <span style="font-weight:600;font-size:10px;text-transform:uppercase;">${store.dow(d)}</span>
        <strong style="font-size:12px;">${store.fmtShort(d)}</strong>
      </div>
    `;
  }).join('');

  const headerRow = `
    <div class="tape-row tape-header">
      <div class="tape-room-label">
        <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;">Room</strong>
      </div>
      <div class="tape-grid" style="--days-count:${tapeDays};">
        ${headerCells}
      </div>
    </div>
  `;

  // Room rows
  const roomRows = rooms.map(rm => {
    const type = store.getRoomType(rm.typeId);

    // Empty clickable background slots
    const cells = days.map((d, i) => {
      const isToday = d === today;
      const isWk = store.dow(d) === 'Sat' || store.dow(d) === 'Sun';
      return `
        <button class="tape-cell ${isToday ? 'today' : ''} ${isWk ? 'weekend' : ''}"
          style="grid-column:${i + 1};grid-row:1;"
          data-action="tape-book" data-room="${rm.id}" data-date="${d}"
          title="Click to reserve Room ${rm.no} on ${store.fmtDate(d)}">
        </button>
      `;
    }).join('');

    // Overlay active reservation bars
    const activeStays = reservations.filter(r => {
      if (r.roomId !== rm.id) return false;
      if (r.status === 'cancelled' || r.status === 'no_show') return false;
      return r.checkIn < store.addDays(tapeStartDate, tapeDays) && r.checkOut > tapeStartDate;
    });

    const bars = activeStays.map(r => {
      const startCol = Math.max(0, store.nightsBetween(tapeStartDate, r.checkIn));
      const endCol = Math.min(tapeDays, store.nightsBetween(tapeStartDate, r.checkOut));
      if (endCol <= startCol) return '';

      const guest = store.getGuest(r.guestId);
      const guestName = guest ? guest.name : 'Reservation';

      return `
        <button class="tape-reservation-bar ${r.status}"
          style="grid-column:${startCol + 1} / ${endCol + 1};grid-row:1;"
          data-action="folio" data-id="${r.id}"
          title="${guestName} (${r.code}): ${store.fmtShort(r.checkIn)} to ${store.fmtShort(r.checkOut)}">
          <span style="font-weight:600;margin-right:6px;">${guestName}</span>
          <span style="opacity:0.8;font-size:11px;">(${r.code})</span>
        </button>
      `;
    }).join('');

    // Out of order indicator if room is ooo
    const oooBar = rm.ooo ? `
      <div class="tape-reservation-bar ooo" style="grid-column:1 / ${tapeDays + 1};grid-row:1;">
        Out of Order: Maintenance
      </div>
    ` : '';

    return `
      <div class="tape-row">
        <div class="tape-room-label">
          <strong>${rm.no}</strong>
          <span>${type ? type.code : ''} &middot; Fl ${rm.floor}</span>
        </div>
        <div class="tape-grid" style="--days-count:${tapeDays};">
          ${cells}
          ${bars}
          ${oooBar}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="tapechart-view" style="display:flex;flex-direction:column;gap:14px;">
      <!-- Controls Toolbar -->
      <div style="display:flex;align-items:center;gap:10px;background:var(--bg-surface);padding:10px 16px;border-radius:10px;border:1px solid var(--border-line);flex-wrap:wrap;">
        <button class="btn btn-sm" data-action="tape-shift" data-shift="-7">&larr; Previous Week</button>
        <button class="btn btn-sm" data-action="tape-today">Today</button>
        <button class="btn btn-sm" data-action="tape-shift" data-shift="7">Next Week &rarr;</button>

        <div style="height:20px;width:1px;background:var(--border-line);margin:0 4px;"></div>

        <div style="display:flex;border:1px solid var(--border-line);border-radius:6px;overflow:hidden;">
          ${[7, 14, 21, 30].map(n => `
            <button class="btn btn-sm" style="border:0;border-radius:0;${tapeDays === n ? 'background:var(--brand-primary-light);color:var(--brand-primary);font-weight:600;' : ''}"
              data-action="tape-span" data-days="${n}">${n} Days</button>
          `).join('')}
        </div>

        <div style="margin-left:auto;display:flex;align-items:center;gap:14px;font-size:12px;">
          <span style="display:inline-flex;align-items:center;gap:5px;">
            <i style="width:10px;height:10px;border-radius:2px;background:var(--brand-primary-light);border:1px solid var(--brand-primary);"></i> Confirmed
          </span>
          <span style="display:inline-flex;align-items:center;gap:5px;">
            <i style="width:10px;height:10px;border-radius:2px;background:var(--status-occupied-fg);"></i> In-House
          </span>
          <span style="display:inline-flex;align-items:center;gap:5px;">
            <i style="width:10px;height:10px;border-radius:2px;background:var(--bg-surface-subtle);border:1px solid var(--border-line);"></i> Checked Out
          </span>
        </div>
      </div>

      <!-- Tape Matrix Container -->
      <div class="tape-container">
        ${headerRow}
        ${roomRows}
      </div>
    </div>
  `;
}

export function handleTapeActions(action, target) {
  if (action === 'tape-shift') {
    const shift = parseInt(target.dataset.shift, 10);
    tapeStartDate = store.addDays(tapeStartDate, shift);
    return true;
  }
  if (action === 'tape-today') {
    tapeStartDate = store.addDays(store.todayISO(), -2);
    return true;
  }
  if (action === 'tape-span') {
    tapeDays = parseInt(target.dataset.days, 10);
    return true;
  }
  return false;
}
