import { useEffect, useMemo, useState } from 'react';
import type { ECharts } from 'echarts';
import { api } from '../js/api.js';
import { store } from '../js/store.js';

type ReportTab = 'income' | 'balance' | 'trial';
interface TrialBalanceRow {
  account_code: string;
  debit: string;
  credit: string;
  balance: string;
}
interface AccountActivity {
  account_code: string;
  debit: number;
  credit: number;
}
interface AnalyticsReport {
  journal_activity: AccountActivity[];
}

const tabs: { id: ReportTab; label: string }[] = [
  { id: 'income', label: 'Income Statement (P&L)' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'trial', label: 'Trial Balance' }
];

function money(value: number | string): string {
  const amount = Number(value);
  return `${store.state.settings.currency} ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function StatementsView({ authVersion, theme }: { authVersion: number; theme: 'light' | 'dark' }) {
  const [tab, setTab] = useState<ReportTab>('income');
  const [asAt, setAsAt] = useState(store.todayISO());
  const [fromDate, setFromDate] = useState(store.addDays(store.todayISO(), -29));
  const [toDate, setToDate] = useState(store.todayISO());
  const [trialRows, setTrialRows] = useState<TrialBalanceRow[]>([]);
  const [activityRows, setActivityRows] = useState<AccountActivity[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api.token) {
      setTrialRows([]);
      setActivityRows([]);
      setError('Sign in with an administrator or accountant account to load ledger reports.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    const request = tab === 'income'
      ? api.getAnalyticsOverview(fromDate, toDate).then(report => {
        if (!cancelled) setActivityRows((report as AnalyticsReport).journal_activity);
      })
      : api.getTrialBalance(asAt).then(rows => {
        if (!cancelled) setTrialRows(rows as TrialBalanceRow[]);
      });

    request.catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load the ledger report.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tab, asAt, fromDate, toDate, authVersion]);

  const trialTotals = useMemo(() => trialRows.reduce((totals, row) => ({
    debit: totals.debit + Number(row.debit),
    credit: totals.credit + Number(row.credit)
  }), { debit: 0, credit: 0 }), [trialRows]);

  async function exportTrialBalance() {
    try {
      const blob = await api.downloadTrialBalanceCsv(asAt);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trial-balance-${asAt}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Trial balance export failed.');
    }
  }

  useEffect(() => {
    if (tab === 'income' || !trialRows.length) return;
    const element = document.getElementById('trial-balance-chart');
    if (!element) return;
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    let cancelled = false;
    let chart: ECharts | null = null;
    import('./echarts').then(({ echarts }) => {
      if (cancelled) return;
      chart = echarts.init(element);
      chart.setOption({
      color: [token('--brand-primary'), token('--brand-brass')],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: token('--text-muted') } },
      grid: { left: 48, right: 16, top: 34, bottom: 56 },
      xAxis: {
        type: 'category',
        data: trialRows.map(row => row.account_code),
        axisLabel: { rotate: 35, color: token('--text-muted') }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: token('--border-line') } } },
      series: [
        { name: 'Debit', type: 'bar', data: trialRows.map(row => Number(row.debit)) },
        { name: 'Credit', type: 'bar', data: trialRows.map(row => Number(row.credit)) }
      ]
      });
    }).catch(reason => {
      if (cancelled) return;
      console.error('[Reports] Could not load trial balance chart:', reason);
      element.textContent = 'The chart could not be loaded.';
    });
    const resize = () => chart?.resize();
    window.addEventListener('resize', resize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      chart?.dispose();
    };
  }, [tab, trialRows, theme]);

  return (
    <div className="statements-view dashboard-view">
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2>Financial Reports</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{store.state.settings.hotel} · General ledger</div>
          </div>
          <label className="report-date-field">
            <span>{tab === 'income' ? 'From' : 'As at'}</span>
            <input
              aria-label={tab === 'income' ? 'Report start date' : 'Report date'}
              type="date"
              value={tab === 'income' ? fromDate : asAt}
              onChange={event => tab === 'income' ? setFromDate(event.target.value) : setAsAt(event.target.value)}
            />
          </label>
          {tab === 'income' && (
            <label className="report-date-field">
              <span>To</span>
              <input aria-label="Report end date" type="date" value={toDate} onChange={event => setToDate(event.target.value)} />
            </label>
          )}
          {tab !== 'income' && api.token && (
            <button className="btn btn-sm btn-primary" onClick={exportTrialBalance} type="button">
              Export Trial Balance CSV
            </button>
          )}
        </div>

        <div className="report-tabs" role="tablist" aria-label="Financial reports">
          {tabs.map(item => (
            <button
              aria-selected={tab === item.id}
              className={`btn${tab === item.id ? ' btn-primary' : ''}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <div className="report-error" role="alert">{error}</div>}
        {loading && <p className="report-status" role="status">Loading ledger data…</p>}

        {tab === 'income' && (
          <section role="tabpanel" aria-label="Income statement">
            <div className="report-explainer">
              <strong>Account activity for the selected period</strong>
              <p>The ledger currently stores account codes but has no chart-of-accounts categories. Account movements are shown without guessing which codes represent revenue or expenses; a classified P&amp;L will require account mapping.</p>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Account Code</th><th className="tabular">Debits</th><th className="tabular">Credits</th><th className="tabular">Net Movement</th></tr></thead>
                <tbody>
                  {activityRows.map(row => (
                    <tr key={row.account_code}>
                      <td><strong>{row.account_code}</strong></td>
                      <td className="tabular">{money(row.debit)}</td>
                      <td className="tabular">{money(row.credit)}</td>
                      <td className="tabular">{money(row.credit - row.debit)}</td>
                    </tr>
                  ))}
                  {!loading && !error && activityRows.length === 0 && <tr><td colSpan={4}>No posted journal activity for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab !== 'income' && (
          <section role="tabpanel" aria-label={tab === 'balance' ? 'Balance sheet' : 'Trial balance'}>
            {tab === 'balance' && (
              <div className="report-explainer">
                <strong>Unclassified account balances as at {asAt}</strong>
                <p>A formal balance sheet is not generated from account-code prefixes. The current ledger has no asset, liability, or equity mapping, so the account balances below are shown as recorded rather than mislabeled.</p>
              </div>
            )}
            {trialRows.length > 0 && <div id="trial-balance-chart" className="chart-echarts report-chart" role="img" aria-label="Debits and credits by account code" />}
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Account Code</th><th className="tabular">Debits</th><th className="tabular">Credits</th><th className="tabular">Debit less credit</th></tr></thead>
                <tbody>
                  {trialRows.map(row => (
                    <tr key={row.account_code}>
                      <td><strong>{row.account_code}</strong></td>
                      <td className="tabular">{money(row.debit)}</td>
                      <td className="tabular">{money(row.credit)}</td>
                      <td className="tabular">{money(row.balance)}</td>
                    </tr>
                  ))}
                  {!loading && !error && trialRows.length === 0 && <tr><td colSpan={4}>No posted journal entries as at this date.</td></tr>}
                </tbody>
                {trialRows.length > 0 && (
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th className="tabular">{money(trialTotals.debit)}</th>
                      <th className="tabular">{money(trialTotals.credit)}</th>
                      <th className="tabular">{money(trialTotals.debit - trialTotals.credit)}</th>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
