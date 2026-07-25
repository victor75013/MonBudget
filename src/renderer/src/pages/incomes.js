// ===========================
// MonBudget — Incomes Page (Revenus)
// ===========================

import { INCOME_CATEGORIES, getCurrentMonthYear, formatMonthYear, formatCurrency, formatDate } from '../utils/helpers.js'
import { getExpenses } from '../api/supabase.js'
import { showExpenseModal } from '../components/expense-modal.js'

let currentFilters = {}

export async function renderIncomes(container, user) {
  const { month, year } = getCurrentMonthYear()
  currentFilters = { month, year, type: 'income', category: '', search: '' }

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="expenses-toolbar">
        <h2>Mes revenus</h2>
        <button class="btn btn-teal" id="add-income-page-btn">+ Nouveau revenu</button>
      </div>

      <!-- Période et filtres -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <div class="period-selector">
          <button id="inc-prev-month">◀</button>
          <div class="period-label" id="inc-period-label">${formatMonthYear(month, year)}</div>
          <button id="inc-next-month">▶</button>
        </div>

        <select class="form-select" id="inc-filter-category" style="width: 200px;">
          <option value="">Toutes catégories</option>
          ${INCOME_CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>

        <input class="form-input" type="text" id="inc-filter-search"
          placeholder="Rechercher un revenu..." style="max-width: 220px;" />

        <button class="btn btn-secondary btn-sm" id="inc-reset-filters">↺ Réinitialiser</button>
      </div>

      <div id="incomes-list-container">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${[1, 2, 3, 4, 5].map(() => `<div class="skeleton" style="height: 68px; border-radius: 10px;"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  document.getElementById('add-income-page-btn').addEventListener('click', () => {
    showExpenseModal({
      user,
      defaultType: 'income',
      onSaved: () => loadIncomes(user)
    })
  })

  document.getElementById('inc-prev-month').addEventListener('click', () => {
    currentFilters.month--
    if (currentFilters.month < 1) {
      currentFilters.month = 12
      currentFilters.year--
    }
    updatePeriodLabel()
    loadIncomes(user)
  })

  document.getElementById('inc-next-month').addEventListener('click', () => {
    currentFilters.month++
    if (currentFilters.month > 12) {
      currentFilters.month = 1
      currentFilters.year++
    }
    updatePeriodLabel()
    loadIncomes(user)
  })

  document.getElementById('inc-filter-category').addEventListener('change', (e) => {
    currentFilters.category = e.target.value
    loadIncomes(user)
  })

  let searchTimeout
  document.getElementById('inc-filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      currentFilters.search = e.target.value
      loadIncomes(user)
    }, 300)
  })

  document.getElementById('inc-reset-filters').addEventListener('click', () => {
    const { month: m, year: y } = getCurrentMonthYear()
    currentFilters = { month: m, year: y, type: 'income', category: '', search: '' }
    document.getElementById('inc-filter-category').value = ''
    document.getElementById('inc-filter-search').value = ''
    updatePeriodLabel()
    loadIncomes(user)
  })

  await loadIncomes(user)
}

function updatePeriodLabel() {
  const el = document.getElementById('inc-period-label')
  if (el) el.textContent = formatMonthYear(currentFilters.month, currentFilters.year)
}

async function loadIncomes(user) {
  const listEl = document.getElementById('incomes-list-container')
  if (!listEl) return

  try {
    const items = await getExpenses(user.id, currentFilters)
    renderIncomesList(items, user, listEl)
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">Erreur de chargement</div></div>`
    console.error(err)
  }
}

function renderIncomesList(incomes, user, container) {
  if (incomes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-title">Aucun revenu pour ce mois</div>
        <div class="empty-state-text">Vous n’avez aucun revenu (salaire, freelance, etc.) enregistré pour cette période.</div>
      </div>
    `
    return
  }

  const totalAmount = incomes.reduce((sum, e) => sum + Number(e.amount), 0)

  // Group by date
  const grouped = {}
  for (const item of incomes) {
    if (!grouped[item.date]) grouped[item.date] = []
    grouped[item.date].push(item)
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; font-size: 0.95rem; background: var(--bg-secondary); padding: 14px 20px; border-radius: 12px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
      <div style="color: var(--text-secondary); font-weight: 500;">
        ${incomes.length} revenu${incomes.length > 1 ? 's' : ''}
      </div>
      <div style="font-weight: 800; font-size: 1.15rem; color: var(--accent-secondary);">
        Total revenus: +${formatCurrency(totalAmount)}
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
                const cat = INCOME_CATEGORIES.find((c) => c.id === e.category) || INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1]
                return `
              <div class="expense-item" data-id="${e.id}">
                <div class="expense-icon" style="background: ${cat.bg}; color: ${cat.color}">
                  ⬆️
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
                <div class="expense-amount" style="color: var(--accent-secondary)">+${formatCurrency(e.amount)}</div>
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
      const item = incomes.find((i) => i.id === btn.dataset.id)
      if (item) {
        showExpenseModal({
          user,
          expense: item,
          defaultType: 'income',
          onSaved: () => loadIncomes(user)
        })
      }
    })
  })

  container.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const item = incomes.find((i) => i.id === btn.dataset.id)
      if (item) {
        import('../components/confirm-modal.js').then(({ showConfirmModal }) => {
          showConfirmModal({
            title: 'Supprimer ce revenu',
            message: `Êtes-vous sûr de vouloir supprimer "${item.description}" (${formatCurrency(item.amount)}) ?`,
            confirmText: 'Supprimer',
            isDanger: true,
            onConfirm: async () => {
              const { deleteExpense } = await import('../api/supabase.js')
              await deleteExpense(item.id)
              const { toast } = await import('../components/toast.js')
              toast.success('Revenu supprimé !')
              loadIncomes(user)
            }
          })
        })
      }
    })
  })
}
