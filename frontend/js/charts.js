/**
 * ECharts option placeholders consumed by the React chart lifecycle.
 * Keeping option construction separate lets the existing dashboard data
 * calculations migrate without changing their operational data contract.
 */

function chartPlaceholder(options, label, className = '') {
  const encodedOptions = JSON.stringify(options)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  return `<div class="chart-echarts ${className}" data-echarts-options="${encodedOptions}" role="img" aria-label="${label}"></div>`;
}

const axisStyle = {
  axisLine: { lineStyle: { color: 'var(--border-line)' } },
  axisLabel: { color: 'var(--text-muted)' },
  splitLine: { lineStyle: { color: 'var(--border-line)' } }
};

export function barChart(labels, series) {
  const stacked = series[0]?.name !== 'Debits';
  return chartPlaceholder({
    animationDuration: 350,
    color: series.map(item => item.color),
    grid: { left: 48, right: 16, top: 18, bottom: 30, containLabel: false },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: axisStyle.axisLine,
      axisLabel: { color: 'var(--text-muted)', hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: 'var(--text-muted)',
        formatter: value => value >= 1000 ? `${Math.round(value / 1000)}k` : value
      },
      splitLine: axisStyle.splitLine
    },
    series: series.map(item => ({
      name: item.name,
      type: 'bar',
      stack: stacked ? 'total' : undefined,
      barMaxWidth: 34,
      data: item.values,
      itemStyle: { borderRadius: [3, 3, 0, 0] },
      emphasis: { focus: 'series' }
    }))
  }, 'Revenue by day, stacked by department');
}

export function lineChart(labels, values, options = {}) {
  const markLine = options.todayIndex == null ? undefined : {
    symbol: 'none',
    label: { formatter: 'Today', color: 'var(--brand-brass)' },
    lineStyle: { color: 'var(--brand-brass)', type: 'dashed' },
    data: [{ xAxis: labels[options.todayIndex] }]
  };

  return chartPlaceholder({
    animationDuration: 350,
    color: options.color || 'var(--brand-primary)',
    grid: { left: 48, right: 16, top: 20, bottom: 30, containLabel: false },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisTick: { show: false },
      axisLine: axisStyle.axisLine,
      axisLabel: { color: 'var(--text-muted)', hideOverlap: true }
    },
    yAxis: {
      type: 'value',
      max: options.max,
      axisLabel: {
        color: 'var(--text-muted)',
        formatter: options.formatSuffix ? `{value}${options.formatSuffix}` : '{value}'
      },
      splitLine: axisStyle.splitLine
    },
    series: [{
      name: 'Occupancy',
      type: 'line',
      smooth: true,
      showSymbol: true,
      symbolSize: 6,
      data: values,
      areaStyle: { opacity: 0.12 },
      lineStyle: { width: 2.5 },
      markLine
    }]
  }, 'Occupancy forecast over time');
}

export function donutChart(items, centerText = '') {
  const colors = items.map(item => item.color);
  const legend = items.map(item => `
    <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;">
      <span style="width:10px;height:10px;border-radius:3px;background:${item.color};flex:none;"></span>
      <span style="flex:1;">${item.label}</span>
      <strong>${Math.round((item.value / (items.reduce((sum, current) => sum + current.value, 0) || 1)) * 100)}%</strong>
    </div>
  `).join('');

  return `
    <div class="chart-donut-layout">
      ${chartPlaceholder({
        animationDuration: 350,
        color: colors,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        graphic: centerText ? [{
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: centerText,
            fill: 'var(--text-main)',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'var(--font-display)'
          }
        }] : [],
        series: [{
          type: 'pie',
          radius: ['58%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          data: items.map(item => ({ name: item.label, value: item.value })),
          itemStyle: { borderColor: 'var(--bg-surface)', borderWidth: 2 }
        }]
      }, 'Revenue share by department')}
      <div class="chart-donut-legend">${legend}</div>
    </div>
  `;
}
