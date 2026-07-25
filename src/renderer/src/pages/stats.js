// ===========================
// MonBudget — Stats Page
// ===========================

import { getExpenses, getYearlyStats } from '../api/supabase.js'
import {
  formatCurrency,
  formatMonthYear,
  getCurrentMonthYear,
  getMonthName,
  getCategoryById,
  CATEGORIES
} from '../utils/helpers.js'

let barChartInstance = null
let donutChartInstance = null

export async function renderStats(container, user) {
  const { month, year } = getCurrentMonthYear()

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="section-header">
        <h2 class="section-title">Statistiques — ${year}</h2>
      </div>

      <!-- Yearly Overview -->
      <div class="chart-container" style="margin-bottom: 24px;">
        <div class="chart-title">Évolution mensuelle ${year}</div>
        <div style="position: relative; height: 240px;">
          <canvas id="bar-chart"></canvas>
        </div>
      </div>

      <div class="stats-page-grid">
        <!-- Category breakdown this month -->
        <div class="chart-container">
          <div class="chart-title">
            Catégories — ${getMonthName(month, year)}
          </div>
          <div style="position: relative; height: 200px; display: flex; align-items: center; justify-content: center;">
            <canvas id="stats-donut-chart"></canvas>
          </div>
          <div id="stats-donut-legend" class="category-legend" style="margin-top: 12px;"></div>
        </div>

        <!-- Top expenses this year -->
        <div class="chart-container">
          <div class="chart-title">Résumé annuel</div>
          <div id="yearly-summary-content">
            ${[1, 2, 3, 4].map(() => `<div class="skeleton" style="height: 36px; border-radius: 8px; margin-bottom: 8px;"></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `

  try {
    const [yearlyData, monthExpenses] = await Promise.all([
      getYearlyStats(user.id, year),
      getExpenses(user.id, { month, year })
    ])

    renderBarChart(yearlyData, year)
    renderMonthDonut(monthExpenses, month, year)
    renderYearlySummary(yearlyData)
  } catch (err) {
    console.error('Stats error:', err)
  }
}

function renderBarChart(yearlyData, year) {
  const canvas = document.getElementById('bar-chart')
  if (!canvas) return

  if (barChartInstance) {
    barChartInstance.destroy()
    barChartInstance = null
  }

  import('chart.js').then(({ Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController }) => {
    Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController)

    const labels = yearlyData.map((d) => getMonthName(d.month, year).substring(0, 3))
    const data = yearlyData.map((d) => d.total)
    const now = new Date()
    const currentMonth = now.getMonth() + 1

    barChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Dépenses',
            data,
            backgroundColor: yearlyData.map((d) =>
              d.month === currentMonth ? 'rgba(108, 99, 255, 0.9)' : 'rgba(108, 99, 255, 0.3)'
            ),
            borderColor: 'rgba(108, 99, 255, 0.8)',
            borderWidth: 1,
            borderRadius: 6,
            hoverBackgroundColor: 'rgba(108, 99, 255, 0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8892a4', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#8892a4',
              font: { size: 11 },
              callback: (v) => formatCurrency(v)
            }
          }
        }
      }
    })
  })
}

function renderMonthDonut(expenses, month, year) {
  const canvas = document.getElementById('stats-donut-chart')
  const legendEl = document.getElementById('stats-donut-legend')
  if (!canvas) return

  if (donutChartInstance) {
    donutChartInstance.destroy()
    donutChartInstance = null
  }

  const byCategory = {}
  for (const e of expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = 0
    byCategory[e.category] += Number(e.amount)
  }

  const total = Object.values(byCategory).reduce((a, b) => a + b, 0)

  if (total === 0) {
    canvas.parentElement.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Aucune dépense ce mois</div>
      </div>
    `
    if (legendEl) legendEl.innerHTML = ''
    return
  }

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  import('chart.js').then(({ Chart, ArcElement, Tooltip, Legend, DoughnutController }) => {
    Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

    donutChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(([id]) => getCategoryById(id).label),
        datasets: [
          {
            data: entries.map(([, v]) => v),
            backgroundColor: entries.map(([id]) => getCategoryById(id).color),
            borderColor: 'var(--bg-secondary)',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    })

    if (legendEl) {
      legendEl.innerHTML = entries
        .map(([id, amount]) => {
          const cat = getCategoryById(id)
          return `
          <div class="legend-item">
            <div class="legend-dot" style="background: ${cat.color}"></div>
            <div class="legend-label">${cat.emoji} ${cat.label}</div>
            <div class="legend-value">${formatCurrency(amount)}</div>
            <div class="legend-pct">${((amount / total) * 100).toFixed(1)}%</div>
          </div>
        `
        })
        .join('')
    }
  })
}

function renderYearlySummary(yearlyData) {
  const el = document.getElementById('yearly-summary-content')
  if (!el) return

  const yearTotal = yearlyData.reduce((s, d) => s + d.total, 0)
  const yearCount = yearlyData.reduce((s, d) => s + d.count, 0)
  const activeMonths = yearlyData.filter((d) => d.total > 0).length
  const maxMonth = yearlyData.reduce((best, d) => (d.total > best.total ? d : best), yearlyData[0])
  const avg = activeMonths > 0 ? yearTotal / activeMonths : 0

  el.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 10px;">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total ${new Date().getFullYear()}</div>
        <div style="font-weight: 700; color: var(--text-primary);">${formatCurrency(yearTotal)}</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 10px;">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Transactions</div>
        <div style="font-weight: 700; color: var(--text-primary);">${yearCount}</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 10px;">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Moyenne mensuelle</div>
        <div style="font-weight: 700; color: var(--text-primary);">${formatCurrency(avg)}</div>
      </div>
      ${maxMonth && maxMonth.total > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 10px;">
          <div style="font-size: 0.85rem; color: var(--text-secondary);">Mois le plus élevé</div>
          <div style="font-weight: 700; color: var(--accent-danger);">${getMonthName(maxMonth.month, maxMonth.year)} (${formatCurrency(maxMonth.total)})</div>
        </div>
      ` : ''}
    </div>
  `
}
