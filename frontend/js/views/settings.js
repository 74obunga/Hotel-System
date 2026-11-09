/**
 * System Settings & Regional Gateway Configuration
 * Property metadata, rate plan definitions, and Safaricom M-Pesa / Card Gateway settings.
 */

import { store } from '../store.js';
import { api } from '../api.js';

export function renderSettings() {
  const settings = store.state.settings;
  const roomTypes = store.state.roomTypes;

  return `
    <div class="settings-view" style="display:flex;flex-direction:column;gap:20px;max-width:880px;">
      <!-- Property & Tax Settings -->
      <div class="card" style="padding:20px;">
        <h3 style="margin-bottom:14px;">Property Identity & Tax Parameters</h3>
        <div class="grid-2" style="gap:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Hotel Name</label>
            <input type="text" id="set-hotel-name" value="${settings.hotel}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Operating Currency</label>
            <input type="text" id="set-currency" value="${settings.currency}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Standard VAT Rate (%)</label>
            <input type="number" id="set-vat" value="${settings.vatRate}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Check-In Standard Time</label>
            <input type="time" id="set-checkin" value="${settings.checkInTime}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
        </div>
      </div>

      <!-- Safaricom M-Pesa Daraja Integration -->
      <div class="card" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <h3 style="margin:0;">Safaricom M-Pesa Daraja STK Push Gateway</h3>
          <span class="chip chip-brand" style="margin-left:auto;">Integrated</span>
        </div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
          Enables prompt STK PIN push requests directly to guest mobile handsets for instant room deposits and outlet settlements.
        </p>
        <div class="grid-2" style="gap:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Paybill or Till Number</label>
            <input type="text" value="174379" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Environment</label>
            <select style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);">
              <option value="sandbox">Daraja Sandbox (Simulator)</option>
              <option value="production">Daraja Live Production</option>
            </select>
          </div>
        </div>
      </div>

      <!-- FastAPI Backend Connectivity -->
      <div class="card" style="padding:20px;">
        <h3 style="margin-bottom:12px;">FastAPI Backend Operations Connection</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">
          Target API URL: <code>${api.baseUrl || 'http://localhost:8000'}</code>
        </p>
        <div style="display:flex;gap:12px;align-items:center;">
          <button class="btn btn-sm btn-primary" data-action="ping-backend">Ping Backend API Health</button>
          <button class="btn btn-sm" data-action="reset-demo-data">Reset Demo Data</button>
        </div>
      </div>
    </div>
  `;
}

export function handleSettingsActions(action, target) {
  if (action === 'ping-backend') {
    api.checkHealth().then(ok => {
      window.dispatchEvent(new CustomEvent('toast:show', {
        detail: {
          message: ok ? 'Backend API is ONLINE and responding!' : 'Backend API is currently unreachable. Running in Standalone Demo Mode.',
          type: ok ? 'success' : 'error'
        }
      }));
    });
    return true;
  }
  if (action === 'reset-demo-data') {
    localStorage.removeItem('hotel_ops_store_v2');
    store.init();
    store.notify();
    window.dispatchEvent(new CustomEvent('toast:show', { detail: { message: 'Demo data reseeded successfully!', type: 'success' } }));
    return true;
  }
  return false;
}
