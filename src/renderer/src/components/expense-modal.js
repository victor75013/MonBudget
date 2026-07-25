// ===========================
// MonBudget — Transaction Modal
// Add / Edit a transaction (Expense or Income)
// ===========================

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, todayISO, escapeHTML } from '../utils/helpers.js'
import { addExpense, updateExpense } from '../api/supabase.js'
import { toast } from './toast.js'

export function showExpenseModal({ user, expense = null, defaultType = 'expense', onSaved }) {
  const isEdit = !!expense
  let currentType = expense?.type || defaultType
  const existing = document.getElementById('expense-modal-overlay')
  if (existing) existing.remove()

  function getCategoryOptionsHTML(type) {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    const selectedCat = expense?.category || list[0].id
    return list
      .map(
        (cat) => `
      <div class="category-option ${selectedCat === cat.id ? 'selected' : ''}"
           data-cat="${cat.id}"
           style="--cat-color: ${cat.color}; --cat-bg: ${cat.bg}">
        <span>${cat.label}</span>
      </div>
    `
      )
      .join('')
  }

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'expense-modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Modifier la transaction' : 'Nouvelle transaction'}</div>
        <button class="modal-close" id="expense-modal-close">✕</button>
      </div>

      <div id="expense-form-error" class="auth-error"></div>

      <!-- Type Toggle -->
      <div class="form-group">
        <label class="form-label">Type d'opération</label>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn ${currentType === 'expense' ? 'btn-danger' : 'btn-secondary'}"
                  id="type-expense-btn" style="flex: 1;">
            Dépense
          </button>
          <button type="button" class="btn ${currentType === 'income' ? 'btn-teal' : 'btn-secondary'}"
                  id="type-income-btn" style="flex: 1;">
            Revenu
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Montant (€)</label>
        <input class="form-input" type="number" id="exp-amount" placeholder="0.00"
          step="0.01" min="0.01" value="${expense?.amount || ''}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" type="text" id="exp-desc" placeholder="Ex: Salaire, Loyer, Courses"
          value="${expense ? escapeHTML(expense.description) : ''}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Catégorie</label>
        <div class="category-picker" id="category-picker">
          ${getCategoryOptionsHTML(currentType)}
        </div>
        <input type="hidden" id="exp-category" value="${expense?.category || (currentType === 'income' ? INCOME_CATEGORIES[0].id : EXPENSE_CATEGORIES[0].id)}" />
      </div>

      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="exp-date"
          value="${expense?.date || todayISO()}" required />
      </div>

      <!-- Option Opération fixe / récurrente -->
      <div class="form-group" style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 16px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
          <input type="checkbox" id="exp-recurring" ${expense?.is_recurring ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
          <span>Opération fixe / récurrente (tous les mois)</span>
        </label>
        <div class="form-hint" style="margin-top: 4px; margin-left: 28px;">
          Ex: Loyer, abonnement, salaire fixe... Sera prise en compte uniquement à partir du mois sélectionné.
        </div>
        ${isEdit && expense?.is_recurring ? `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color); margin-left: 28px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.8rem; color: var(--text-secondary);">
              <input type="checkbox" id="exp-keep-history" checked style="width: 16px; height: 16px; cursor: pointer;" />
              <span>Conserver l'ancien montant pour l'historique des mois passés</span>
            </label>
          </div>
        ` : ''}
      </div>

      <div class="form-group">
        <label class="form-label">Note (optionnel)</label>
        <textarea class="form-input form-textarea" id="exp-note" placeholder="Détails supplémentaires...">${expense ? escapeHTML(expense.note || '') : ''}</textarea>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" id="expense-modal-cancel">Annuler</button>
        <button class="btn btn-primary" id="expense-modal-save">
          ${isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))

  // Type Toggle Buttons
  const expenseBtn = document.getElementById('type-expense-btn')
  const incomeBtn = document.getElementById('type-income-btn')
  const pickerEl = document.getElementById('category-picker')
  const categoryInput = document.getElementById('exp-category')

  function updateTypeUI(newType) {
    currentType = newType
    if (currentType === 'expense') {
      expenseBtn.className = 'btn btn-danger'
      incomeBtn.className = 'btn btn-secondary'
    } else {
      expenseBtn.className = 'btn btn-secondary'
      incomeBtn.className = 'btn btn-teal'
    }
    pickerEl.innerHTML = getCategoryOptionsHTML(currentType)
    categoryInput.value = (currentType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0].id
    attachCategoryPickerEvents()
  }

  expenseBtn.addEventListener('click', () => updateTypeUI('expense'))
  incomeBtn.addEventListener('click', () => updateTypeUI('income'))

  function attachCategoryPickerEvents() {
    overlay.querySelectorAll('.category-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        overlay.querySelectorAll('.category-option').forEach((o) => o.classList.remove('selected'))
        opt.classList.add('selected')
        categoryInput.value = opt.dataset.cat
      })
    })
  }

  attachCategoryPickerEvents()

  function close() {
    overlay.classList.remove('show')
    setTimeout(() => overlay.remove(), 300)
  }

  document.getElementById('expense-modal-close').addEventListener('click', close)
  document.getElementById('expense-modal-cancel').addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  document.getElementById('expense-modal-save').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('exp-amount').value)
    const description = document.getElementById('exp-desc').value.trim()
    const category = categoryInput.value
    const date = document.getElementById('exp-date').value
    const is_recurring = document.getElementById('exp-recurring').checked
    const note = document.getElementById('exp-note').value.trim()
    const errorEl = document.getElementById('expense-form-error')
    const saveBtn = document.getElementById('expense-modal-save')

    errorEl.classList.remove('show')

    if (!amount || amount <= 0) {
      errorEl.textContent = 'Veuillez saisir un montant valide.'
      errorEl.classList.add('show')
      return
    }
    if (!description) {
      errorEl.textContent = 'Veuillez saisir une description.'
      errorEl.classList.add('show')
      return
    }
    if (!category) {
      errorEl.textContent = 'Veuillez choisir une catégorie.'
      errorEl.classList.add('show')
      return
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Enregistrement...'

    try {
      const keepHistoryInput = document.getElementById('exp-keep-history')
      const shouldKeepHistory = keepHistoryInput ? keepHistoryInput.checked : true

      const originalMonthKey = expense?.date ? expense.date.substring(0, 7) : ''
      const newMonthKey = date ? date.substring(0, 7) : ''
      const dateMonthChanged = isEdit && originalMonthKey !== newMonthKey

      if (isEdit && expense.is_recurring && (shouldKeepHistory || dateMonthChanged)) {
        // 1. L'ancienne transaction reste inchangée dans son mois d'origine avec son ancienne date et son ancien montant,
        //    mais n'est plus récurrente afin de ne plus impacter les mois futurs.
        await updateExpense(expense.id, {
          amount: Number(expense.amount),
          date: expense.date,
          is_recurring: false
        })

        // 2. La nouvelle transaction récurrente prend le relais à la NOUVELLE date choisie avec le NOUVEAU montant
        await addExpense({
          user_id: user.id,
          amount,
          description,
          category,
          date, // Nouvelle date choisie (ex: 2026-08-01)
          type: currentType,
          is_recurring,
          note
        })
        toast.success('Nouveau montant appliqué à partir de cette date !')
      } else if (isEdit) {
        // Simple mise à jour au sein du même mois
        await updateExpense(expense.id, {
          amount,
          description,
          category,
          date,
          type: currentType,
          is_recurring,
          note
        })
        toast.success('Transaction modifiée !')
      } else {
        // Création initiale
        await addExpense({
          user_id: user.id,
          amount,
          description,
          category,
          date,
          type: currentType,
          is_recurring,
          note
        })
        toast.success(currentType === 'income' ? 'Revenu ajouté !' : 'Dépense ajoutée !')
      }
      close()
      if (onSaved) onSaved()
    } catch (err) {
      errorEl.textContent = err.message || 'Une erreur est survenue.'
      errorEl.classList.add('show')
      saveBtn.disabled = false
      saveBtn.textContent = isEdit ? 'Enregistrer' : 'Ajouter'
    }
  })

  setTimeout(() => document.getElementById('exp-amount')?.focus(), 100)
}
