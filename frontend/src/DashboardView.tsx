import { useEffect, useMemo, useRef } from 'react';
import type { ECharts } from 'echarts';
import type { EChartsOption } from 'echarts';
import { store } from '../js/store.js';
import type { AnalyticsOverview } from './types';

interface DashboardViewProps {
  analytics: AnalyticsOverview | null;
  revision: number;
  theme: 'light' | 'dark';
}

interface DemoRoom {
  id: string;
  no: string;
  ooo?: boolean;
}

interface DemoReservation {
  id: string;
  code: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

interface DemoTransaction {
  date: string;
  type: string;
  dept: string;
  net: number;
}

interface DemoStoreState {
  rooms: DemoRoom[];
  reservations: DemoReservation[];
  transactions: DemoTransaction[];
}

function cssToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

export function DashboardView({ analytics, revision, theme }: DashboardViewProps) {
  const revenueRef = useRef<HTMLDivElement>(null);
  const occupancyRef = useRef<HTMLDivElement>(null);
  const accountsRef = useRef<HTMLDivElement>(null);
  const demoState = store.state as DemoStoreState;
  const today = store.todayISO();
  const rooms = demoState.rooms;
  const sellable = rooms.filter(room => !room.ooo).length || 1;
  const inHouse = demoState.reservations.filter(reservation => reservation.status === 'checked_in');
  const arrivals = demoState.reservations.filter(reservation => reservation.status === 'confirmed' && reservation.checkIn <= today);
  const departures = inHouse.filter(reservation => reservation.checkOut <= today);
  const charges = demoState.transactions.filter(transaction => transaction.date === today && transaction.type === 'charge');
  const demoRevenue = charges.reduce((sum, charge) => sum + (charge.net || 0), 0);
  const demoRevenueSeries = Array.from({ length: 14 }, (_, index) => {
    const date = store.addDays(today, index - 13);
    const dailyCharges = demoState.transactions.filter(transaction => transaction.date === date && transaction.type === 'charge');
    return {
      label: store.fmtShort(date),
      rooms: dailyCharges.filter(transaction => transaction.dept === 'Rooms').reduce((sum, charge) => sum + (charge.net || 0), 0) || 24000 + (index % 5) * 4500,
      outlets: dailyCharges.filter(transaction => transaction.dept !== 'Rooms').reduce((sum, charge) => sum + (charge.net || 0), 0) || 6000 + (index % 3) * 2200
    };
  });
  const revenueSeries = analytics
    ? analytics.daily_journal_activity.filter(day => day.date <= today).slice(-14).map(day => ({
      label: store.fmtShort(day.date),
      debits: day.debit,
      credits: day.credit
    }))
    : demoRevenueSeries;
  const occupancySeries = analytics?.occupancy_trend.length
    ? analytics.occupancy_trend
    : Array.from({ length: 28 }, (_, index) => {
      const offset = index - 13;
      return { date: store.addDays(today, offset), occupancy_rate: offset === 0 ? Math.round(inHouse.length / sellable * 100) : Math.min(100, Math.max(35, 65 + (offset * 2) % 30)) };
    });
  const accountActivity = analytics?.journal_activity || [];
  const accountMix = analytics
    ? accountActivity.map((account, index) => ({
      name: account.account_code,
      value: account.debit + account.credit,
      itemStyle: { color: cssToken(`--color-series-${(index % 6) + 1}`) }
    })).filter(account => account.value > 0)
    : [
      { name: 'Rooms', value: 385000, itemStyle: { color: cssToken('--brand-primary') } },
      { name: 'F&B Outlet', value: 142000, itemStyle: { color: cssToken('--brand-brass') } },
      { name: 'Spa & Wellness', value: 68000, itemStyle: { color: cssToken('--color-series-4') } },
      { name: 'Transport', value: 34000, itemStyle: { color: cssToken('--color-series-6') } }
    ];
  const totalAccountMovement = accountActivity.reduce((sum, account) => sum + account.debit + account.credit, 0);
  const todayLedger = analytics?.daily_journal_activity.find(entry => entry.date === today);
  const occupancy = analytics?.occupancy_rate ?? Math.round(inHouse.length / sellable * 100);
  const roomsOccupied = analytics?.occupied_rooms ?? inHouse.length;
  const arrivalsDue = analytics?.arrivals_due ?? arrivals.length;
  const departuresDue = analytics?.departures_due ?? departures.length;
  const colors = useMemo(() => ({
    muted: cssToken('--text-muted'),
    border: cssToken('--border-line'),
    primary: cssToken('--brand-primary'),
    brass: cssToken('--brand-brass'),
    surface: cssToken('--bg-surface'),
    main: cssToken('--text-main')
  }), [theme, revision]);

  useEffect(() => {
    let cancelled = false;
    const charts: ECharts[] = [];
    const addChart = (element: HTMLDivElement | null, option: EChartsOption) => {
      if (!element) return;
      return import('./echarts').then(({ echarts }) => {
        if (cancelled) return;
        const chart = echarts.init(element);
        chart.setOption(option);
        charts.push(chart);
      });
    };
    const resize = () => charts.forEach(chart => chart.resize());

    const revenueOption: EChartsOption = {
      color: [colors.primary, colors.brass],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 48, right: 16, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: revenueSeries.map(day => day.label), axisTick: { show: false }, axisLabel: { color: colors.muted } },
      yAxis: { type: 'value', axisLabel: { color: colors.muted, formatter: (value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value) }, splitLine: { lineStyle: { color: colors.border } } },
      series: analytics
        ? [
          { name: 'Debits', type: 'bar', data: revenueSeries.map(day => 'debits' in day ? day.debits : 0), barMaxWidth: 30 },
          { name: 'Credits', type: 'bar', data: revenueSeries.map(day => 'credits' in day ? day.credits : 0), barMaxWidth: 30 }
        ]
        : [
          { name: 'Rooms', type: 'bar', stack: 'revenue', data: revenueSeries.map(day => 'rooms' in day ? day.rooms : 0), barMaxWidth: 30 },
          { name: 'Outlets', type: 'bar', stack: 'revenue', data: revenueSeries.map(day => 'outlets' in day ? day.outlets : 0), barMaxWidth: 30 }
        ]
    };
    const occupancyOption: EChartsOption = {
      color: [colors.primary],
      tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => `${Math.round(Number(value))}%` },
      grid: { left: 46, right: 16, top: 18, bottom: 30 },
      xAxis: { type: 'category', boundaryGap: false, data: occupancySeries.map(point => store.fmtShort(point.date)), axisTick: { show: false }, axisLabel: { color: colors.muted, hideOverlap: true } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: colors.muted, formatter: '{value}%' }, splitLine: { lineStyle: { color: colors.border } } },
      series: [{
        name: 'Occupancy',
        type: 'line',
        smooth: true,
        data: occupancySeries.map(point => point.occupancy_rate),
        areaStyle: { opacity: 0.12 },
        markLine: {
          symbol: 'none',
          label: { formatter: 'Today', color: colors.brass },
          lineStyle: { color: colors.brass, type: 'dashed' },
          data: [{ xAxis: store.fmtShort(today) }]
        }
      }]
    };
    const accountsOption: EChartsOption = {
      color: accountMix.map(account => account.itemStyle.color),
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: analytics ? store.formatMoney(totalAccountMovement) : 'KES 629k',
          fill: colors.main,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'Cormorant Garamond, Georgia, serif'
        }
      }],
      series: [{
        type: 'pie',
        radius: ['58%', '82%'],
        center: ['50%', '50%'],
        label: { show: false },
        data: accountMix,
        itemStyle: { borderColor: colors.surface, borderWidth: 2 }
      }]
    };
    Promise.all([
      addChart(revenueRef.current, revenueOption),
      addChart(occupancyRef.current, occupancyOption),
      addChart(accountsRef.current, accountsOption)
    ]).then(() => {
      if (!cancelled) window.addEventListener('resize', resize);
    }).catch(error => {
      if (cancelled) return;
      console.error('[Analytics] Could not load charts:', error);
      [revenueRef.current, occupancyRef.current, accountsRef.current].forEach(element => {
        if (element) element.textContent = 'Charts could not be loaded.';
      });
    });
    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      charts.forEach(chart => chart.dispose());
    };
  }, [analytics, colors, revision, theme]);

  const arrivalRows: { id: string; code: string; name: string; room: string; live: boolean }[] = analytics
    ? analytics.arrivals.map(arrival => ({
      id: arrival.id,
      code: arrival.code,
      name: arrival.guest_name,
      room: arrival.room_number,
      live: true
    }))
    : arrivals.map((reservation: DemoReservation) => {
      const guest = store.getGuest(reservation.guestId);
      const room = store.getRoom(reservation.roomId);
      return { id: reservation.id, code: reservation.code, name: guest?.name || 'Guest', room: room?.no || '-', live: false };
    });

  return (
    <div className="dashboard-view">
      <section className="dashboard-hero" aria-label="Savanna Crest Hotel System overview">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-eyebrow">Savanna Crest · Daily Briefing</div>
          <h2>Every detail,<br />beautifully in place.</h2>
          <p>Welcome back. Here is the rhythm of the hotel today, from guest arrivals to the rooms ready to welcome them.</p>
          <div className="dashboard-hero-actions">
            <button className="btn btn-primary" data-action="modal-newbooking" type="button">＋ Create a booking</button>
            <button className="btn btn-hero-secondary" data-view="frontdesk" type="button">Open front desk</button>
          </div>
        </div>
      </section>

      <div className="dashboard-section-label">Today at a glance</div>
      <div className="dashboard-overview">
        <div className="card dashboard-occupancy">
          <div className="dashboard-section-label">Current Occupancy</div>
          <div className="occupancy-value">{occupancy}%</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <strong>{roomsOccupied}</strong> of <strong>{analytics?.sellable_rooms ?? sellable}</strong> sellable rooms occupied
          </div>
          <div className="occupancy-progress" role="img" aria-label={`${occupancy}% of sellable rooms are occupied`}>
            <span style={{ width: `${Math.min(100, Math.max(0, occupancy))}%` }} />
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <Kpi label="Arrivals Due" value={String(arrivalsDue)} subtext={`${roomsOccupied} in house · ${departuresDue} due out`} />
          <Kpi label={analytics ? "Today's Journal Credits" : "Today's Revenue"} value={store.formatMoney(analytics ? (todayLedger?.credit || 0) : (demoRevenue || 40500))} subtext={analytics ? 'Posted credits across ledger accounts' : 'Excludes VAT · Demo data'} />
          <Kpi label="ADR (Average Rate)" value={store.formatMoney(analytics?.adr ?? 11250)} subtext={analytics ? 'Average rate of rooms occupied today' : 'Illustrative demo metric'} />
          <Kpi label="RevPAR" value={store.formatMoney(analytics?.revpar ?? 7875)} subtext={analytics ? 'Room revenue per active room today' : 'Illustrative demo metric'} />
          <Kpi label="Departures Today" value={String(departuresDue)} subtext="Pending check-out audits" />
          <Kpi label="Open Receivables" value={analytics ? '—' : store.formatMoney(37700)} subtext={analytics ? 'Not available from the current ledger API' : 'Pending folio settlements · Demo data'} />
        </div>
      </div>

      <div className="grid-2 dashboard-charts" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{analytics ? '14-Day Journal Activity' : '14-Day Revenue Breakdown · Demo data'}</h3>
            <div className="chart-legend"><span>{analytics ? 'Debits' : 'Rooms'}</span><span>{analytics ? 'Credits' : 'Outlets'}</span></div>
          </div>
          <div ref={revenueRef} className="chart-echarts" role="img" aria-label={analytics ? 'Ledger debits and credits by day' : 'Demo revenue by day and department'} />
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Occupancy Forecast (28 Days)</h3></div>
          <div ref={occupancyRef} className="chart-echarts" role="img" aria-label="Occupancy forecast over time" />
        </div>
      </div>

      <div className="grid-2 dashboard-actions" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">{analytics ? 'Ledger Movement by Account' : 'Revenue Share by Department · Demo data'}</h3></div>
          <div className="chart-donut-layout">
            <div ref={accountsRef} className="chart-echarts" role="img" aria-label={analytics ? 'Posted ledger movement by account code' : 'Demo revenue share by department'} />
            <div className="chart-donut-legend">
              {accountMix.map((item, index) => {
                const total = accountMix.reduce((sum, account) => sum + account.value, 0) || 1;
                return <div className="chart-legend-row" key={item.name}><i style={{ background: accountMix[index].itemStyle.color }} />{item.name}<strong>{Math.round(item.value / total * 100)}%</strong></div>;
              })}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Immediate Attention Queue</h3></div>
          <div className="dashboard-arrivals">
            {arrivalRows.map(arrival => (
              <div className="dashboard-arrival" key={arrival.id}>
                <span className="chip chip-brand">Arrival</span>
                <div className="dashboard-arrival-info"><strong>{arrival.name}</strong><span>Room {arrival.room} · Code {arrival.code}</span></div>
                {arrival.live
                  ? <button className="btn btn-sm" data-view="frontdesk" type="button">Open Front Desk</button>
                  : <button className="btn btn-sm btn-primary" data-action="checkin" data-id={arrival.id} type="button">Check In</button>}
              </div>
            ))}
            {!arrivalRows.length && <div className="dashboard-empty">No arrivals pending today</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return <div className="kpi-tile"><div className="label">{label}</div><div className="value">{value}</div><div className="subtext">{subtext}</div></div>;
}
