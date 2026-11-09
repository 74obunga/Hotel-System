/**
 * Main Application Orchestrator
 * View routing, modal management, theme control, and action delegation.
 */

import { store } from './store.js';
import { api } from './api.js';
import { renderDashboard } from './views/dashboard.js';
import { renderFrontDesk } from './views/frontdesk.js';
import { renderTapeChart, handleTapeActions } from './views/tapechart.js';
import { renderHousekeeping } from './views/housekeeping.js';
import { renderPos, handlePosActions } from './views/pos.js';
import { renderCashier } from './views/cashier.js';
import { renderStatements, handleStatementActions } from './views/statements.js';
import { renderSettings, handleSettingsActions } from './views/settings.js';

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.theme = localStorage.getItem('hotel_theme') || 'light';
    this.activeModal = null;
    this.isBackendOnline = false;
    this.viewUpdater = null;
  }

  setViewUpdater(updater) {
    this.viewUpdater = updater;
  }

  init() {
    this.applyTheme(this.theme);
    this.setupEventListeners();
    this.checkApiStatus();

    // Re-render when store mutates
    store.subscribe(() => {
      this.render();
    });

    this.render();
  }

  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hotel_theme', theme);
  }

  toggleTheme() {
    this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  setSidebarOpen(isOpen) {
    const shell = document.getElementById('app-shell');
    const toggle = document.getElementById('sidebar-toggle-btn');
    if (!shell || !toggle) return;

    shell.classList.toggle('sidebar-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  }

  async checkApiStatus() {
    this.isBackendOnline = await api.checkHealth();
    this.updateStatusPill();
  }

  updateStatusPill() {
    if (this.viewUpdater) {
      this.render();
      return;
    }
    const pill = document.getElementById('system-status-indicator');
    if (!pill) return;
    if (this.isBackendOnline) {
      pill.className = 'system-status-pill';
      pill.innerHTML = '<span class="indicator-dot"></span> Backend API Connected';
    } else {
      pill.className = 'system-status-pill offline';
      pill.innerHTML = '<span class="indicator-dot"></span> Standalone Demo Mode';
    }
    this.render();
  }

  navigate(viewName) {
    this.currentView = viewName;

    this.render();
  }

  render() {
    if (this.viewUpdater) {
      this.viewUpdater(this.currentView);
      return;
    }

    const container = document.getElementById('main-content-view');
    if (!container) return;

    switch (this.currentView) {
      case 'dashboard':
        container.innerHTML = renderDashboard();
        break;
      case 'frontdesk':
        container.innerHTML = renderFrontDesk();
        break;
      case 'tapechart':
        container.innerHTML = renderTapeChart();
        break;
      case 'housekeeping':
        container.innerHTML = renderHousekeeping();
        break;
      case 'pos':
        container.innerHTML = renderPos();
        break;
      case 'cashier':
        container.innerHTML = renderCashier();
        break;
      case 'statements':
        container.innerHTML = renderStatements();
        break;
      case 'settings':
        container.innerHTML = renderSettings();
        break;
      default:
        container.innerHTML = renderDashboard();
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  openModal(title, bodyHtml, footerHtml = '', isWide = false) {
    const backdrop = document.getElementById('modal-backdrop');
    const dialog = backdrop.querySelector('.modal-dialog');
    dialog.className = `modal-dialog ${isWide ? 'wide' : ''}`;

    backdrop.querySelector('.modal-header h2').textContent = title;
    backdrop.querySelector('.modal-body').innerHTML = bodyHtml;
    backdrop.querySelector('.modal-footer').innerHTML = footerHtml;

    backdrop.classList.add('open');
  }

  closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.classList.remove('open');
  }

  // --- Modal Dialog Flow Implementations ---
  showLoginModal() {
    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label for="m-login-email" style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Work email</label>
          <input id="m-login-email" type="email" autocomplete="username" required style="width:100%;padding:9px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
        </div>
        <div>
          <label for="m-login-password" style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Password</label>
          <input id="m-login-password" type="password" autocomplete="current-password" required style="width:100%;padding:9px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
        </div>
      </div>
    `;
    this.openModal('Sign in to the hotel system', body, `
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="confirm-login">Sign in</button>
    `);
  }

  showWalkInModal(prefillRoom = '', prefillDate = '') {
    const today = store.todayISO();
    const rooms = store.state.rooms.filter(r => !r.ooo && r.hk !== 'occupied');

    const body = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Guest Full Name</label>
          <input type="text" id="m-guest-name" placeholder="e.g. Grace Wanjiku" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
        </div>
        <div class="grid-2" style="gap:10px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Mobile Phone (M-Pesa)</label>
            <input type="tel" id="m-guest-phone" placeholder="+2547..." style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Email</label>
            <input type="email" id="m-guest-email" placeholder="guest@example.com" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
        </div>
        <div class="grid-2" style="gap:10px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Assign Available Room</label>
            <select id="m-room-id" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
              ${rooms.map(rm => {
                const t = store.getRoomType(rm.typeId);
                return `<option value="${rm.id}" ${rm.id === prefillRoom ? 'selected' : ''}>Room ${rm.no} - ${t ? t.name : ''} (${store.formatMoney(t ? t.rate : 0)})</option>`;
              }).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Nights Stay</label>
            <input type="number" id="m-nights" value="1" min="1" max="30" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="confirm-walkin">Confirm Walk-In & Check In</button>
    `;

    this.openModal('Quick Walk-In Registration', body, footer);
  }

  showFolioModal(resId) {
    const r = store.getReservation(resId);
    if (!r) return;
    const guest = store.getGuest(r.guestId);
    const room = store.getRoom(r.roomId);
    const folio = store.getFolio(r);

    const body = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Header Info Card -->
        <div style="display:grid;grid-template-columns:1fr 1fr;background:var(--bg-surface-subtle);padding:14px;border-radius:8px;gap:10px;font-size:13px;">
          <div><strong>Guest:</strong> ${guest ? guest.name : 'Unknown'}</div>
          <div><strong>Room:</strong> ${room ? room.no : '-'}</div>
          <div><strong>Stay:</strong> ${store.fmtShort(r.checkIn)} to ${store.fmtShort(r.checkOut)} (${folio.nights} nights)</div>
          <div><strong>Status:</strong> <span class="chip ${r.status === 'checked_in' ? 'chip-occupied' : 'chip-clean'}">${r.status.replace('_', ' ').toUpperCase()}</span></div>
        </div>

        <!-- Ledger Table -->
        <table class="data-table" style="font-size:13px;">
          <thead>
            <tr><th>Date</th><th>Item Description</th><th class="tabular">Net</th><th class="tabular">VAT (16%)</th><th class="tabular">Gross</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${store.fmtShort(r.checkIn)}</td>
              <td>Room Charge (${folio.postedNights} nights @ ${store.formatMoney(r.rate)})</td>
              <td class="tabular">${store.formatMoney(folio.roomNet)}</td>
              <td class="tabular">${store.formatMoney(folio.roomTax)}</td>
              <td class="tabular">${store.formatMoney(folio.roomGross)}</td>
            </tr>
            ${folio.charges.map(c => `
              <tr>
                <td>${store.fmtShort(c.date)}</td>
                <td>${c.note || c.dept}</td>
                <td class="tabular">${store.formatMoney(c.net)}</td>
                <td class="tabular">${store.formatMoney(c.tax)}</td>
                <td class="tabular">${store.formatMoney(c.amount)}</td>
              </tr>
            `).join('')}
            ${folio.payments.map(p => `
              <tr style="color:var(--status-clean-fg);">
                <td>${store.fmtShort(p.date)}</td>
                <td>Payment: ${p.method} (${p.ref})</td>
                <td class="tabular">-</td>
                <td class="tabular">-</td>
                <td class="tabular font-bold">-${store.formatMoney(p.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight:700;border-top:2px solid var(--border-line);">
              <td colspan="4">Total Billable</td>
              <td class="tabular">${store.formatMoney(folio.totalAmount)}</td>
            </tr>
            <tr style="font-weight:700;color:var(--status-clean-fg);">
              <td colspan="4">Total Payments Received</td>
              <td class="tabular">-${store.formatMoney(folio.totalPaid)}</td>
            </tr>
            <tr style="font-weight:700;font-size:15px;background:var(--bg-surface-subtle);">
              <td colspan="4">Outstanding Folio Balance</td>
              <td class="tabular" style="color:${folio.balance > 0.5 ? 'var(--status-dirty-fg)' : 'var(--status-clean-fg)'};">
                ${store.formatMoney(folio.balance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    const footer = `
      <button class="btn" data-action="close-modal">Close</button>
      ${folio.balance > 0.5 ? `
        <button class="btn btn-primary" data-action="pay" data-id="${r.id}">Collect Payment</button>
      ` : ''}
    `;

    this.openModal(`Guest Folio: ${r.code}`, body, footer, true);
  }

  showPaymentModal(resId) {
    const r = store.getReservation(resId);
    if (!r) return;
    const folio = store.getFolio(r);
    const guest = store.getGuest(r.guestId);

    const body = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="background:var(--bg-surface-subtle);padding:12px;border-radius:8px;">
          <div>Settling Folio: <strong>${r.code}</strong> (${guest ? guest.name : 'Guest'})</div>
          <div style="font-size:16px;font-weight:700;color:var(--status-dirty-fg);margin-top:4px;">
            Balance Due: ${store.formatMoney(folio.balance)}
          </div>
        </div>

        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px;">Select Payment Method</label>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
            <button class="btn btn-sm" id="pay-meth-mpesa" style="background:var(--brand-primary-light);color:var(--brand-primary);font-weight:600;" data-pay-method="M-Pesa">M-Pesa STK</button>
            <button class="btn btn-sm" data-pay-method="Card">Card</button>
            <button class="btn btn-sm" data-pay-method="Cash">Cash</button>
            <button class="btn btn-sm" data-pay-method="Bank">Bank</button>
          </div>
        </div>

        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Amount to Pay (KES)</label>
          <input type="number" id="pay-amount" value="${folio.balance}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
        </div>

        <div id="mpesa-fields">
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">Customer Phone Number for STK Push</label>
          <input type="tel" id="pay-phone" value="${guest ? guest.phone : '+254712345678'}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          <small style="color:var(--text-muted);margin-top:3px;display:block;">Safaricom Daraja will trigger a prompt on this handset.</small>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="confirm-payment" data-id="${r.id}">Process Payment</button>
    `;

    this.openModal('Collect Folio Payment', body, footer);
  }

  setupEventListeners() {
    // Navigation routing clicks
    document.addEventListener('click', e => {
      const sidebarToggle = e.target.closest('#sidebar-toggle-btn');
      if (sidebarToggle) {
        this.setSidebarOpen(!document.getElementById('app-shell').classList.contains('sidebar-open'));
        return;
      }

      const shell = document.getElementById('app-shell');
      if (e.target === shell && shell.classList.contains('sidebar-open')) {
        this.setSidebarOpen(false);
        return;
      }

      const navBtn = e.target.closest('[data-view]');
      if (navBtn) {
        e.preventDefault();
        this.navigate(navBtn.dataset.view);
        this.setSidebarOpen(false);
        return;
      }

      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;

      // Modal Triggers
      if (action === 'modal-walkin') {
        this.showWalkInModal();
      } else if (action === 'modal-newbooking') {
        this.showWalkInModal();
      } else if (action === 'login') {
        this.showLoginModal();
      } else if (action === 'logout') {
        api.setToken(null);
        this.render();
        window.dispatchEvent(new CustomEvent('analytics:refresh'));
        this.showToast('You have signed out.', 'info');
      } else if (action === 'confirm-login') {
        const email = document.getElementById('m-login-email')?.value.trim();
        const password = document.getElementById('m-login-password')?.value;
        if (!email || !password) {
          this.showToast('Enter your email and password to sign in.', 'error');
          return;
        }
        api.login(email, password).then(() => {
          this.closeModal();
          this.render();
          window.dispatchEvent(new CustomEvent('analytics:refresh'));
          this.showToast('Signed in successfully.', 'success');
        }).catch(error => {
          this.showToast(error.message || 'Sign in failed.', 'error');
        });
      } else if (action === 'close-modal') {
        this.closeModal();
      } else if (action === 'checkin') {
        const id = actionBtn.dataset.id;
        store.updateReservationStatus(id, 'checked_in');
        this.showToast('Guest checked in successfully!', 'success');
      } else if (action === 'checkout') {
        const id = actionBtn.dataset.id;
        store.updateReservationStatus(id, 'checked_out');
        this.showToast('Guest checked out successfully! Room marked dirty.', 'success');
      } else if (action === 'folio') {
        const id = actionBtn.dataset.id;
        this.showFolioModal(id);
      } else if (action === 'pay') {
        const id = actionBtn.dataset.id;
        this.showPaymentModal(id);
      } else if (action === 'confirm-walkin') {
        const name = document.getElementById('m-guest-name')?.value || 'Walk-In Guest';
        const phone = document.getElementById('m-guest-phone')?.value || '+254700000000';
        const roomId = document.getElementById('m-room-id')?.value;
        const nights = parseInt(document.getElementById('m-nights')?.value || '1', 10);

        const guestId = 'g_' + Date.now();
        store.state.guests.push({ id: guestId, name, phone, email: '', company: '' });

        const room = store.getRoom(roomId);
        const type = room ? store.getRoomType(room.typeId) : null;
        const rate = type ? type.rate : 8000;

        const res = store.addReservation({
          guestId,
          roomId,
          checkIn: store.todayISO(),
          checkOut: store.addDays(store.todayISO(), nights),
          adults: 1,
          rate,
          source: 'Walk-in'
        });

        store.updateReservationStatus(res.id, 'checked_in');
        this.closeModal();
        this.showToast(`Walk-in checked into Room ${room ? room.no : ''}!`, 'success');
      } else if (action === 'confirm-payment') {
        const id = actionBtn.dataset.id;
        const amount = parseFloat(document.getElementById('pay-amount')?.value || '0');
        store.postPayment(id, amount, 'M-Pesa', '', 'Front desk STK settlement');
        this.closeModal();
        this.showToast(`Payment of ${store.formatMoney(amount)} recorded!`, 'success');
      } else if (action === 'hk-status') {
        const roomId = actionBtn.dataset.room;
        const status = actionBtn.dataset.status;
        store.setRoomHkStatus(roomId, status);
        this.showToast(`Room marked ${status}!`, 'info');
      } else if (action === 'tape-book') {
        this.showWalkInModal(actionBtn.dataset.room, actionBtn.dataset.date);
      } else if (handleTapeActions(action, actionBtn)) {
        this.render();
      } else if (handlePosActions(action, actionBtn)) {
        this.render();
      } else if (handleStatementActions(action, actionBtn)) {
        this.render();
      } else if (handleSettingsActions(action, actionBtn)) {
        this.render();
      }
    });

    // Custom Toast Listener
    window.addEventListener('toast:show', e => {
      this.showToast(e.detail.message, e.detail.type);
    });
  }
}

export const app = new App();
