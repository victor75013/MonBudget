import { getImportCandidates, importExpenses } from '../api/supabase.js'
import { bankFingerprint, bankRuleKey, detectBankColumns, mapBankRow, parseBankCsv } from '../utils/bank-csv.js'
import { detectEmoji, escapeHTML, formatCurrency, getCategoriesByType } from '../utils/helpers.js'

const fields = {
  date: 'Date',
  description: 'Libellé',
  amount: 'Montant signé',
  debit: 'Débit',
  credit: 'Crédit'
}

export function showBankImport(user, onImported) {
  const rulesKey = `monbudget:bank-rules:${user.id}`
  let rules = {}
  try {
    rules = JSON.parse(localStorage.getItem(rulesKey) || '{}') || {}
  } catch {
    // The preview can still be used without saved categories.
  }

  const dialog = document.createElement('dialog')
  dialog.className = 'finance-dialog'
  dialog.setAttribute('aria-labelledby', 'bank-import-title')
  dialog.innerHTML = `
    <h2 id="bank-import-title">Importer un relevé bancaire</h2>
    <p class="market-message">Choisissez un fichier CSV en euros. Vérifiez les opérations avant de les ajouter à MonBudget.</p>
    <form>
      <label class="form-label" for="bank-file">Fichier CSV</label>
      <input class="form-input" id="bank-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" />
      <div class="bank-columns" hidden></div>
      <p class="market-message" role="status" id="bank-import-status"></p>
      <div class="finance-table-wrap" hidden>
        <table class="finance-table">
          <thead><tr><th>Importer</th><th>Date</th><th>Libellé</th><th>Montant</th><th>Catégorie</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <label class="bank-remember" hidden><input type="checkbox" checked /> Retenir les catégories modifiées pour ces libellés</label>
      <div class="finance-dialog-actions">
        <button class="btn btn-secondary" type="button" id="bank-close">Fermer</button>
        <button class="btn btn-primary" type="submit" disabled>Importer les lignes cochées</button>
      </div>
    </form>
  `
  document.body.append(dialog)
  const form = dialog.querySelector('form')
  const fileInput = dialog.querySelector('#bank-file')
  const columnsPanel = dialog.querySelector('.bank-columns')
  const status = dialog.querySelector('#bank-import-status')
  const table = dialog.querySelector('.finance-table-wrap')
  const body = table.querySelector('tbody')
  const remember = dialog.querySelector('.bank-remember')
  const close = dialog.querySelector('#bank-close')
  const submit = form.querySelector('[type=submit]')
  let csv
  let preview = []
  let invalid = 0
  let revision = 0
  let importing = false

  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('cancel', (event) => {
    if (importing) event.preventDefault()
  })
  dialog.addEventListener('close', () => dialog.remove())

  function updateSummary() {
    const selected = preview.filter((entry) => entry.checked).length
    const existing = preview.filter((entry) => entry.duplicate).length
    status.textContent = `${selected} ligne(s) cochée(s) · ${existing} doublon(s) possible(s) · ${invalid} ligne(s) illisible(s) ou à zéro`
    submit.disabled = !selected
  }

  function getExisting(rows) {
    const dates = rows.map(({ date }) => date).sort()
    return getImportCandidates(user.id, dates[0], dates.at(-1))
  }

  async function previewRows() {
    const currentRevision = ++revision
    preview = []
    table.hidden = remember.hidden = true
    submit.disabled = true
    const mapping = Object.fromEntries([...columnsPanel.querySelectorAll('select')].map((select) => [select.name, Number(select.value)]))
    const activeFields = mapping.amount >= 0 ? ['date', 'description', 'amount'] : ['date', 'description', 'debit', 'credit']
    const indices = activeFields.map((field) => mapping[field]).filter((index) => index >= 0)
    if (mapping.date < 0 || mapping.description < 0 ||
        (mapping.amount < 0 && mapping.debit < 0 && mapping.credit < 0) ||
        new Set(indices).size !== indices.length) {
      status.textContent = 'Associez des colonnes distinctes à la date, au libellé et au montant (ou au débit et au crédit).'
      return
    }
    const rows = csv.rows.map((row) => row.length === csv.headers.length ? mapBankRow(row, mapping) : null).filter(Boolean)
    invalid = csv.rows.length - rows.length
    if (!rows.length) {
      status.textContent = 'Aucune opération lisible. Vérifiez les colonnes, les dates et les montants.'
      return
    }

    status.textContent = 'Vérification des doublons…'
    try {
      const known = new Set((await getExisting(rows)).map(bankFingerprint))
      if (currentRevision !== revision || !dialog.open) return
      preview = rows.map((row) => {
        const fingerprint = bankFingerprint(row)
        const duplicate = known.has(fingerprint)
        known.add(fingerprint)
        const categories = getCategoriesByType(row.type)
        const saved = rules[bankRuleKey(row)]
        const category = categories.some(({ id }) => id === saved) ? saved : categories.at(-1).id
        return { row, duplicate, checked: !duplicate, category, originalCategory: category }
      })
      body.innerHTML = preview.map(({ row, checked, duplicate, category }, index) => `
        <tr>
          <td><input type="checkbox" data-row="${index}" aria-label="Importer la ligne ${index + 1}" ${checked ? 'checked' : ''} /></td>
          <td>${row.date}</td>
          <td>${escapeHTML(row.description)}${duplicate ? '<small>Doublon possible</small>' : ''}</td>
          <td>${row.type === 'expense' ? '−' : '+'}${formatCurrency(row.amount)}</td>
          <td><select class="form-select" data-row="${index}" aria-label="Catégorie de la ligne ${index + 1}">
            ${getCategoriesByType(row.type).map(({ id, label }) => `<option value="${id}" ${id === category ? 'selected' : ''}>${label}</option>`).join('')}
          </select></td>
        </tr>
      `).join('')
      table.hidden = remember.hidden = false
      updateSummary()
    } catch {
      if (currentRevision === revision) status.textContent = 'Impossible de vérifier les doublons. Rechargez le fichier pour réessayer.'
    }
  }

  fileInput.addEventListener('change', async () => {
    const currentRevision = ++revision
    const file = fileInput.files[0]
    columnsPanel.hidden = table.hidden = remember.hidden = submit.disabled = true
    status.textContent = ''
    if (!file) return
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Le fichier dépasse 2 Mo.')
      const bytes = await file.arrayBuffer()
      let text = new TextDecoder().decode(bytes)
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(bytes)
      if (currentRevision !== revision || !dialog.open) return
      csv = parseBankCsv(text)
      const detected = detectBankColumns(csv.headers)
      columnsPanel.innerHTML = Object.entries(fields).map(([name, label]) => `
        <label>${label}<select class="form-select" name="${name}">
          <option value="-1">Non utilisé</option>
          ${csv.headers.map((header, index) => `<option value="${index}" ${index === detected[name] ? 'selected' : ''}>${escapeHTML(header || `Colonne ${index + 1}`)}</option>`).join('')}
        </select></label>
      `).join('')
      columnsPanel.hidden = false
      void previewRows()
    } catch (error) {
      if (currentRevision === revision) status.textContent = error.message
    }
  })

  columnsPanel.addEventListener('change', () => void previewRows())
  body.addEventListener('change', ({ target }) => {
    const entry = preview[target.dataset.row]
    if (!entry) return
    if (target.type === 'checkbox') {
      entry.checked = target.checked
      updateSummary()
    } else entry.category = target.value
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const selected = preview.filter((entry) => entry.checked)
    if (importing || !selected.length) return
    importing = true
    const controls = [...form.elements].filter((element) => !element.disabled)
    controls.forEach((element) => { element.disabled = true })
    status.textContent = 'Import en cours…'
    let imported = []
    try {
      const commit = async () => {
        const known = new Set((await getExisting(selected.map(({ row }) => row))).map(bankFingerprint))
        const fresh = selected.filter(({ row, duplicate }) => duplicate || !known.has(bankFingerprint(row)))
        if (fresh.length) await importExpenses(fresh.map(({ row, category }) => ({
          ...row,
          user_id: user.id,
          category,
          is_recurring: false,
          icon: detectEmoji(row.description, category)
        })))
        return fresh
      }
      imported = navigator.locks
        ? await navigator.locks.request(`monbudget:bank-import:${user.id}`, commit)
        : await commit()
    } catch {
      status.textContent = 'L’import a échoué. Vérifiez la connexion puis réessayez.'
      return
    } finally {
      importing = false
      controls.forEach((element) => { element.disabled = false })
    }
    let rulesSaved = true
    if (remember.querySelector('input').checked) {
      for (const entry of imported) {
        if (entry.category !== entry.originalCategory) rules[bankRuleKey(entry.row)] = entry.category
      }
      try {
        localStorage.setItem(rulesKey, JSON.stringify(rules))
      } catch {
        rulesSaved = false
      }
    }
    const count = imported.length
    const skipped = selected.length - count
    status.textContent = `${count} opération(s) importée(s).${skipped ? ` ${skipped} doublon(s) ignoré(s).` : ''}${rulesSaved ? '' : ' Les règles de catégories n’ont pas pu être mémorisées.'}`
    preview = []
    table.hidden = remember.hidden = columnsPanel.hidden = submit.disabled = true
    fileInput.value = ''
    if (count) onImported()
  })

  dialog.showModal()
}
