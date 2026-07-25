// ===========================
// MonBudget — Home / Dashboard Page
// ===========================

import { getMonthStats } from '../api/supabase.js'
import {
  formatCurrency,
  formatShortDate,
  formatMonthYear,
  getCurrentMonthYear,
  getCategoryById,
  CATEGORIES
} from '../utils/helpers.js'
import { showExpenseModal } from '../components/expense-modal.js'

let chartInstance = null

export async function renderHome(container, user) {
  const { month, year } = getCurrentMonthYear()

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="dashboard-header">
        <div class="dashboard-greeting">
          Bonjour, <span>${user?.user_metadata?.username || user?.email?.split('@')[0] || 'vous'}</span>
        </div>
        <div class="dashboard-date">${formatMonthYear(month, year)}</div>
      </div>

      <div id="stats-grid-container">
        <div class="stats-grid">
          ${[1, 2, 3, 4].map(() => `<div class="stat-card skeleton" style="height: 110px;"></div>`).join('')}
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="chart-container" id="donut-container">
          <div class="chart-title">Répartition par catégorie</div>
          <div style="position: relative; height: 220px; display: flex; align-items: center; justify-content: center;">
            <canvas id="donut-chart"></canvas>
          </div>
          <div id="donut-legend" class="category-legend"></div>
        </div>

        <div class="chart-container">
          <div class="chart-title" style="display: flex; align-items: center; justify-content: space-between;">
            <span>Dernières dépenses</span>
            <button class="btn btn-primary btn-sm" id="quick-add-btn">+ Ajouter</button>
          </div>
          <div id="recent-expenses" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            ${[1, 2, 3, 4, 5].map(() => `<div class="skeleton" style="height: 60px; border-radius: 10px;"></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `

  // Quick add button
  document.getElementById('quick-add-btn').addEventListener('click', () => {
    showExpenseModal({
      user,
      onSaved: () => renderHome(container, user)
    })
  })

  try {
    const stats = await getMonthStats(user.id, month, year)
    renderStats(stats, month, year)
    renderRecentExpenses(stats.expenses.slice(0, 6), user, container)
    renderDonutChart(stats.byCategory, stats.total)
  } catch (err) {
    console.error('Dashboard error:', err)
  }
}

function renderStats(stats, month, year) {
  const remaining = stats.remaining
  const remainingColor = remaining === null ? 'var(--accent-primary)' : remaining >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'

  document.getElementById('stats-grid-container').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--card-accent: var(--accent-primary)">
        <div class="stat-card-label">Dépensé ce mois</div>
        <div class="stat-card-value">${formatCurrency(stats.total)}</div>
        <div class="stat-card-sub">${stats.count} transaction${stats.count > 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card" style="--card-accent: var(--accent-secondary)">
        <div class="stat-card-label">Budget restant</div>
        <div class="stat-card-value" style="color: ${remainingColor}">
          ${remaining !== null ? formatCurrency(remaining) : '—'}
        </div>
        <div class="stat-card-sub">${stats.totalBudget > 0 ? `Budget: ${formatCurrency(stats.totalBudget)}` : 'Aucun budget défini'}</div>
      </div>
      <div class="stat-card" style="--card-accent: var(--accent-warning)">
        <div class="stat-card-label">Dépense max</div>
        <div class="stat-card-value">${stats.maxExpense > 0 ? formatCurrency(stats.maxExpense) : '—'}</div>
        <div class="stat-card-sub">Ce mois-ci</div>
      </div>
      <div class="stat-card" style="--card-accent: var(--accent-blue)">
        <div class="stat-card-label">Catégories</div>
        <div class="stat-card-value">${Object.keys(stats.byCategory).length}</div>
        <div class="stat-card-sub">Utilisées ce mois</div>
      </div>
    </div>
  `
}

function renderRecentExpenses(expenses, user, container) {
  const el = document.getElementById('recent-expenses')
  if (!el) return

  if (expenses.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">💳</div>
        <div class="empty-state-title">Aucune dépense</div>
        <div class="empty-state-text">Ajoutez votre première dépense !</div>
      </div>
    `
    return
  }

  el.innerHTML = expenses
    .map((e) => {
      const cat = getCategoryById(e.category)
      return `
      <div class="expense-item" style="cursor: default;">
        <div class="expense-icon" style="background: ${cat.bg}; color: ${cat.color}">
          ${cat.emoji}
        </div>
        <div class="expense-info">
          <div class="expense-desc">${e.description}</div>
          <div class="expense-meta">
            <span>${cat.label}</span>
            <span>•</span>
            <span>${formatShortDate(e.date)}</span>
          </div>
        </div>
        <div class="expense-amount negative">-${formatCurrency(e.amount)}</div>
      </div>
    `
    })
    .join('')
}

function renderDonutChart(byCategory, total) {
  const canvas = document.getElementById('donut-chart')
  const legendEl = document.getElementById('donut-legend')
  if (!canvas) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  if (total === 0) {
    canvas.parentElement.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Aucune donnée ce mois-ci</div>
      </div>
    `
    if (legendEl) legendEl.innerHTML = ''
    return
  }

  import('chart.js').then(({ Chart, ArcElement, Tooltip, Legend, DoughnutController }) => {
    Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
    const labels = entries.map(([id]) => {
      const cat = getCategoryById(id)
      return `${cat.emoji} ${cat.label}`
    })
    const data = entries.map(([, amount]) => amount)
    const colors = entries.map(([id]) => getCategoryById(id).color)

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderColor: 'var(--bg-secondary)',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
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

    // Legend
    if (legendEl) {
      legendEl.innerHTML = entries
        .map(([id, amount]) => {
          const cat = getCategoryById(id)
          const pct = ((amount / total) * 100).toFixed(1)
          return `
          <div class="legend-item">
            <div class="legend-dot" style="background: ${cat.color}"></div>
            <div class="legend-label">${cat.emoji} ${cat.label}</div>
            <div class="legend-value">${formatCurrency(amount)}</div>
            <div class="legend-pct">${pct}%</div>
          </div>
        `
        })
        .join('')
    }
  })
}
