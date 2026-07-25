// ===========================
// MonBudget — Expenses Page
// ===========================

import { getExpenses, deleteExpense } from '../api/supabase.js'
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  getCurrentMonthYear,
  getCategoryById,
  CATEGORIES,
  groupBy
} from '../utils/helpers.js'
import { showExpenseModal } from '../components/expense-modal.js'
import { showConfirmModal } from '../components/confirm-modal.js'
import { toast } from '../components/toast.js'

let currentFilters = {}

export async function renderExpenses(container, user, initialType = 'expense') {
  const { month, year } = getCurrentMonthYear()
  const isIncomeMode = initialType === 'income'
  const filterType = isIncomeMode ? 'income' : 'expense'
  const activeCategories = isIncomeMode ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const pageTitle = isIncomeMode ? 'Mes revenus' : 'Mes dépenses'
  const addBtnText = isIncomeMode ? '+ Nouveau revenu' : '+ Nouvelle dépense'
  const addBtnClass = isIncomeMode ? 'btn-teal' : 'btn-primary'

  currentFilters = { month, year, type: filterType, category: '', search: '' }

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="expenses-toolbar">
        <h2>${pageTitle}</h2>
        <button class="btn ${addBtnClass}" id="add-transaction-btn">${addBtnText}</button>
      </div>

      <!-- Période et filtres -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <div class="period-selector">
          <button id="prev-month">◀</button>
          <div class="period-label" id="period-label">${formatMonthYear(month, year)}</div>
          <button id="next-month">▶</button>
        </div>

        <select class="form-select" id="filter-category" style="width: 190px;">
          <option value="">Toutes catégories</option>
          ${activeCategories.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>

        <input class="form-input" type="text" id="filter-search"
          placeholder="Rechercher..." style="max-width: 220px;" />

        <button class="btn btn-secondary btn-sm" id="reset-filters">↺ Réinitialiser</button>
      </div>

      <div id="expenses-list-container">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${[1, 2, 3, 4, 5].map(() => `<div class="skeleton" style="height: 68px; border-radius: 10px;"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  document.getElementById('add-transaction-btn').addEventListener('click', () => {
    showExpenseModal({ user, defaultType: filterType, onSaved: () => loadExpenses(user) })
  })

  document.getElementById('prev-month').addEventListener('click', () => {
    currentFilters.month--
    if (currentFilters.month < 1) {
      currentFilters.month = 12
      currentFilters.year--
    }
    updatePeriodLabel()
    loadExpenses(user)
  })

  document.getElementById('next-month').addEventListener('click', () => {
    currentFilters.month++
    if (currentFilters.month > 12) {
      currentFilters.month = 1
      currentFilters.year++
    }
    updatePeriodLabel()
    loadExpenses(user)
  })

  document.getElementById('filter-category').addEventListener('change', (e) => {
    currentFilters.category = e.target.value
    loadExpenses(user)
  })

  let searchTimeout
  document.getElementById('filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      currentFilters.search = e.target.value
      loadExpenses(user)
    }, 300)
  })

  document.getElementById('reset-filters').addEventListener('click', () => {
    const { month: m, year: y } = getCurrentMonthYear()
    currentFilters = { month: m, year: y, type: filterType, category: '', search: '' }
    document.getElementById('filter-category').value = ''
    document.getElementById('filter-search').value = ''
    updatePeriodLabel()
    loadExpenses(user)
  })

  await loadExpenses(user)
}

function updatePeriodLabel() {
  const el = document.getElementById('period-label')
  if (el) el.textContent = formatMonthYear(currentFilters.month, currentFilters.year)
}

async function loadExpenses(user) {
  const listEl = document.getElementById('expenses-list-container')
  if (!listEl) return

  try {
    const expenses = await getExpenses(user.id, currentFilters)
    renderExpenseList(expenses, user, listEl)
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">Erreur de chargement</div></div>`
    console.error(err)
  }
}

function renderExpenseList(expenses, user, container) {
  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Aucune transaction trouvée</div>
        <div class="empty-state-text">Aucune dépense ou revenu ne correspond à vos filtres pour cette période.</div>
      </div>
    `
    return
  }

  // Totaux
  const totalExp = expenses.filter((e) => e.type !== 'income').reduce((sum, e) => sum + Number(e.amount), 0)
  const totalInc = expenses.filter((e) => e.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0)
  const net = totalInc - totalExp

  // Group by date
  const grouped = groupBy(expenses, (e) => e.date)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const isIncomeList = currentFilters.type === 'income'
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem; background: var(--bg-secondary); padding: 14px 18px; border-radius: 12px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
      <div style="color: var(--text-muted); font-weight: 500;">${expenses.length} ${isIncomeList ? 'revenu' : 'dépense'}${expenses.length > 1 ? 's' : ''}</div>
      <div style="font-weight: 800; font-size: 1.1rem; color: ${isIncomeList ? 'var(--accent-secondary)' : 'var(--accent-danger)'};">
        Total: ${isIncomeList ? '+' : '-'}${formatCurrency(totalAmount)}
      </div>
    </div>
    <div class="expenses-list">
      ${sortedDates
        .map((date) => {
          return `
          <div class="expenses-group">
            <div class="expenses-group-date">
              <span>${formatDate(date)}</span>
            </div>
            ${grouped[date]
              .map((e) => {
                const isIncome = e.type === 'income'
                const cat = getCategoryById(e.category, e.type)
                const amountSign = isIncome ? '+' : '-'
                const amountColor = isIncome ? 'var(--accent-secondary)' : 'var(--accent-danger)'
                return `
              <div class="expense-item" data-id="${e.id}">
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
                    ${e.note ? `<span>•</span><span>${e.note}</span>` : ''}
                  </div>
                </div>
                <div class="expense-amount" style="color: ${amountColor}">${amountSign}${formatCurrency(e.amount)}</div>
                <div class="expense-actions">
                  <button class="btn btn-icon btn-ghost edit-btn" data-id="${e.id}" title="Modifier">✏️</button>
                  <button class="btn btn-icon btn-ghost delete-btn" data-id="${e.id}" title="Supprimer">🗑️</button>
                </div>
              </div>
            `
              })
              .join('')}
          </div>
        `
        })
        .join('')}
    </div>
  `

  // Edit buttons
  container.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.dataset.id
      const expense = expenses.find((ex) => ex.id === id)
      if (expense) {
        showExpenseModal({ user, expense, onSaved: () => loadExpenses(user) })
      }
    })
  })

  // Delete buttons
  container.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.dataset.id
      const expense = expenses.find((ex) => ex.id === id)
      if (!expense) return

      showConfirmModal({
        title: 'Supprimer la dépense',
        message: `Voulez-vous vraiment supprimer <strong>${expense.description}</strong> (${formatCurrency(expense.amount)}) ?`,
        confirmText: 'Supprimer',
        onConfirm: async () => {
          try {
            await deleteExpense(id)
            toast.success('Dépense supprimée')
            await loadExpenses(user)
          } catch (err) {
            toast.error('Erreur lors de la suppression')
          }
        }
      })
    })
  })
}
