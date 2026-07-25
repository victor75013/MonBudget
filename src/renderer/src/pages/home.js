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
      <div class="dashboard-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div>
          <div class="dashboard-greeting">
            Bonjour, <span>${user?.user_metadata?.username || user?.email?.split('@')[0] || 'vous'}</span>
          </div>
          <div class="dashboard-date">${formatMonthYear(month, year)}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-teal btn-sm" id="quick-add-income">+ Revenu</button>
          <button class="btn btn-primary btn-sm" id="quick-add-expense">+ Dépense</button>
        </div>
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
            <span>Dernières transactions</span>
          </div>
          <div id="recent-expenses" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            ${[1, 2, 3, 4, 5].map(() => `<div class="skeleton" style="height: 60px; border-radius: 10px;"></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('quick-add-expense').addEventListener('click', () => {
    showExpenseModal({
      user,
      defaultType: 'expense',
      onSaved: () => renderHome(container, user)
    })
  })

  document.getElementById('quick-add-income').addEventListener('click', () => {
    showExpenseModal({
      user,
      defaultType: 'income',
      onSaved: () => renderHome(container, user)
    })
  })

  try {
    const stats = await getMonthStats(user.id, month, year)
    renderStats(stats)
    renderRecentExpenses(stats.allItems.slice(0, 6), user, container)
    renderDonutChart(stats.expenseByCategory, stats.totalExpense)
  } catch (err) {
    console.error('Dashboard error:', err)
  }
}

function renderStats(stats) {
  const balanceColor = stats.netBalance >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'
  const balanceSign = stats.netBalance > 0 ? '+' : ''

  document.getElementById('stats-grid-container').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--card-accent: var(--accent-secondary)">
        <div class="stat-card-label">Revenus ce mois</div>
        <div class="stat-card-value" style="color: var(--accent-secondary)">+${formatCurrency(stats.totalIncome)}</div>
        <div class="stat-card-sub">dont ${formatCurrency(stats.fixedIncome)} fixes</div>
      </div>
      <div class="stat-card" style="--card-accent: var(--accent-danger)">
        <div class="stat-card-label">Dépenses ce mois</div>
        <div class="stat-card-value" style="color: var(--accent-danger)">-${formatCurrency(stats.totalExpense)}</div>
        <div class="stat-card-sub">dont ${formatCurrency(stats.fixedExpenses)} fixes</div>
      </div>
      <div class="stat-card" style="--card-accent: ${balanceColor}">
        <div class="stat-card-label">Solde net</div>
        <div class="stat-card-value" style="color: ${balanceColor}">
          ${balanceSign}${formatCurrency(stats.netBalance)}
        </div>
        <div class="stat-card-sub">${stats.netBalance >= 0 ? 'Capacité d\'épargne' : 'Déficit ce mois'}</div>
      </div>
      <div class="stat-card" style="--card-accent: var(--accent-primary)">
        <div class="stat-card-label">Charges fixes</div>
        <div class="stat-card-value">${formatCurrency(stats.fixedExpenses)}</div>
        <div class="stat-card-sub">Prélèvements récurrents</div>
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
        <div class="empty-state-title">Aucune transaction</div>
        <div class="empty-state-text">Ajoutez votre première dépense ou revenu !</div>
      </div>
    `
    return
  }

  el.innerHTML = expenses
    .map((e) => {
      const isIncome = e.type === 'income'
      const cat = getCategoryById(e.category, e.type)
      const amountClass = isIncome ? 'positive' : 'negative'
      const amountSign = isIncome ? '+' : '-'
      const amountColor = isIncome ? 'var(--accent-secondary)' : 'var(--accent-danger)'

      return `
      <div class="expense-item" style="cursor: default;">
        <div class="expense-icon" style="background: ${cat.bg}; color: ${cat.color}">
          ${isIncome ? '⬆️' : '⬇️'}
        </div>
        <div class="expense-info">
          <div class="expense-desc" style="display: flex; align-items: center; gap: 6px;">
            <span>${e.description}</span>
            ${e.is_recurring ? `<span style="font-size: 0.7rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 1px 6px; border-radius: 4px; color: var(--accent-primary);">Fixe</span>` : ''}
          </div>
          <div class="expense-meta">
            <span>${cat.label}</span>
            <span>•</span>
            <span>${formatShortDate(e.date)}</span>
          </div>
        </div>
        <div class="expense-amount" style="color: ${amountColor}">${amountSign}${formatCurrency(e.amount)}</div>
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
