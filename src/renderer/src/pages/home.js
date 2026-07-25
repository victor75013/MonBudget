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
  detectEmoji,
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
          ${[1, 2, 3, 4, 5].map(() => `<div class="stat-card skeleton" style="height: 110px;"></div>`).join('')}
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="chart-container" id="donut-container">
          <div class="chart-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>Répartition par catégorie</span>
            <div style="display: flex; gap: 4px; background: var(--bg-tertiary); padding: 3px; border-radius: 8px; font-size: 0.75rem;">
              <button id="chart-toggle-expense" class="btn btn-primary btn-sm" style="padding: 3px 10px; font-size: 0.75rem;">Dépenses</button>
              <button id="chart-toggle-income" class="btn btn-secondary btn-sm" style="padding: 3px 10px; font-size: 0.75rem;">Revenus</button>
            </div>
          </div>
          <div style="position: relative; height: 210px; display: flex; align-items: center; justify-content: center; margin-top: 10px;">
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

    let activeChartType = 'expense'
    renderDonutChart(stats.expenseByCategory, stats.totalExpense, 'expense')

    const btnExp = document.getElementById('chart-toggle-expense')
    const btnInc = document.getElementById('chart-toggle-income')

    if (btnExp && btnInc) {
      btnExp.addEventListener('click', () => {
        activeChartType = 'expense'
        btnExp.className = 'btn btn-primary btn-sm'
        btnInc.className = 'btn btn-secondary btn-sm'
        renderDonutChart(stats.expenseByCategory, stats.totalExpense, 'expense')
      })
      btnInc.addEventListener('click', () => {
        activeChartType = 'income'
        btnExp.className = 'btn btn-secondary btn-sm'
        btnInc.className = 'btn btn-teal btn-sm'
        renderDonutChart(stats.incomeByCategory, stats.totalIncome, 'income')
      })
    }
  } catch (err) {
    console.error('Dashboard error:', err)
  }
}

function renderStats(stats) {
  const balanceColor = stats.netBalance >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'
  const balanceSign = stats.netBalance > 0 ? '+' : ''

  document.getElementById('stats-grid-container').innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
      <!-- Ligne 1 : Synthèse du mois -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
        <div class="stat-card" style="--card-accent: var(--accent-secondary)">
          <div class="stat-card-label">Revenus ce mois</div>
          <div class="stat-card-value" style="color: var(--accent-secondary)">+${formatCurrency(stats.totalIncome)}</div>
          <div class="stat-card-sub">${stats.incomes.length} transaction${stats.incomes.length > 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card" style="--card-accent: var(--accent-danger)">
          <div class="stat-card-label">Dépenses ce mois</div>
          <div class="stat-card-value" style="color: var(--accent-danger)">-${formatCurrency(stats.totalExpense)}</div>
          <div class="stat-card-sub">${stats.expenses.length} transaction${stats.expenses.length > 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card" style="--card-accent: ${balanceColor}">
          <div class="stat-card-label">Solde net</div>
          <div class="stat-card-value" style="color: ${balanceColor}">
            ${balanceSign}${formatCurrency(stats.netBalance)}
          </div>
          <div class="stat-card-sub">${stats.netBalance >= 0 ? 'Capacité d\'épargne' : 'Déficit ce mois'}</div>
        </div>
      </div>

      <!-- Ligne 2 : Opérations récurrentes -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
        <div class="stat-card" style="--card-accent: var(--accent-secondary)">
          <div class="stat-card-label">Revenus fixes</div>
          <div class="stat-card-value" style="color: var(--accent-secondary)">+${formatCurrency(stats.fixedIncome)}</div>
          <div class="stat-card-sub">Entrées récurrentes</div>
        </div>
        <div class="stat-card" style="--card-accent: var(--accent-primary)">
          <div class="stat-card-label">Charges fixes</div>
          <div class="stat-card-value">${formatCurrency(stats.fixedExpenses)}</div>
          <div class="stat-card-sub">Prélèvements récurrents</div>
        </div>
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
      const amountSign = isIncome ? '+' : '-'
      const amountColor = isIncome ? 'var(--accent-secondary)' : 'var(--accent-danger)'
      const itemEmoji = e.icon || detectEmoji(e.description, e.category)

      return `
      <div class="expense-item" style="cursor: default;">
        <div class="expense-icon" style="background: ${cat.bg}; color: ${cat.color}">
          ${itemEmoji}
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

function renderDonutChart(byCategory, total, type = 'expense') {
  const canvas = document.getElementById('donut-chart')
  const legendEl = document.getElementById('donut-legend')
  if (!canvas) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const entries = Object.entries(byCategory).filter(([_, amount]) => amount > 0).sort((a, b) => b[1] - a[1])

  if (total === 0 || entries.length === 0) {
    if (canvas.parentElement) {
      canvas.style.display = 'none'
    }
    if (legendEl) {
      legendEl.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state-text" style="color: var(--text-muted);">Aucune donnée pour ce mois-ci</div>
        </div>
      `
    }
    return
  }

  canvas.style.display = 'block'

  import('chart.js').then(({ Chart, ArcElement, Tooltip, Legend, DoughnutController }) => {
    Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

    const labels = entries.map(([id]) => {
      const cat = getCategoryById(id, type)
      return cat.label
    })
    const data = entries.map(([, amount]) => amount)
    const colors = entries.map(([id]) => getCategoryById(id, type).color)

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
              label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    })

    // Legend
    if (legendEl) {
      legendEl.innerHTML = entries
        .map(([id, amount]) => {
          const cat = getCategoryById(id, type)
          const pct = ((amount / total) * 100).toFixed(1)
          return `
          <div class="legend-item" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; margin-top: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="legend-dot" style="width: 10px; height: 10px; border-radius: 50%; background: ${cat.color}"></div>
              <div class="legend-label" style="font-weight: 500;">${cat.label}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <div class="legend-value" style="font-weight: 700;">${formatCurrency(amount)}</div>
              <div class="legend-pct" style="color: var(--text-muted); min-width: 45px; text-align: right;">${pct}%</div>
            </div>
          </div>
        `
        })
        .join('')
    }
  })
}
