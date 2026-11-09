/**
 * Housekeeping & Room Turnaround View
 * Floor-by-floor operational grid with instant status transitions.
 */

import { store } from '../store.js';

export function renderHousekeeping() {
  const rooms = store.state.rooms;
  const floors = [...new Set(rooms.map(r => r.floor))].sort();

  const dirtyCount = rooms.filter(r => r.hk === 'dirty').length;
  const cleanCount = rooms.filter(r => r.hk === 'clean').length;
  const inspectedCount = rooms.filter(r => r.hk === 'inspected').length;
  const occupiedCount = rooms.filter(r => r.hk === 'occupied').length;

  return `
    <div class="housekeeping-view" style="display:flex;flex-direction:column;gap:18px;">
      <!-- Status Summary Strip -->
      <div class="grid-4" style="gap:12px;">
        <div class="kpi-tile" style="border-left:4px solid var(--status-dirty-fg);">
          <div class="label">Vacant Dirty</div>
          <div class="value" style="color:var(--status-dirty-fg);">${dirtyCount}</div>
          <div class="subtext">Awaiting room attendant</div>
        </div>
        <div class="kpi-tile" style="border-left:4px solid var(--status-clean-fg);">
          <div class="label">Clean & Ready</div>
          <div class="value" style="color:var(--status-clean-fg);">${cleanCount}</div>
          <div class="subtext">Ready for inspection</div>
        </div>
        <div class="kpi-tile" style="border-left:4px solid var(--brand-primary);">
          <div class="label">Supervisor Inspected</div>
          <div class="value" style="color:var(--brand-primary);">${inspectedCount}</div>
          <div class="subtext">Verified for VIP check-in</div>
        </div>
        <div class="kpi-tile" style="border-left:4px solid var(--status-occupied-fg);">
          <div class="label">Occupied Rooms</div>
          <div class="value" style="color:var(--status-occupied-fg);">${occupiedCount}</div>
          <div class="subtext">Daily stayover service</div>
        </div>
      </div>

      <!-- Floor-by-Floor Cards -->
      ${floors.map(floor => {
        const floorRooms = rooms.filter(r => r.floor === floor);
        return `
          <div class="card" style="padding:16px;">
            <div class="card-header" style="margin-bottom:12px;">
              <h3 class="card-title">Floor ${floor}</h3>
              <span style="font-size:12px;color:var(--text-muted);margin-left:auto;">${floorRooms.length} Rooms</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;">
              ${floorRooms.map(rm => {
                const type = store.getRoomType(rm.typeId);
                const isOccupied = rm.hk === 'occupied';
                const isDirty = rm.hk === 'dirty';
                const isClean = rm.hk === 'clean';
                const isInspected = rm.hk === 'inspected';

                return `
                  <div style="padding:12px;border:1px solid var(--border-line);border-radius:8px;background:var(--bg-surface-subtle);display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-family:var(--font-display);font-size:20px;font-weight:700;">${rm.no}</span>
                      <span class="chip ${isOccupied ? 'chip-occupied' : isDirty ? 'chip-dirty' : isClean ? 'chip-clean' : 'chip-brand'}">
                        ${isOccupied ? 'In-House' : isDirty ? 'Dirty' : isClean ? 'Clean' : 'Inspected'}
                      </span>
                    </div>
                    <div style="font-size:12px;color:var(--text-muted);">${type ? type.name : ''}</div>

                    <!-- Status Action Buttons -->
                    <div style="display:flex;gap:6px;margin-top:auto;padding-top:8px;">
                      ${isDirty ? `
                        <button class="btn btn-sm btn-primary" style="flex:1;" data-action="hk-status" data-room="${rm.id}" data-status="clean">
                          Mark Clean
                        </button>
                      ` : ''}
                      ${isClean ? `
                        <button class="btn btn-sm btn-accent" style="flex:1;" data-action="hk-status" data-room="${rm.id}" data-status="inspected">
                          Approve (Inspect)
                        </button>
                      ` : ''}
                      ${!isDirty && !isOccupied ? `
                        <button class="btn btn-sm" style="flex:1;" data-action="hk-status" data-room="${rm.id}" data-status="dirty">
                          Mark Dirty
                        </button>
                      ` : ''}
                      ${isOccupied ? `
                        <span style="font-size:11px;color:var(--text-muted);padding:4px 0;">Guest in residence</span>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
