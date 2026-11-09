/**
 * Front Desk Workbench View
 * Manages daily arrivals, departures, in-house guests, and fast walk-in check-ins.
 */

import { store } from '../store.js';

export function renderFrontDesk() {
  const today = store.todayISO();
  const arrivals = store.state.reservations.filter(r => r.status === 'confirmed' && r.checkIn <= today);
  const inHouse = store.state.reservations.filter(r => r.status === 'checked_in');
  const departures = inHouse.filter(r => r.checkOut <= today);

  return `
    <div class="frontdesk-view" style="display:flex;flex-direction:column;gap:18px;">
      <!-- Action Toolbar -->
      <div style="display:flex;align-items:center;gap:12px;background:var(--bg-surface);padding:12px 16px;border-radius:10px;border:1px solid var(--border-line);">
        <button class="btn btn-primary" data-action="modal-walkin">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Walk-In Registration
        </button>
        <button class="btn" data-action="modal-newbooking">New Reservation</button>
        <div style="margin-left:auto;font-size:13px;color:var(--text-muted);">
          Operational Business Date: <strong>${store.fmtDate(today)}</strong>
        </div>
      </div>

      <!-- 3-Column Workbench Columns -->
      <div class="grid-3" style="align-items:start;gap:16px;">
        <!-- Column 1: Arrivals -->
        <div class="card" style="padding:14px;">
          <div class="card-header" style="margin-bottom:10px;">
            <h3 class="card-title">Expected Arrivals</h3>
            <span class="chip chip-brand" style="margin-left:auto;">${arrivals.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${arrivals.map(r => {
              const guest = store.getGuest(r.guestId);
              const room = store.getRoom(r.roomId);
              const type = room ? store.getRoomType(room.typeId) : null;
              return `
                <div style="padding:12px;background:var(--bg-surface-subtle);border-radius:8px;border:1px solid var(--border-line);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-family:var(--font-display);font-size:18px;font-weight:700;">${room ? room.no : '-'}</span>
                    <span style="font-size:11px;color:var(--text-muted);">${type ? type.name : ''}</span>
                    <span class="chip chip-clean" style="margin-left:auto;">Ready</span>
                  </div>
                  <div style="margin-top:6px;font-weight:600;">${guest ? guest.name : 'Unknown Guest'}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                    Stay: ${store.fmtShort(r.checkIn)} &ndash; ${store.fmtShort(r.checkOut)} (${store.nightsBetween(r.checkIn, r.checkOut)} nts)
                  </div>
                  <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="btn btn-sm btn-primary" style="flex:1;" data-action="checkin" data-id="${r.id}">Check In</button>
                    <button class="btn btn-sm" data-action="folio" data-id="${r.id}">Folio</button>
                  </div>
                </div>
              `;
            }).join('') || '<div style="color:var(--text-muted);padding:24px;text-align:center;">No arrivals pending</div>'}
          </div>
        </div>

        <!-- Column 2: In-House Guests -->
        <div class="card" style="padding:14px;">
          <div class="card-header" style="margin-bottom:10px;">
            <h3 class="card-title">In-House Stays</h3>
            <span class="chip chip-occupied" style="margin-left:auto;">${inHouse.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:68vh;overflow-y:auto;">
            ${inHouse.map(r => {
              const guest = store.getGuest(r.guestId);
              const room = store.getRoom(r.roomId);
              const folio = store.getFolio(r);
              return `
                <div style="padding:12px;background:var(--bg-surface-subtle);border-radius:8px;border:1px solid var(--border-line);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-family:var(--font-display);font-size:18px;font-weight:700;">${room ? room.no : '-'}</span>
                    <span class="chip chip-occupied" style="margin-left:auto;">Occupied</span>
                  </div>
                  <div style="margin-top:4px;font-weight:600;">${guest ? guest.name : 'Guest'}</div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;">
                    <span style="color:var(--text-muted);">Balance:</span>
                    <strong style="color:${folio.balance > 0.5 ? 'var(--status-dirty-fg)' : 'var(--status-clean-fg)'};">
                      ${store.formatMoney(folio.balance)}
                    </strong>
                  </div>
                  <div style="display:flex;gap:6px;margin-top:10px;">
                    <button class="btn btn-sm" style="flex:1;" data-action="folio" data-id="${r.id}">Folio</button>
                    <button class="btn btn-sm" data-action="pos-charge" data-id="${r.id}">+ Charge</button>
                  </div>
                </div>
              `;
            }).join('') || '<div style="color:var(--text-muted);padding:24px;text-align:center;">No guests in house</div>'}
          </div>
        </div>

        <!-- Column 3: Departures Due -->
        <div class="card" style="padding:14px;">
          <div class="card-header" style="margin-bottom:10px;">
            <h3 class="card-title">Departures Due</h3>
            <span class="chip chip-dirty" style="margin-left:auto;">${departures.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${departures.map(r => {
              const guest = store.getGuest(r.guestId);
              const room = store.getRoom(r.roomId);
              const folio = store.getFolio(r);
              const isSettled = folio.balance <= 0.5;
              return `
                <div style="padding:12px;background:var(--bg-surface-subtle);border-radius:8px;border:1px solid var(--border-line);">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-family:var(--font-display);font-size:18px;font-weight:700;">${room ? room.no : '-'}</span>
                    <span class="chip ${isSettled ? 'chip-clean' : 'chip-dirty'}" style="margin-left:auto;">
                      ${isSettled ? 'Settled' : 'Unpaid: ' + store.formatMoney(folio.balance)}
                    </span>
                  </div>
                  <div style="margin-top:4px;font-weight:600;">${guest ? guest.name : 'Guest'}</div>
                  <div style="display:flex;gap:8px;margin-top:10px;">
                    ${isSettled
                      ? `<button class="btn btn-sm btn-primary" style="flex:1;" data-action="checkout" data-id="${r.id}">Complete Check-Out</button>`
                      : `<button class="btn btn-sm btn-accent" style="flex:1;" data-action="pay" data-id="${r.id}">Collect & Check Out</button>`
                    }
                    <button class="btn btn-sm" data-action="folio" data-id="${r.id}">Folio</button>
                  </div>
                </div>
              `;
            }).join('') || '<div style="color:var(--text-muted);padding:24px;text-align:center;">No departures remaining today</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}
