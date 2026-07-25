// ===========================
// MonBudget — Expense Modal
// Add / Edit an expense
// ===========================

import { CATEGORIES, todayISO, escapeHTML } from '../utils/helpers.js'
import { addExpense, updateExpense } from '../api/supabase.js'
import { toast } from './toast.js'

export function showExpenseModal({ user, expense = null, onSaved }) {
  const isEdit = !!expense
  const existing = document.getElementById('expense-modal-overlay')
  if (existing) existing.remove()

  const categoryPickerHTML = CATEGORIES.map(
    (cat) => `
    <div class="category-option ${expense?.category === cat.id ? 'selected' : ''}"
         data-cat="${cat.id}"
         style="--cat-color: ${cat.color}; --cat-bg: ${cat.bg}">
      <span class="cat-emoji">${cat.emoji}</span>
      <span>${cat.label}</span>
    </div>
  `
  ).join('')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'expense-modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '✏️ Modifier la dépense' : '➕ Nouvelle dépense'}</div>
        <button class="modal-close" id="expense-modal-close">✕</button>
      </div>

      <div id="expense-form-error" class="auth-error"></div>

      <div class="form-group">
        <label class="form-label">Montant (€)</label>
        <input class="form-input" type="number" id="exp-amount" placeholder="0.00"
          step="0.01" min="0.01" value="${expense?.amount || ''}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" type="text" id="exp-desc" placeholder="Ex: Courses Carrefour"
          value="${expense ? escapeHTML(expense.description) : ''}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Catégorie</label>
        <div class="category-picker" id="category-picker">
          ${categoryPickerHTML}
        </div>
        <input type="hidden" id="exp-category" value="${expense?.category || ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="exp-date"
          value="${expense?.date || todayISO()}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Note (optionnel)</label>
        <textarea class="form-input form-textarea" id="exp-note" placeholder="Détails supplémentaires...">${expense ? escapeHTML(expense.note || '') : ''}</textarea>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" id="expense-modal-cancel">Annuler</button>
        <button class="btn btn-primary" id="expense-modal-save">
          ${isEdit ? 'Enregistrer' : 'Ajouter la dépense'}
        </button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))

  // Category picker
  overlay.querySelectorAll('.category-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      overlay.querySelectorAll('.category-option').forEach((o) => o.classList.remove('selected'))
      opt.classList.add('selected')
      document.getElementById('exp-category').value = opt.dataset.cat
    })
  })

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
    const category = document.getElementById('exp-category').value
    const date = document.getElementById('exp-date').value
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
    if (!date) {
      errorEl.textContent = 'Veuillez choisir une date.'
      errorEl.classList.add('show')
      return
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'Enregistrement...'

    try {
      if (isEdit) {
        await updateExpense(expense.id, { amount, description, category, date, note })
        toast.success('Dépense modifiée !')
      } else {
        await addExpense({ user_id: user.id, amount, description, category, date, note })
        toast.success('Dépense ajoutée !')
      }
      close()
      if (onSaved) onSaved()
    } catch (err) {
      errorEl.textContent = err.message || 'Une erreur est survenue.'
      errorEl.classList.add('show')
      saveBtn.disabled = false
      saveBtn.textContent = isEdit ? 'Enregistrer' : 'Ajouter la dépense'
    }
  })

  // Focus first input
  setTimeout(() => document.getElementById('exp-amount')?.focus(), 100)
}
