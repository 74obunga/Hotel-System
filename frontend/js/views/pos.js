/**
 * Point of Sale (POS) Outlet Terminal
 * Charges guest incidental expenses (F&B, Spa, Laundry) directly to room folios.
 */

import { store } from '../store.js';

let activeCart = {}; // { itemId: qty }
let selectedResId = '';

export function renderPos() {
  const inHouse = store.state.reservations.filter(r => r.status === 'checked_in');
  if (!selectedResId && inHouse.length > 0) {
    selectedResId = inHouse[0].id;
  }

  const catalog = store.state.catalog;
  const depts = [...new Set(catalog.map(c => c.dept))];

  // Cart calculations
  const cartItems = Object.entries(activeCart).map(([id, qty]) => {
    const item = catalog.find(c => c.id === id);
    return { item, qty, lineTotal: item ? item.price * qty : 0 };
  }).filter(x => x.item && x.qty > 0);

  const subtotal = cartItems.reduce((sum, x) => sum + x.lineTotal, 0);
  const vat = store.vatOf(subtotal);
  const grandTotal = Math.round((subtotal + vat) * 100) / 100;

  return `
    <div class="pos-view" style="display:grid;grid-template-columns:minmax(0, 1.8fr) minmax(0, 1.2fr);gap:20px;align-items:start;">
      <!-- Left: Item Menu & Catalog -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${depts.map(dept => {
          const deptItems = catalog.filter(c => c.dept === dept);
          return `
            <div class="card" style="padding:16px;">
              <h3 style="margin-bottom:12px;font-size:15px;color:var(--text-main);">${dept}</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));gap:10px;">
                ${deptItems.map(item => {
                  const qtyInCart = activeCart[item.id] || 0;
                  return `
                    <button class="btn" style="display:flex;flex-direction:column;align-items:flex-start;padding:12px;text-align:left;height:auto;position:relative;"
                      data-action="pos-add" data-id="${item.id}">
                      <strong style="font-size:13.5px;color:var(--text-main);">${item.name}</strong>
                      <span style="font-size:13px;color:var(--brand-primary);font-weight:600;margin-top:4px;">
                        ${store.formatMoney(item.price)}
                      </span>
                      ${qtyInCart > 0 ? `
                        <span class="chip chip-brand" style="position:absolute;top:8px;right:8px;font-size:10px;">${qtyInCart} in cart</span>
                      ` : ''}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Right: Folio Charge Terminal & Cart -->
      <div class="card" style="position:sticky;top:80px;padding:18px;">
        <h3 style="margin-bottom:14px;font-size:16px;">Post Charge to Room</h3>

        <!-- Destination Room Selector -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:5px;">Select In-House Room</label>
          <select id="pos-room-select" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-line);background:var(--bg-surface);color:var(--text-main);font-size:13px;">
            ${inHouse.map(r => {
              const guest = store.getGuest(r.guestId);
              const room = store.getRoom(r.roomId);
              return `<option value="${r.id}" ${r.id === selectedResId ? 'selected' : ''}>Room ${room ? room.no : '-'} &mdash; ${guest ? guest.name : 'Guest'}</option>`;
            }).join('') || '<option value="">No guests in house</option>'}
          </select>
        </div>

        <!-- Order List -->
        <div style="border-top:1px solid var(--border-line);border-bottom:1px solid var(--border-line);padding:10px 0;margin:10px 0;max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
          ${cartItems.map(({ item, qty, lineTotal }) => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;">
              <div style="flex:1;">
                <div>${item.name}</div>
                <div style="font-size:11px;color:var(--text-muted);">${store.formatMoney(item.price)} each</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin:0 12px;">
                <button class="btn btn-sm" style="width:24px;height:24px;padding:0;" data-action="pos-dec" data-id="${item.id}">-</button>
                <strong>${qty}</strong>
                <button class="btn btn-sm" style="width:24px;height:24px;padding:0;" data-action="pos-add" data-id="${item.id}">+</button>
              </div>
              <strong class="tabular" style="min-width:60px;text-align:right;">${store.formatMoney(lineTotal)}</strong>
            </div>
          `).join('') || '<div style="color:var(--text-muted);text-align:center;padding:18px;">Cart is empty. Select items to post.</div>'}
        </div>

        <!-- Totals Table -->
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;color:var(--text-muted);">
            <span>Subtotal (Net)</span>
            <span class="tabular">${store.formatMoney(subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:var(--text-muted);">
            <span>VAT (16%)</span>
            <span class="tabular">${store.formatMoney(vat)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;border-top:1px solid var(--border-line);padding-top:6px;">
            <span>Total Billable</span>
            <span class="tabular" style="color:var(--brand-primary);">${store.formatMoney(grandTotal)}</span>
          </div>
        </div>

        <!-- Buttons -->
        <div style="display:flex;gap:10px;">
          <button class="btn btn-primary" style="flex:1;" data-action="pos-post-charge" ${cartItems.length && inHouse.length ? '' : 'disabled'}>
            Post to Guest Folio
          </button>
          <button class="btn" data-action="pos-clear-cart" ${cartItems.length ? '' : 'disabled'}>
            Clear
          </button>
        </div>
      </div>
    </div>
  `;
}

export function handlePosActions(action, target) {
  if (action === 'pos-add') {
    const id = target.closest('[data-id]')?.dataset.id;
    if (id) {
      activeCart[id] = (activeCart[id] || 0) + 1;
      return true;
    }
  }
  if (action === 'pos-dec') {
    const id = target.closest('[data-id]')?.dataset.id;
    if (id && activeCart[id] > 0) {
      activeCart[id] -= 1;
      if (activeCart[id] === 0) delete activeCart[id];
      return true;
    }
  }
  if (action === 'pos-clear-cart') {
    activeCart = {};
    return true;
  }
  if (action === 'pos-post-charge') {
    const select = document.getElementById('pos-room-select');
    const resId = select ? select.value : selectedResId;
    if (!resId) return false;

    for (const [id, qty] of Object.entries(activeCart)) {
      const item = store.state.catalog.find(c => c.id === id);
      if (item && qty > 0) {
        store.postCharge(resId, item.dept, `${item.name} (x${qty})`, item.price * qty);
      }
    }
    activeCart = {};
    window.dispatchEvent(new CustomEvent('toast:show', { detail: { message: 'Charges posted successfully to room folio!', type: 'success' } }));
    return true;
  }
  return false;
}
