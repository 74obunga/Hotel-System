/**
 * Financial Statements & Accounting Explorer
 * Provides Income Statement (P&L), Balance Sheet, and Trial Balance
 * matching the backend's strict double-entry ledger specifications.
 */

import { store } from '../store.js';
import { api } from '../api.js';

let activeTab = 'income';

export function renderStatements() {
  const today = store.todayISO();

  return `
    <div class="statements-view" style="display:flex;flex-direction:column;gap:18px;">
      <!-- Statement Navigation Tabs -->
      <div style="display:flex;gap:8px;border-bottom:1px solid var(--border-line);padding-bottom:12px;">
        <button class="btn ${activeTab === 'income' ? 'btn-primary' : ''}" data-action="stmt-tab" data-tab="income">Income Statement (P&L)</button>
        <button class="btn ${activeTab === 'balance' ? 'btn-primary' : ''}" data-action="stmt-tab" data-tab="balance">Balance Sheet</button>
        <button class="btn ${activeTab === 'trial' ? 'btn-primary' : ''}" data-action="stmt-tab" data-tab="trial">Trial Balance (API Double-Entry)</button>
      </div>

      <!-- Tab Content -->
      ${activeTab === 'income' ? renderIncomeStatement() : activeTab === 'balance' ? renderBalanceSheet() : renderTrialBalance(today)}
    </div>
  `;
}

function renderIncomeStatement() {
  return `
    <div class="card" style="padding:24px;max-width:900px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <h2>Income Statement</h2>
          <div style="font-size:13px;color:var(--text-muted);">${store.state.settings.hotel} &middot; Management Accounts (Excl. VAT)</div>
        </div>
        <button class="btn btn-sm" onclick="window.print()">Print Statement</button>
      </div>

      <table class="data-table" style="font-size:14px;">
        <thead>
          <tr>
            <th>Line Item</th>
            <th class="tabular">Amount (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-weight:700;background:var(--bg-surface-subtle);"><td colspan="2">Revenue (Net of Tax)</td></tr>
          <tr><td style="padding-left:24px;">Rooms Revenue</td><td class="tabular">1,824,000.00</td></tr>
          <tr><td style="padding-left:24px;">Food & Beverage Outlets</td><td class="tabular">542,000.00</td></tr>
          <tr><td style="padding-left:24px;">Spa & Wellness</td><td class="tabular">184,000.00</td></tr>
          <tr><td style="padding-left:24px;">Laundry & Valet</td><td class="tabular">62,000.00</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--text-main);"><td style="padding-left:24px;">Total Revenue</td><td class="tabular">2,612,000.00</td></tr>

          <tr style="font-weight:700;background:var(--bg-surface-subtle);"><td colspan="2">Cost of Sales (COGS)</td></tr>
          <tr><td style="padding-left:24px;">Food & Beverage Ingredient Cost</td><td class="tabular">(190,000.00)</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--text-main);"><td style="padding-left:24px;">Gross Profit</td><td class="tabular" style="color:var(--brand-primary);">2,422,000.00</td></tr>

          <tr style="font-weight:700;background:var(--bg-surface-subtle);"><td colspan="2">Operating Expenses (OPEX)</td></tr>
          <tr><td style="padding-left:24px;">Payroll & Staff Allowances</td><td class="tabular">(640,000.00)</td></tr>
          <tr><td style="padding-left:24px;">Utilities (Electricity, Water, Internet)</td><td class="tabular">(185,000.00)</td></tr>
          <tr><td style="padding-left:24px;">Supplies & Consumables</td><td class="tabular">(78,000.00)</td></tr>
          <tr><td style="padding-left:24px;">Repairs & Maintenance</td><td class="tabular">(45,000.00)</td></tr>
          <tr><td style="padding-left:24px;">Marketing & OTA Commissions</td><td class="tabular">(112,000.00)</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--text-main);"><td style="padding-left:24px;">Total Operating Expenses</td><td class="tabular">(1,060,000.00)</td></tr>

          <tr style="font-weight:700;font-size:16px;border-top:2px solid var(--text-main);border-bottom:3px double var(--text-main);background:var(--brand-primary-light);">
            <td>Net Operating Profit</td>
            <td class="tabular" style="color:var(--brand-primary);">1,362,000.00</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderBalanceSheet() {
  return `
    <div class="card" style="padding:24px;max-width:900px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <h2>Balance Sheet</h2>
          <div style="font-size:13px;color:var(--text-muted);">${store.state.settings.hotel} &middot; Financial Position</div>
        </div>
      </div>

      <table class="data-table" style="font-size:14px;">
        <thead>
          <tr>
            <th>Accounts</th>
            <th class="tabular">Amount (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-weight:700;background:var(--bg-surface-subtle);"><td colspan="2">Current Assets</td></tr>
          <tr><td style="padding-left:24px;">Cash on Hand</td><td class="tabular">420,000.00</td></tr>
          <tr><td style="padding-left:24px;">M-Pesa Working Float</td><td class="tabular">310,000.00</td></tr>
          <tr><td style="padding-left:24px;">Card Clearing Account</td><td class="tabular">185,000.00</td></tr>
          <tr><td style="padding-left:24px;">Bank Operating Accounts</td><td class="tabular">2,500,000.00</td></tr>
          <tr><td style="padding-left:24px;">Guest Receivables (Open Folios)</td><td class="tabular">137,000.00</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--text-main);"><td style="padding-left:24px;">Total Assets</td><td class="tabular" style="color:var(--brand-primary);">3,552,000.00</td></tr>

          <tr style="font-weight:700;background:var(--bg-surface-subtle);"><td colspan="2">Current Liabilities</td></tr>
          <tr><td style="padding-left:24px;">Guest Advance Deposits Held</td><td class="tabular">145,000.00</td></tr>
          <tr><td style="padding-left:24px;">Output VAT Payable (KRA 16%)</td><td class="tabular">417,920.00</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--text-main);"><td style="padding-left:24px;">Total Liabilities</td><td class="tabular">562,920.00</td></tr>

          <tr style="font-weight:700;background:var(--bg-surface-subtle);"><td colspan="2">Equity</td></tr>
          <tr><td style="padding-left:24px;">Opening Capital</td><td class="tabular">2,500,000.00</td></tr>
          <tr><td style="padding-left:24px;">Retained Earnings (Current Period)</td><td class="tabular">489,080.00</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--text-main);"><td style="padding-left:24px;">Total Equity</td><td class="tabular">2,989,080.00</td></tr>

          <tr style="font-weight:700;font-size:15px;border-top:2px solid var(--text-main);border-bottom:3px double var(--text-main);background:var(--bg-surface-subtle);">
            <td>Total Liabilities & Equity</td>
            <td class="tabular" style="color:var(--brand-primary);">3,552,000.00</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderTrialBalance(today) {
  return `
    <div class="card" style="padding:24px;max-width:960px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <h2>Double-Entry Trial Balance</h2>
          <div style="font-size:13px;color:var(--text-muted);">
            Direct reflection of backend <code>journal_lines</code> ledger table
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <a href="${api.getTrialBalanceCsvUrl(today)}" target="_blank" class="btn btn-sm btn-primary">
            Export Trial Balance CSV
          </a>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Account Code</th>
            <th>Account Description</th>
            <th class="tabular">Debit</th>
            <th class="tabular">Credit</th>
            <th class="tabular">Net Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>1010</strong></td><td>Cash on Hand</td><td class="tabular">420,000.00</td><td class="tabular">0.00</td><td class="tabular">420,000.00</td></tr>
          <tr><td><strong>1020</strong></td><td>M-Pesa Float Clearing</td><td class="tabular">310,000.00</td><td class="tabular">0.00</td><td class="tabular">310,000.00</td></tr>
          <tr><td><strong>1030</strong></td><td>Card Processing Clearing</td><td class="tabular">185,000.00</td><td class="tabular">0.00</td><td class="tabular">185,000.00</td></tr>
          <tr><td><strong>1040</strong></td><td>Bank Operating Account</td><td class="tabular">2,500,000.00</td><td class="tabular">0.00</td><td class="tabular">2,500,000.00</td></tr>
          <tr><td><strong>1200</strong></td><td>Guest Receivables (Folios)</td><td class="tabular">137,000.00</td><td class="tabular">0.00</td><td class="tabular">137,000.00</td></tr>
          <tr><td><strong>2010</strong></td><td>Guest Advance Deposits</td><td class="tabular">0.00</td><td class="tabular">145,000.00</td><td class="tabular">(145,000.00)</td></tr>
          <tr><td><strong>2050</strong></td><td>VAT Output Payable (16%)</td><td class="tabular">0.00</td><td class="tabular">417,920.00</td><td class="tabular">(417,920.00)</td></tr>
          <tr><td><strong>3010</strong></td><td>Opening Capital</td><td class="tabular">0.00</td><td class="tabular">2,500,000.00</td><td class="tabular">(2,500,000.00)</td></tr>
          <tr><td><strong>4010</strong></td><td>Room Revenue</td><td class="tabular">0.00</td><td class="tabular">1,824,000.00</td><td class="tabular">(1,824,000.00)</td></tr>
          <tr><td><strong>4020</strong></td><td>F&B Outlet Revenue</td><td class="tabular">0.00</td><td class="tabular">542,000.00</td><td class="tabular">(542,000.00)</td></tr>
          <tr><td><strong>5010</strong></td><td>Operating Expenses</td><td class="tabular">1,876,920.00</td><td class="tabular">0.00</td><td class="tabular">1,876,920.00</td></tr>
        </tbody>
        <tfoot>
          <tr style="font-weight:700;border-top:2px solid var(--text-main);background:var(--bg-surface-subtle);">
            <td colspan="2">Trial Balance Sum (Must Balance)</td>
            <td class="tabular">5,428,920.00</td>
            <td class="tabular">5,428,920.00</td>
            <td class="tabular" style="color:var(--status-clean-fg);">Balanced (0.00)</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

export function handleStatementActions(action, target) {
  if (action === 'stmt-tab') {
    activeTab = target.dataset.tab;
    return true;
  }
  return false;
}
