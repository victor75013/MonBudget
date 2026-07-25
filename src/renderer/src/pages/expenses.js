// ===========================
// MonBudget — Expenses Page (Dépenses)
// ===========================

import { EXPENSE_CATEGORIES, getCurrentMonthYear, formatMonthYear, formatCurrency, formatDate, detectEmoji } from '../utils/helpers.js'
import { getExpenses } from '../api/supabase.js'
import { showExpenseModal } from '../components/expense-modal.js'

let currentFilters = {}

export async function renderExpenses(container, user) {
  const { month, year } = getCurrentMonthYear()
  currentFilters = { month, year, type: 'expense', category: '', search: '' }

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="expenses-toolbar">
        <h2>Mes dépenses</h2>
        <button class="btn btn-primary" id="add-expense-page-btn">+ Nouvelle dépense</button>
      </div>

      <!-- Période et filtres -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <div class="period-selector">
          <button id="exp-prev-month">◀</button>
          <div class="period-label" id="exp-period-label">${formatMonthYear(month, year)}</div>
          <button id="exp-next-month">▶</button>
        </div>

        <select class="form-select" id="exp-filter-category" style="width: 200px;">
          <option value="">Toutes catégories</option>
          ${EXPENSE_CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>

        <input class="form-input" type="text" id="exp-filter-search"
          placeholder="Rechercher une dépense..." style="max-width: 220px;" />

        <button class="btn btn-secondary btn-sm" id="exp-reset-filters">↺ Réinitialiser</button>
      </div>

      <div id="expenses-list-container">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${[1, 2, 3, 4, 5].map(() => `<div class="skeleton" style="height: 68px; border-radius: 10px;"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  document.getElementById('add-expense-page-btn').addEventListener('click', () => {
    showExpenseModal({
      user,
      defaultType: 'expense',
      onSaved: () => loadExpensesList(user)
    })
  })

  document.getElementById('exp-prev-month').addEventListener('click', () => {
    currentFilters.month--
    if (currentFilters.month < 1) {
      currentFilters.month = 12
      currentFilters.year--
    }
    updatePeriodLabel()
    loadExpensesList(user)
  })

  document.getElementById('exp-next-month').addEventListener('click', () => {
    currentFilters.month++
    if (currentFilters.month > 12) {
      currentFilters.month = 1
      currentFilters.year++
    }
    updatePeriodLabel()
    loadExpensesList(user)
  })

  document.getElementById('exp-filter-category').addEventListener('change', (e) => {
    currentFilters.category = e.target.value
    loadExpensesList(user)
  })

  let searchTimeout
  document.getElementById('exp-filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      currentFilters.search = e.target.value
      loadExpensesList(user)
    }, 300)
  })

  document.getElementById('exp-reset-filters').addEventListener('click', () => {
    const { month: m, year: y } = getCurrentMonthYear()
    currentFilters = { month: m, year: y, type: 'expense', category: '', search: '' }
    document.getElementById('exp-filter-category').value = ''
    document.getElementById('exp-filter-search').value = ''
    updatePeriodLabel()
    loadExpensesList(user)
  })

  await loadExpensesList(user)
}

function updatePeriodLabel() {
  const el = document.getElementById('exp-period-label')
  if (el) el.textContent = formatMonthYear(currentFilters.month, currentFilters.year)
}

async function loadExpensesList(user) {
  const listEl = document.getElementById('expenses-list-container')
  if (!listEl) return

  try {
    const items = await getExpenses(user.id, currentFilters)
    renderExpensesList(items, user, listEl)
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">Erreur de chargement</div></div>`
    console.error(err)
  }
}

function renderExpensesList(expenses, user, container) {
  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-title">Aucune dépense pour ce mois</div>
        <div class="empty-state-text">Vous n’avez aucune dépense enregistrée pour cette période.</div>
      </div>
    `
    return
  }

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Group by date
  const grouped = {}
  for (const item of expenses) {
    if (!grouped[item.date]) grouped[item.date] = []
    grouped[item.date].push(item)
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; font-size: 0.95rem; background: var(--bg-secondary); padding: 14px 20px; border-radius: 12px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
      <div style="color: var(--text-secondary); font-weight: 500;">
        ${expenses.length} dépense${expenses.length > 1 ? 's' : ''}
      </div>
      <div style="font-weight: 800; font-size: 1.15rem; color: var(--accent-danger);">
        Total dépenses: -${formatCurrency(totalAmount)}
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
                const cat = EXPENSE_CATEGORIES.find((c) => c.id === e.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
                const itemEmoji = e.icon || detectEmoji(e.description, e.category)
                return `
              <div class="expense-item" data-id="${e.id}">
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
                    ${e.note ? `<span>•</span><span>${e.note}</span>` : ''}
                  </div>
                </div>
                <div class="expense-amount" style="color: var(--accent-danger)">-${formatCurrency(e.amount)}</div>
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

  // Edit / Delete handlers
  container.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const item = expenses.find((i) => i.id === btn.dataset.id)
      if (item) {
        showExpenseModal({
          user,
          expense: item,
          defaultType: 'expense',
          onSaved: () => loadExpensesList(user)
        })
      }
    })
  })

  container.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const item = expenses.find((i) => i.id === btn.dataset.id)
      if (item) {
        import('../components/confirm-modal.js').then(({ showConfirmModal }) => {
          showConfirmModal({
            title: 'Supprimer cette dépense',
            message: `Êtes-vous sûr de vouloir supprimer "${item.description}" (${formatCurrency(item.amount)}) ?`,
            confirmText: 'Supprimer',
            isDanger: true,
            onConfirm: async () => {
              const { deleteExpense } = await import('../api/supabase.js')
              await deleteExpense(item.id)
              const { toast } = await import('../components/toast.js')
              toast.success('Dépense supprimée !')
              loadExpensesList(user)
            }
          })
        })
      }
    })
  })
}
