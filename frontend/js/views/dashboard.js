/**
 * Executive Dashboard View
 * High-level occupancy pulse, financial KPIs, operational queue,
 * and 14/28-day graphical trends.
 */

import { store } from '../store.js';
import { barChart, lineChart, donutChart } from '../charts.js';

export function renderDashboard(analytics = null) {
  const today = store.todayISO();
  const rooms = store.state.rooms;
  const sellable = rooms.filter(r => !r.ooo).length || 1;
  const inHouse = store.state.reservations.filter(r => r.status === 'checked_in');
  const arrivals = store.state.reservations.filter(r => r.status === 'confirmed' && r.checkIn <= today);
  const departures = inHouse.filter(r => r.checkOut <= today);

  const occRate = analytics?.occupancy_rate ?? Math.round((inHouse.length / sellable) * 100);
  const occupiedRoomCount = analytics?.occupied_rooms ?? inHouse.length;
  const arrivalsDue = analytics?.arrivals_due ?? arrivals.length;
  const departuresDue = analytics?.departures_due ?? departures.length;

  // Revenue computations
  const txns = store.state.transactions;
  const todayCharges = txns.filter(t => t.date === today && t.type === 'charge');
  const revToday = todayCharges.reduce((acc, c) => acc + (c.net || 0), 0);

  // Generate 14-day sample labels and series
  const d14Labels = [];
  const roomRevVals = [];
  const otherRevVals = [];
  for (let i = 13; i >= 0; i--) {
    const d = store.addDays(today, -i);
    d14Labels.push(store.fmtShort(d));
    const dayCharges = txns.filter(t => t.date === d && t.type === 'charge');
    const rNet = dayCharges.filter(c => c.dept === 'Rooms').reduce((s, c) => s + (c.net || 0), 0);
    const oNet = dayCharges.filter(c => c.dept !== 'Rooms').reduce((s, c) => s + (c.net || 0), 0);
    roomRevVals.push(rNet || (i === 0 ? 32000 : 24000 + (i % 5) * 4500));
    otherRevVals.push(oNet || (i === 0 ? 8500 : 6000 + (i % 3) * 2200));
  }
  const journalByDate = new Map((analytics?.daily_journal_activity || []).map(day => [day.date, day]));
  const dailyJournal = d14Labels.map((_, index) => journalByDate.get(store.addDays(today, index - 13)));
  const chartFirstSeries = analytics
    ? dailyJournal.map(day => day?.debit || 0)
    : roomRevVals;
  const chartSecondSeries = analytics
    ? dailyJournal.map(day => day?.credit || 0)
    : otherRevVals;

  // 28-day Occupancy Trend
  const d28Labels = [];
  const occVals = [];
  for (let i = -13; i <= 14; i++) {
    const d = store.addDays(today, i);
    d28Labels.push(store.fmtShort(d));
    const simulatedOcc = Math.min(100, Math.max(35, 65 + (i * 2) % 30));
    occVals.push(i === 0 ? occRate : simulatedOcc);
  }
  if (analytics?.occupancy_trend?.length) {
    d28Labels.splice(0, d28Labels.length, ...analytics.occupancy_trend.map(point => store.fmtShort(point.date)));
    occVals.splice(0, occVals.length, ...analytics.occupancy_trend.map(point => point.occupancy_rate));
  }

  const demoDeptMix = [
    { label: 'Rooms', value: 385000, color: 'var(--brand-primary)' },
    { label: 'F&B Outlet', value: 142000, color: 'var(--brand-brass)' },
    { label: 'Spa & Wellness', value: 68000, color: 'var(--color-series-4)' },
    { label: 'Transport', value: 34000, color: 'var(--color-series-6)' }
  ];
  const accountActivity = analytics?.journal_activity || [];
  const deptMix = analytics
    ? accountActivity.map((account, index) => ({
      label: account.account_code,
      value: account.debit + account.credit,
      color: `var(--color-series-${(index % 6) + 1})`
    })).filter(account => account.value > 0)
    : demoDeptMix;
  const totalLedgerMovement = accountActivity.reduce((sum, account) => sum + account.debit + account.credit, 0);
  const todayLedger = analytics?.daily_journal_activity?.find(day => day.date === today);
  const todayIndex = analytics?.occupancy_trend?.findIndex(point => point.date === today) ?? 13;

  return `
    <div class="dashboard-view">
      <section class="dashboard-hero" aria-label="Savanna Crest Hotel System overview">
        <div class="dashboard-hero-content">
          <div class="dashboard-hero-eyebrow">Savanna Crest &middot; Daily Briefing</div>
          <h2>Every detail,<br>beautifully in place.</h2>
          <p>Welcome back. Here is the rhythm of the hotel today, from guest arrivals to the rooms ready to welcome them.</p>
          <div class="dashboard-hero-actions">
            <button class="btn btn-primary" data-action="modal-newbooking">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Create a booking
            </button>
            <button class="btn btn-hero-secondary" data-view="frontdesk">Open front desk</button>
          </div>
        </div>
      </section>

      <div class="dashboard-section-label">Today at a glance</div>
      <div class="dashboard-overview">
        <div class="card dashboard-occupancy">
          <div style="font-size:12px;text-transform:uppercase;color:var(--text-muted);font-weight:600;letter-spacing:0.04em;">Current Occupancy</div>
          <div class="occupancy-value">${occRate}%</div>
          <div style="font-size:13px;color:var(--text-muted);">
            <strong>${occupiedRoomCount}</strong> of <strong>${analytics?.sellable_rooms ?? sellable}</strong> sellable rooms occupied
          </div>
          <div class="occupancy-progress" role="img" aria-label="${occRate}% of sellable rooms are occupied">
            <span style="width:${occRate}%;"></span>
            <span style="width:${Math.round(((rooms.length - sellable) / rooms.length) * 100)}%;"></span>
          </div>
        </div>

        <div class="dashboard-kpi-grid">
          <div class="kpi-tile">
            <div class="label">Arrivals Due</div>
            <div class="value">${arrivalsDue}</div>
            <div class="subtext">${occupiedRoomCount} in house &middot; ${departuresDue} due out</div>
          </div>
          <div class="kpi-tile">
            <div class="label">${analytics ? "Today's Journal Credits" : "Today's Revenue"}</div>
            <div class="value">${store.formatMoney(analytics ? (todayLedger?.credit || 0) : (revToday || 40500))}</div>
            <div class="subtext">${analytics ? 'Posted credits across ledger accounts' : 'Excludes 16% VAT · Demo data'}</div>
          </div>
          <div class="kpi-tile">
            <div class="label">ADR (Average Rate)</div>
            <div class="value">${store.formatMoney(analytics?.adr ?? 11250)}</div>
            <div class="subtext">${analytics ? 'Average rate of rooms occupied today' : 'Illustrative demo metric'}</div>
          </div>
          <div class="kpi-tile">
            <div class="label">RevPAR</div>
            <div class="value">${store.formatMoney(analytics?.revpar ?? 7875)}</div>
            <div class="subtext">${analytics ? 'Room revenue per active room today' : 'Illustrative demo metric'}</div>
          </div>
          <div class="kpi-tile">
            <div class="label">Departures Today</div>
            <div class="value">${departuresDue}</div>
            <div class="subtext">Pending check-out audits</div>
          </div>
          <div class="kpi-tile">
            <div class="label">Open Receivables</div>
            <div class="value">${analytics ? '—' : store.formatMoney(37700)}</div>
            <div class="subtext">${analytics ? 'Not available from the current ledger API' : 'Pending folio settlements · Demo data'}</div>
          </div>
        </div>
      </div>

      <!-- Trend Charts -->
      <div class="grid-2 dashboard-charts" style="gap:18px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${analytics ? '14-Day Journal Activity' : '14-Day Revenue Breakdown'}</h3>
            <div style="margin-left:auto;display:flex;gap:12px;font-size:12px;">
              <span style="display:inline-flex;align-items:center;gap:5px;"><i style="width:8px;height:8px;background:var(--brand-primary);display:inline-block;border-radius:2px;"></i>${analytics ? 'Debits' : 'Rooms'}</span>
              <span style="display:inline-flex;align-items:center;gap:5px;"><i style="width:8px;height:8px;background:var(--brand-brass);display:inline-block;border-radius:2px;"></i>${analytics ? 'Credits' : 'Outlets'}</span>
            </div>
          </div>
          ${barChart(d14Labels, [
            { name: analytics ? 'Debits' : 'Rooms', values: chartFirstSeries, color: 'var(--brand-primary)' },
            { name: analytics ? 'Credits' : 'Outlets', values: chartSecondSeries, color: 'var(--brand-brass)' }
          ])}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Occupancy Forecast (28 Days)</h3>
          </div>
          ${lineChart(d28Labels, occVals, {
            max: 100,
            color: 'var(--color-series-3)',
            todayIndex,
            formatSuffix: '%'
          })}
        </div>
      </div>

      <!-- Revenue Mix & Action Roster -->
      <div class="grid-2 dashboard-actions" style="gap:18px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">${analytics ? 'Ledger Movement by Account' : 'Revenue Share by Department · Demo data'}</h3>
          </div>
          ${donutChart(deptMix, analytics ? store.formatMoney(totalLedgerMovement) : 'KES 629k')}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Immediate Attention Queue</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${analytics ? (analytics.arrivals || []).map(arrival => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg-surface-subtle);border-radius:8px;">
                <span class="chip chip-brand">Arrival</span>
                <div style="flex:1;">
                  <strong>${arrival.guest_name}</strong>
                  <div style="font-size:12px;color:var(--text-muted);">Room ${arrival.room_number} &middot; Code ${arrival.code}</div>
                </div>
                <button class="btn btn-sm" data-view="frontdesk">Open Front Desk</button>
              </div>
            `).join('') || '<div style="color:var(--text-muted);padding:14px;text-align:center;">No arrivals due today</div>' : arrivals.map(r => {
              const guest = store.getGuest(r.guestId);
              const room = store.getRoom(r.roomId);
              return `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg-surface-subtle);border-radius:8px;">
                  <span class="chip chip-brand">Arrival</span>
                  <div style="flex:1;">
                    <strong>${guest ? guest.name : 'Guest'}</strong>
                    <div style="font-size:12px;color:var(--text-muted);">Room ${room ? room.no : '-'} &middot; Code ${r.code}</div>
                  </div>
                  <button class="btn btn-sm btn-primary" data-action="checkin" data-id="${r.id}">Check In</button>
                </div>
              `;
            }).join('') || '<div style="color:var(--text-muted);padding:14px;text-align:center;">No arrivals pending today</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}
