// ===========================
// MonBudget — Budgets Page
// ===========================

import { getBudgets, setBudget, deleteBudget, getExpenses } from '../api/supabase.js'
import {
  formatCurrency,
  formatMonthYear,
  getCurrentMonthYear,
  getCategoryById,
  CATEGORIES
} from '../utils/helpers.js'
import { toast } from '../components/toast.js'

let currentMonth, currentYear

export async function renderBudgets(container, user) {
  const { month, year } = getCurrentMonthYear()
  currentMonth = month
  currentYear = year

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="budgets-toolbar">
        <h2>🎯 Mes budgets</h2>
        <div class="period-selector">
          <button id="budget-prev-month">◀</button>
          <div class="period-label" id="budget-period-label">${formatMonthYear(month, year)}</div>
          <button id="budget-next-month">▶</button>
        </div>
      </div>

      <div id="budget-summary-container"></div>
      <div id="budgets-content">
        <div class="budgets-grid">
          ${[1, 2, 3, 4, 5, 6].map(() => `<div class="skeleton" style="height: 160px; border-radius: 14px;"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  document.getElementById('budget-prev-month').addEventListener('click', () => {
    currentMonth--
    if (currentMonth < 1) { currentMonth = 12; currentYear-- }
    document.getElementById('budget-period-label').textContent = formatMonthYear(currentMonth, currentYear)
    loadBudgets(user)
  })

  document.getElementById('budget-next-month').addEventListener('click', () => {
    currentMonth++
    if (currentMonth > 12) { currentMonth = 1; currentYear++ }
    document.getElementById('budget-period-label').textContent = formatMonthYear(currentMonth, currentYear)
    loadBudgets(user)
  })

  await loadBudgets(user)
}

async function loadBudgets(user) {
  try {
    const [budgets, expenses] = await Promise.all([
      getBudgets(user.id, currentMonth, currentYear),
      getExpenses(user.id, { month: currentMonth, year: currentYear })
    ])

    const budgetMap = {}
    for (const b of budgets) budgetMap[b.category] = b

    const spentMap = {}
    for (const e of expenses) {
      if (!spentMap[e.category]) spentMap[e.category] = 0
      spentMap[e.category] += Number(e.amount)
    }

    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const totalRemaining = totalBudget - totalSpent

    // Summary
    const summaryEl = document.getElementById('budget-summary-container')
    if (summaryEl && totalBudget > 0) {
      const pct = Math.min(100, (totalSpent / totalBudget) * 100)
      const fillClass = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : ''
      summaryEl.innerHTML = `
        <div class="budget-summary" style="margin-bottom: 24px;">
          <div class="budget-summary-item">
            <div class="budget-summary-label">Budget total</div>
            <div class="budget-summary-value">${formatCurrency(totalBudget)}</div>
          </div>
          <div class="budget-summary-divider"></div>
          <div class="budget-summary-item">
            <div class="budget-summary-label">Dépensé</div>
            <div class="budget-summary-value" style="color: var(--accent-danger)">${formatCurrency(totalSpent)}</div>
          </div>
          <div class="budget-summary-divider"></div>
          <div class="budget-summary-item">
            <div class="budget-summary-label">Restant</div>
            <div class="budget-summary-value" style="color: ${totalRemaining >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'}">
              ${formatCurrency(totalRemaining)}
            </div>
          </div>
          <div style="flex: 1; padding-left: 16px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">${pct.toFixed(1)}% utilisé</div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill ${fillClass}" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
      `
    } else if (summaryEl) {
      summaryEl.innerHTML = ''
    }

    // Cards
    const contentEl = document.getElementById('budgets-content')
    contentEl.innerHTML = `
      <div class="budgets-grid">
        ${CATEGORIES.map((cat) => {
          const budget = budgetMap[cat.id]
          const spent = spentMap[cat.id] || 0
          const budgetAmount = budget ? Number(budget.amount) : 0
          const pct = budgetAmount > 0 ? Math.min(100, (spent / budgetAmount) * 100) : 0
          const fillClass = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : ''

          return `
          <div class="budget-card">
            <div class="budget-card-header">
              <div class="budget-cat-icon" style="background: ${cat.bg}; color: ${cat.color}">
                ${cat.emoji}
              </div>
              <div class="budget-card-info">
                <div class="budget-card-name">${cat.label}</div>
                <div class="budget-card-amounts">
                  <span>${formatCurrency(spent)}</span>
                  ${budgetAmount > 0 ? ` / ${formatCurrency(budgetAmount)}` : ' · <span class="no-budget-badge">Pas de budget</span>'}
                </div>
              </div>
              <button class="btn btn-ghost btn-sm budget-card-edit" data-cat="${cat.id}"
                title="${budget ? 'Modifier le budget' : 'Définir un budget'}">
                ${budget ? '✏️' : '➕'}
              </button>
            </div>
            ${budgetAmount > 0 ? `
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill ${fillClass}" style="width: ${pct}%"></div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
                <span>${pct.toFixed(1)}% utilisé</span>
                <span>Reste: ${formatCurrency(budgetAmount - spent)}</span>
              </div>
            ` : ''}
          </div>
        `
        }).join('')}
      </div>
    `

    // Edit buttons
    contentEl.querySelectorAll('.budget-card-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.cat
        const cat = getCategoryById(catId)
        const existing = budgetMap[catId]
        showBudgetEditor(cat, existing, user)
      })
    })
  } catch (err) {
    console.error('Budget load error:', err)
    document.getElementById('budgets-content').innerHTML = `
      <div class="empty-state"><div class="empty-state-title">Erreur de chargement</div></div>
    `
  }
}

function showBudgetEditor(cat, existing, user) {
  const oldOverlay = document.getElementById('budget-editor-overlay')
  if (oldOverlay) oldOverlay.remove()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'budget-editor-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width: 380px;">
      <div class="modal-header">
        <div class="modal-title">${cat.emoji} Budget ${cat.label}</div>
        <button class="modal-close" id="budget-modal-close">✕</button>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
        Définissez votre budget mensuel pour ${cat.label.toLowerCase()} — ${formatMonthYear(currentMonth, currentYear)}.
      </p>
      <div class="form-group">
        <label class="form-label">Montant du budget (€)</label>
        <input class="form-input" type="number" id="budget-amount" placeholder="0.00"
          step="0.01" min="0" value="${existing ? existing.amount : ''}" />
        <div class="form-hint">Laissez vide ou 0 pour supprimer le budget.</div>
      </div>
      <div id="budget-editor-error" class="auth-error"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="budget-cancel">Annuler</button>
        <button class="btn btn-primary" id="budget-save">Enregistrer</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))
  document.getElementById('budget-amount').focus()

  function close() {
    overlay.classList.remove('show')
    setTimeout(() => overlay.remove(), 300)
  }

  document.getElementById('budget-modal-close').addEventListener('click', close)
  document.getElementById('budget-cancel').addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  document.getElementById('budget-save').addEventListener('click', async () => {
    const amountVal = document.getElementById('budget-amount').value
    const amount = parseFloat(amountVal)
    const saveBtn = document.getElementById('budget-save')
    const errorEl = document.getElementById('budget-editor-error')

    saveBtn.disabled = true
    saveBtn.textContent = 'Enregistrement...'
    errorEl.classList.remove('show')

    try {
      if (!amountVal || amount <= 0) {
        // Delete budget if exists
        if (existing) {
          await deleteBudget(existing.id)
          toast.info(`Budget ${cat.label} supprimé`)
        }
      } else {
        await setBudget(user.id, cat.id, amount, currentMonth, currentYear)
        toast.success(`Budget ${cat.label} enregistré !`)
      }
      close()
      await loadBudgets(user)
    } catch (err) {
      errorEl.textContent = err.message || 'Erreur lors de la sauvegarde'
      errorEl.classList.add('show')
      saveBtn.disabled = false
      saveBtn.textContent = 'Enregistrer'
    }
  })
}
