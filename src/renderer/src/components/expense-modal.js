// ===========================
// MonBudget — Transaction Modal
// Add / Edit a transaction (Expense or Income)
// ===========================

import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  todayISO,
  escapeHTML,
  detectEmoji
} from '../utils/helpers.js'
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
        <label class="form-label">Description & Icône</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" id="exp-icon-btn" style="width: 44px; height: 44px; font-size: 1.4rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); cursor: pointer; flex-shrink: 0;" title="Changer l'icône">
            ${expense?.icon || detectEmoji(expense?.description, expense?.category)}
          </button>
          <input class="form-input" type="text" id="exp-desc" placeholder="Ex: Électricité, Loyer, Courses, Salaire"
            value="${expense ? escapeHTML(expense.description) : ''}" required style="flex: 1;" />
        </div>
        <input type="hidden" id="exp-icon" value="${expense?.icon || ''}" />
        <div id="emoji-picker-container" style="display: none; margin-top: 8px; padding: 10px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color); grid-template-columns: repeat(8, 1fr); gap: 6px; text-align: center; font-size: 1.2rem;">
          ${['⚡', '🏠', '💧', '📶', '🛒', '🍕', '🍔', '🥖', '☕', '⛽', '🚗', '🚆', '🚌', '💊', '🩺', '🎬', '🍿', '🎮', '🏋️', '👕', '📄', '💼', '💻', '📈', '🎁', '🏛️', '🏷️'].map((e) => `<span class="emoji-opt" style="cursor: pointer; padding: 4px; border-radius: 4px;">${e}</span>`).join('')}
        </div>
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
          Ex: Loyer, abonnement, salaire fixe... S'applique chaque mois à partir de la date choisie.
        </div>
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

  // Emoji Auto-Detection & Picker
  const descInput = document.getElementById('exp-desc')
  const iconBtn = document.getElementById('exp-icon-btn')
  const iconInput = document.getElementById('exp-icon')
  const emojiPicker = document.getElementById('emoji-picker-container')
  let isCustomIcon = !!(expense && expense.icon)

  if (descInput && iconBtn) {
    descInput.addEventListener('input', () => {
      if (!isCustomIcon) {
        const detected = detectEmoji(descInput.value, categoryInput.value)
        iconBtn.textContent = detected
      }
    })

    iconBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid'
    })

    emojiPicker.querySelectorAll('.emoji-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        isCustomIcon = true
        const selected = opt.textContent.trim()
        iconBtn.textContent = selected
        iconInput.value = selected
        emojiPicker.style.display = 'none'
      })
    })
  }

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
    const icon = iconInput.value || iconBtn.textContent.trim() || detectEmoji(description, category)
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
      if (isEdit) {
        const originalMonthKey = expense?.date ? expense.date.substring(0, 7) : ''
        const newMonthKey = date ? date.substring(0, 7) : ''

        if (expense.is_recurring && is_recurring && (amount !== Number(expense.amount) || originalMonthKey !== newMonthKey)) {
          // Si le montant ou le mois change pour une opération récurrente :
          // On crée une nouvelle version récurrente à cette nouvelle date.
          // L'ancienne version récurrente reste intacte dans la BDD pour l'historique des mois passés.
          await addExpense({
            user_id: user.id,
            amount,
            description,
            category,
            date,
            type: currentType,
            is_recurring: true,
            icon,
            note
          })
          toast.success('Nouveau montant récurrent appliqué à partir de cette date !')
        } else {
          // Simple mise à jour au sein du même mois
          await updateExpense(expense.id, {
            amount,
            description,
            category,
            date,
            type: currentType,
            is_recurring,
            icon,
            note
          })
          toast.success('Transaction modifiée !')
        }
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
          icon,
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
