/**
 * Cashiering & Folio Settlement View
 * Audits guest balances, executes payment settlements, and handles shift registers.
 */

import { store } from '../store.js';

export function renderCashier() {
  const receivables = store.getReceivables();
  const today = store.todayISO();

  const todayTxns = store.state.transactions.filter(t => t.date === today);
  const payments = todayTxns.filter(t => t.type === 'payment');

  const mpesaTotal = payments.filter(p => p.method === 'M-Pesa').reduce((s, p) => s + p.amount, 0);
  const cardTotal = payments.filter(p => p.method === 'Card').reduce((s, p) => s + p.amount, 0);
  const cashTotal = payments.filter(p => p.method === 'Cash').reduce((s, p) => s + p.amount, 0);
  const bankTotal = payments.filter(p => p.method === 'Bank').reduce((s, p) => s + p.amount, 0);

  const totalCollectedToday = mpesaTotal + cardTotal + cashTotal + bankTotal;
  const totalReceivables = receivables.reduce((sum, item) => sum + item.folio.balance, 0);

  return `
    <div class="cashier-view" style="display:flex;flex-direction:column;gap:18px;">
      <!-- Shift Totals by Payment Channel -->
      <div class="grid-4" style="gap:12px;">
        <div class="kpi-tile">
          <div class="label">M-Pesa Collections</div>
          <div class="value" style="color:var(--status-clean-fg);">${store.formatMoney(mpesaTotal)}</div>
          <div class="subtext">Safaricom Daraja STK Push</div>
        </div>
        <div class="kpi-tile">
          <div class="label">Card Clearing</div>
          <div class="value" style="color:var(--status-occupied-fg);">${store.formatMoney(cardTotal)}</div>
          <div class="subtext">Awaiting bank settlement</div>
        </div>
        <div class="kpi-tile">
          <div class="label">Cash on Hand</div>
          <div class="value">${store.formatMoney(cashTotal)}</div>
          <div class="subtext">Front desk cash drawer</div>
        </div>
        <div class="kpi-tile">
          <div class="label">Total Collected Today</div>
          <div class="value" style="color:var(--brand-primary);">${store.formatMoney(totalCollectedToday)}</div>
          <div class="subtext">${payments.length} settled receipts</div>
        </div>
      </div>

      <!-- Open Folios List -->
      <div class="card" style="padding:0;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-line);display:flex;align-items:center;justify-content:space-between;">
          <h3 class="card-title">Open Folios with Balances</h3>
          <span style="font-size:13px;color:var(--text-muted);">
            Total Outstanding: <strong style="color:var(--status-dirty-fg);">${store.formatMoney(totalReceivables)}</strong>
          </span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Booking Code</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Stay Dates</th>
                <th class="tabular">Charges (Gross)</th>
                <th class="tabular">Paid</th>
                <th class="tabular">Balance Due</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${receivables.map(({ reservation: r, folio }) => {
                const guest = store.getGuest(r.guestId);
                const room = store.getRoom(r.roomId);
                return `
                  <tr>
                    <td><strong>${r.code}</strong></td>
                    <td>${guest ? guest.name : 'Guest'}</td>
                    <td><strong>${room ? room.no : '-'}</strong></td>
                    <td>${store.fmtShort(r.checkIn)} &ndash; ${store.fmtShort(r.checkOut)}</td>
                    <td class="tabular">${store.formatMoney(folio.totalAmount)}</td>
                    <td class="tabular">${store.formatMoney(folio.totalPaid)}</td>
                    <td class="tabular" style="font-weight:700;color:var(--status-dirty-fg);">${store.formatMoney(folio.balance)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-sm btn-primary" data-action="pay" data-id="${r.id}">Collect Payment</button>
                      <button class="btn btn-sm" data-action="folio" data-id="${r.id}">View Folio</button>
                    </td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">All active guest folios are fully settled.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
