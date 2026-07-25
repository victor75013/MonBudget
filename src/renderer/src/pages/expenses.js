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

export async function renderExpenses(container, user) {
  const { month, year } = getCurrentMonthYear()
  currentFilters = { month, year, category: '', search: '' }

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="expenses-toolbar">
        <h2>💸 Mes dépenses</h2>
        <button class="btn btn-primary" id="add-expense-btn">+ Ajouter</button>
      </div>

      <!-- Période -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <div class="period-selector">
          <button id="prev-month">◀</button>
          <div class="period-label" id="period-label">${formatMonthYear(month, year)}</div>
          <button id="next-month">▶</button>
        </div>

        <select class="form-select" id="filter-category" style="width: 180px;">
          <option value="">Toutes catégories</option>
          ${CATEGORIES.map((c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('')}
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

  // Events
  document.getElementById('add-expense-btn').addEventListener('click', () => {
    showExpenseModal({ user, onSaved: () => loadExpenses(user) })
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
    currentFilters = { month: m, year: y, category: '', search: '' }
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
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Aucune dépense trouvée</div>
        <div class="empty-state-text">Aucune dépense ne correspond à vos filtres pour cette période.</div>
      </div>
    `
    return
  }

  // Total
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Group by date
  const grouped = groupBy(expenses, (e) => e.date)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <div style="font-size: 0.8rem; color: var(--text-muted);">${expenses.length} transaction${expenses.length > 1 ? 's' : ''}</div>
      <div style="font-weight: 700; color: var(--text-primary);">${formatCurrency(total)}</div>
    </div>
    <div class="expenses-list">
      ${sortedDates
        .map((date) => {
          const dayTotal = grouped[date].reduce((sum, e) => sum + Number(e.amount), 0)
          return `
          <div class="expenses-group">
            <div class="expenses-group-date">
              <span>${formatDate(date)}</span>
              <span class="expenses-group-total">${formatCurrency(dayTotal)}</span>
            </div>
            ${grouped[date]
              .map((e) => {
                const cat = getCategoryById(e.category)
                return `
              <div class="expense-item" data-id="${e.id}">
                <div class="expense-icon" style="background: ${cat.bg}; color: ${cat.color}">
                  ${cat.emoji}
                </div>
                <div class="expense-info">
                  <div class="expense-desc">${e.description}</div>
                  <div class="expense-meta">
                    <span>${cat.label}</span>
                    ${e.note ? `<span>•</span><span>${e.note}</span>` : ''}
                  </div>
                </div>
                <div class="expense-amount negative">-${formatCurrency(e.amount)}</div>
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
