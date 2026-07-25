// ===========================
// MonBudget — Profile Page
// ===========================

import { getProfile, updateProfile, getAllExpenses } from '../api/supabase.js'
import { formatCurrency, exportToCSV } from '../utils/helpers.js'
import { toast } from '../components/toast.js'

export async function renderProfile(container, user) {
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Utilisateur'
  const initial = username.charAt(0).toUpperCase()

  container.innerHTML = `
    <div class="page-container fade-in">
      <div class="section-header">
        <h2 class="section-title">Profil</h2>
      </div>

      <div class="profile-grid">
        <!-- Left: Profile card -->
        <div>
          <div class="profile-card">
            <div class="profile-avatar-large">${initial}</div>
            <div class="profile-username" id="profile-username-display">${username}</div>
            <div class="profile-email">${user.email}</div>
            <div class="profile-stats" id="profile-stats-display">
              <div class="profile-stat-item">
                <div class="profile-stat-value skeleton" style="width:40px;height:24px;border-radius:4px;"></div>
                <div class="profile-stat-label">Dépenses</div>
              </div>
              <div class="profile-stat-item">
                <div class="profile-stat-value skeleton" style="width:60px;height:24px;border-radius:4px;"></div>
                <div class="profile-stat-label">Total</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Settings -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Edit profile -->
          <div class="settings-card">
            <h3>Modifier le profil</h3>
            <div id="profile-form-error" class="auth-error"></div>
            <div class="form-group">
              <label class="form-label">Nom d'utilisateur</label>
              <input class="form-input" type="text" id="profile-username-input"
                value="${username}" placeholder="Mon pseudo" />
            </div>
            <div class="form-group">
              <label class="form-label">Devise</label>
              <select class="form-select" id="profile-currency">
                <option value="EUR">€ Euro (EUR)</option>
                <option value="USD">$ Dollar US (USD)</option>
                <option value="GBP">£ Livre sterling (GBP)</option>
                <option value="CHF">₣ Franc suisse (CHF)</option>
                <option value="CAD">$ Dollar canadien (CAD)</option>
              </select>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" id="save-profile-btn">Enregistrer</button>
            </div>
          </div>

          <!-- Export -->
          <div class="settings-card">
            <h3>Export des données</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6;">
              Exportez toutes vos dépenses au format CSV pour les utiliser dans Excel ou Google Sheets.
            </p>
            <button class="btn btn-secondary" id="export-csv-btn">Exporter en CSV</button>
          </div>

          <!-- Account info -->
          <div class="settings-card">
            <h3>Informations du compte</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                <span style="color: var(--text-secondary);">Email</span>
                <span style="color: var(--text-primary);">${user.email}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                <span style="color: var(--text-secondary);">Membre depuis</span>
                <span style="color: var(--text-primary);">${new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  // Load stats and profile
  try {
    const [profile, allExpenses] = await Promise.all([
      getProfile(user.id).catch(() => null),
      getAllExpenses(user.id)
    ])

    const totalAmount = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

    document.getElementById('profile-stats-display').innerHTML = `
      <div class="profile-stat-item">
        <div class="profile-stat-value">${allExpenses.length}</div>
        <div class="profile-stat-label">Dépenses</div>
      </div>
      <div class="profile-stat-item">
        <div class="profile-stat-value">${formatCurrency(totalAmount)}</div>
        <div class="profile-stat-label">Total</div>
      </div>
    `

    if (profile?.currency) {
      document.getElementById('profile-currency').value = profile.currency
    }
  } catch (err) {
    console.error('Profile load error:', err)
  }

  // Save profile
  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const newUsername = document.getElementById('profile-username-input').value.trim()
    const currency = document.getElementById('profile-currency').value
    const errorEl = document.getElementById('profile-form-error')
    const btn = document.getElementById('save-profile-btn')

    if (!newUsername) {
      errorEl.textContent = 'Le nom d\'utilisateur ne peut pas être vide.'
      errorEl.classList.add('show')
      return
    }

    btn.disabled = true
    btn.textContent = 'Enregistrement...'
    errorEl.classList.remove('show')

    try {
      await updateProfile(user.id, { username: newUsername, currency })
      document.getElementById('profile-username-display').textContent = newUsername
      toast.success('Profil mis à jour !')
    } catch (err) {
      errorEl.textContent = err.message || 'Erreur lors de la mise à jour'
      errorEl.classList.add('show')
    } finally {
      btn.disabled = false
      btn.textContent = 'Enregistrer'
    }
  })

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', async () => {
    const btn = document.getElementById('export-csv-btn')
    btn.disabled = true
    btn.textContent = 'Export en cours...'
    try {
      const allExpenses = await getAllExpenses(user.id)
      if (allExpenses.length === 0) {
        toast.info('Aucune dépense à exporter.')
      } else {
        exportToCSV(allExpenses)
        toast.success(`${allExpenses.length} dépenses exportées !`)
      }
    } catch (err) {
      toast.error('Erreur lors de l\'export')
    } finally {
      btn.disabled = false
      btn.textContent = '📥 Exporter en CSV'
    }
  })
}
