// ===========================
// MonBudget — Confirm Modal
// ===========================

export function showConfirmModal({ title, message, confirmText = 'Supprimer', onConfirm }) {
  const existing = document.getElementById('confirm-modal-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay confirm-modal'
  overlay.id = 'confirm-modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width: 380px; text-align: center;">
      <div class="confirm-icon">⚠️</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-text">${message}</div>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="confirm-cancel">Annuler</button>
        <button class="btn btn-danger" id="confirm-ok">${confirmText}</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))

  function close() {
    overlay.classList.remove('show')
    setTimeout(() => overlay.remove(), 300)
  }

  document.getElementById('confirm-cancel').addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  document.getElementById('confirm-ok').addEventListener('click', () => {
    close()
    if (onConfirm) onConfirm()
  })
}
