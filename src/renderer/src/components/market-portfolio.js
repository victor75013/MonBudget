import { escapeHTML, formatCurrency } from '../utils/helpers.js'

export const instrumentId = ({ mic, symbol }) => `${mic}:${symbol}`
const currencyPattern = /^[A-Z]{3}$/
const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 8 })
const percentage = new Intl.NumberFormat('fr-FR', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 2 })

export function renderPortfolio(container, user, api, onSelect, onChanged) {
  const storageKey = `monbudget:market:portfolio:${user.id}`
  let positions = []
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (Array.isArray(saved)) positions = saved
  } catch {
    // An empty portfolio can still be opened when local storage is unavailable.
  }

  const quotes = new Map()
  let refreshing = false
  container.innerHTML = `
    <div class="finance-header">
      <h2 class="chart-title" id="market-portfolio-title">Mon portefeuille</h2>
      <button class="btn btn-secondary" type="button" id="portfolio-refresh">Actualiser les cours</button>
    </div>
    <p class="market-message" id="portfolio-status" role="status"></p>
    <div id="portfolio-totals" class="portfolio-totals"></div>
    <div class="finance-table-wrap">
      <table class="finance-table">
        <thead><tr><th>Valeur</th><th>Quantité</th><th>Coût total</th><th>Valorisation</th><th>Gain / perte latent</th><th>Actions</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `

  const status = container.querySelector('#portfolio-status')
  const totals = container.querySelector('#portfolio-totals')
  const body = container.querySelector('tbody')
  const refresh = container.querySelector('#portfolio-refresh')
  const cost = ({ quantity, price, fees }) => quantity * price + fees

  function render() {
    refresh.disabled = refreshing || !api || !positions.length
    body.closest('.finance-table-wrap').hidden = !positions.length
    totals.replaceChildren()
    const byCurrency = new Map()
    body.innerHTML = positions.map((position, index) => {
      const { instrument, quantity, currency } = position
      const basis = cost(position)
      const quote = quotes.get(instrumentId(instrument))
      const priced = quote?.currency === currency
      const value = priced ? quote.close * quantity : null
      const gain = priced ? value - basis : null
      const summary = byCurrency.get(currency) || { value: 0, gain: 0, priced: 0, count: 0 }
      summary.count++
      if (priced) {
        summary.value += value
        summary.gain += gain
        summary.priced++
      }
      byCurrency.set(currency, summary)
      return `
        <tr>
          <td><button class="portfolio-instrument" type="button" data-action="select" data-index="${index}">${escapeHTML(instrument.name)}</button><small>${escapeHTML(`${instrument.symbol} · ${instrument.exchange}`)}</small></td>
          <td>${numberFormat.format(quantity)}</td>
          <td>${formatCurrency(basis, currency)}</td>
          <td>${priced ? `${formatCurrency(value, currency)}<small>Cours du ${escapeHTML(quote.date)}</small>` : quote ? 'Devise différente du cours' : 'Cours indisponible'}</td>
          <td>${priced ? `<span class="${gain < 0 ? 'market-loss' : 'market-gain'}">${gain > 0 ? '+' : ''}${formatCurrency(gain, currency)} · ${percentage.format(gain / basis)}</span>` : '—'}</td>
          <td><button class="btn btn-secondary btn-sm" type="button" data-action="edit" data-index="${index}">Modifier</button></td>
        </tr>
      `
    }).join('')

    for (const [currency, summary] of byCurrency) {
      const card = document.createElement('p')
      card.innerHTML = `
        <strong>${summary.priced ? formatCurrency(summary.value, currency) : '—'}</strong>
        <span>${currency} · ${summary.priced}/${summary.count} position(s) valorisée(s)${summary.priced ? ` · ${summary.gain > 0 ? '+' : ''}${formatCurrency(summary.gain, currency)} latent` : ''}</span>
      `
      totals.append(card)
    }
  }

  function commit(next) {
    localStorage.setItem(storageKey, JSON.stringify(next))
    positions = next
    status.textContent = positions.length ? '' : 'Sélectionnez une action ou un ETF, puis ajoutez-le au portefeuille.'
    render()
    onChanged()
  }

  function edit(instrument) {
    const id = instrumentId(instrument)
    const existing = positions.find((position) => instrumentId(position.instrument) === id)
    const quotedCurrency = quotes.get(id)?.currency || instrument.currency
    const initialCurrency = existing?.currency || quotedCurrency || ''
    const dialog = document.createElement('dialog')
    dialog.className = 'finance-dialog portfolio-dialog'
    dialog.setAttribute('aria-labelledby', 'portfolio-edit-title')
    dialog.innerHTML = `
      <h2 id="portfolio-edit-title">${existing ? 'Modifier la position' : 'Ajouter au portefeuille'}</h2>
      <p class="market-message">${escapeHTML(instrument.name)} · ${escapeHTML(instrument.exchange)}</p>
      <form>
        <label>Quantité détenue<input class="form-input" name="quantity" type="number" step="any" min="0.00000001" max="1000000000" required /></label>
        <label>Prix moyen d’achat par titre, hors frais<input class="form-input" name="price" type="number" step="any" min="0.00000001" max="1000000000" required /></label>
        <label>Frais d’achat totaux<input class="form-input" name="fees" type="number" step="any" min="0" max="1000000000" value="0" required /></label>
        <label>Devise du cours<input class="form-input" name="currency" type="text" maxlength="3" pattern="[A-Za-z]{3}" placeholder="EUR" required /></label>
        <p class="market-message" role="status"></p>
        <div class="finance-dialog-actions">
          ${existing ? '<button class="btn btn-danger" type="button" id="portfolio-delete">Retirer la position</button>' : ''}
          <button class="btn btn-secondary" type="button" id="portfolio-cancel">Annuler</button>
          <button class="btn btn-primary" type="submit">Enregistrer</button>
        </div>
      </form>
    `
    const form = dialog.querySelector('form')
    const message = form.querySelector('p')
    form.elements.currency.value = initialCurrency
    if (existing) {
      for (const field of ['quantity', 'price', 'fees']) form.elements[field].value = existing[field]
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const quantity = form.elements.quantity.valueAsNumber
      const price = form.elements.price.valueAsNumber
      const fees = form.elements.fees.valueAsNumber
      const currency = form.elements.currency.value.trim().toUpperCase()
      if (!currencyPattern.test(currency) || ![quantity, price, fees].every(Number.isFinite) || quantity <= 0 || price <= 0 || fees < 0) {
        message.textContent = 'Vérifiez la quantité, le prix, les frais et la devise.'
        return
      }
      if (quotedCurrency && currency !== quotedCurrency) {
        message.textContent = `Saisissez le prix et les frais dans la devise de cotation (${quotedCurrency}).`
        return
      }
      const position = { instrument, quantity, price, fees, currency }
      try {
        commit(existing
          ? positions.map((item) => instrumentId(item.instrument) === id ? position : item)
          : [...positions, position])
        dialog.close()
        container.scrollIntoView({ block: 'nearest' })
      } catch {
        message.textContent = 'Impossible d’enregistrer la position sur cet appareil.'
      }
    })
    dialog.querySelector('#portfolio-delete')?.addEventListener('click', (event) => {
      if (event.currentTarget.dataset.confirm !== 'true') {
        event.currentTarget.dataset.confirm = 'true'
        event.currentTarget.textContent = 'Confirmer le retrait'
        return
      }
      try {
        commit(positions.filter((position) => instrumentId(position.instrument) !== id))
        dialog.close()
      } catch {
        message.textContent = 'Impossible de retirer la position.'
      }
    })
    dialog.querySelector('#portfolio-cancel').addEventListener('click', () => dialog.close())
    dialog.addEventListener('close', () => dialog.remove())
    document.body.append(dialog)
    dialog.showModal()
  }

  function updateQuote(instrument, { points, currency }) {
    const latest = points.at(-1)
    const quotedCurrency = currency || instrument.currency
    if (!latest || !currencyPattern.test(quotedCurrency)) return false
    quotes.set(instrumentId(instrument), { ...latest, currency: quotedCurrency })
    return true
  }

  body.addEventListener('click', ({ target }) => {
    const button = target.closest('[data-action]')
    if (!button) return
    const { instrument } = positions[Number(button.dataset.index)]
    if (button.dataset.action === 'edit') edit(instrument)
    else onSelect(instrument)
  })

  refresh.addEventListener('click', async () => {
    refreshing = true
    refresh.disabled = true
    status.textContent = 'Actualisation des cours…'
    let failed = 0
    for (const { instrument } of positions) {
      if (!container.isConnected) break
      try {
        const result = await api.history(instrument)
        if (result.error || !updateQuote(instrument, result.data)) failed++
      } catch {
        failed++
      }
    }
    refreshing = false
    status.textContent = failed ? `${failed} cours non actualisé(s). Les derniers cours disponibles restent affichés.` : 'Cours actualisés.'
    render()
  })

  status.textContent = positions.length
    ? 'Actualisez les cours pour valoriser vos positions.'
    : 'Sélectionnez une action ou un ETF, puis ajoutez-le au portefeuille.'
  render()
  return { edit, has: (instrument) => positions.some((position) => instrumentId(position.instrument) === instrumentId(instrument)), setQuote: (instrument, history) => {
    if (updateQuote(instrument, history)) render()
  } }
}
