import { escapeHTML } from '../utils/helpers.js'
import { instrumentId, renderPortfolio } from '../components/market-portfolio.js'

const dayFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' })
const percentFormat = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  signDisplay: 'exceptZero',
  maximumFractionDigits: 2
})
const formatDay = (date) => dayFormat.format(new Date(`${date}T00:00:00Z`))

export function renderMarket(container, user) {
  const api = window.api?.market
  const storageKey = `monbudget:market:favorites:${user.id}`
  let favorites
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
    favorites = Array.isArray(saved) ? saved : []
  } catch {
    favorites = []
  }

  container.innerHTML = `
    <div class="page-container market-page fade-in">
      <header class="market-heading">
        <h1>Bourse</h1>
        <p>Actions françaises et américaines, et ETF. Données fournies par Twelve Data.</p>
        <details class="market-settings">
          <summary>Clé API Twelve Data</summary>
          <form class="market-key-form">
            <label class="visually-hidden" for="market-key">Clé API Twelve Data</label>
            <input class="form-input" type="password" id="market-key" placeholder="Saisir une clé API" autocomplete="off" maxlength="128" required />
            <button class="btn btn-secondary" type="submit">Enregistrer la clé</button>
          </form>
          <p class="market-message" id="market-key-status" role="status"></p>
        </details>
      </header>
      <div class="market-grid">
        <div class="market-sidebar">
          <section class="chart-container" aria-labelledby="market-search-title">
            <h2 class="chart-title" id="market-search-title">Rechercher une valeur</h2>
            <form class="market-search">
              <label class="visually-hidden" for="market-query">Nom ou symbole</label>
              <input class="form-input" type="search" id="market-query" placeholder="Ex. LVMH, AAPL, ETF Monde" maxlength="80" required disabled />
              <button class="btn btn-primary" type="submit" disabled>Rechercher</button>
            </form>
            <p class="market-message" id="market-search-status" role="status">Vérification de l’accès aux cours…</p>
            <ul class="market-list" id="market-results"></ul>
          </section>
          <section class="chart-container" aria-labelledby="market-favorites-title">
            <h2 class="chart-title" id="market-favorites-title">Favoris</h2>
            <ul class="market-list" id="market-favorites"></ul>
            <p class="market-message" id="market-favorites-status" role="status"></p>
          </section>
        </div>
        <section class="chart-container market-detail" aria-labelledby="market-detail-title">
          <h2 class="chart-title" id="market-detail-title">Cours et historique</h2>
          <div class="market-instrument-actions" hidden>
            <button class="btn btn-secondary" type="button" id="market-toggle-favorite"></button>
            <button class="btn btn-secondary" type="button" id="market-refresh">Actualiser</button>
            <button class="btn btn-primary" type="button" id="market-add-position">Ajouter au portefeuille</button>
          </div>
          <div id="market-detail-content" aria-live="polite">
            <p class="market-message">Sélectionnez une valeur pour afficher son cours et son historique.</p>
          </div>
        </section>
      </div>
      <section class="chart-container market-portfolio" aria-labelledby="market-portfolio-title"></section>
    </div>
  `

  const page = container.firstElementChild
  const form = page.querySelector('.market-search')
  const keyForm = page.querySelector('.market-key-form')
  const keyStatus = page.querySelector('#market-key-status')
  const input = form.querySelector('input')
  const submit = form.querySelector('button')
  const searchStatus = page.querySelector('#market-search-status')
  const results = page.querySelector('#market-results')
  const favoriteList = page.querySelector('#market-favorites')
  const favoriteStatus = page.querySelector('#market-favorites-status')
  const title = page.querySelector('#market-detail-title')
  const detail = page.querySelector('#market-detail-content')
  const favoriteButton = page.querySelector('#market-toggle-favorite')
  const refresh = page.querySelector('#market-refresh')
  const positionButton = page.querySelector('#market-add-position')
  let selected
  let chart
  let requestNumber = 0
  let configured = false
  const portfolio = renderPortfolio(page.querySelector('.market-portfolio'), user, api, selectInstrument, updatePositionButton)

  window.addEventListener('hashchange', () => {
    requestNumber++
    chart?.destroy()
  }, { once: true })

  function renderInstruments(list, instruments) {
    list.replaceChildren()
    for (const instrument of instruments) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'market-instrument'
      button.dataset.instrument = instrumentId(instrument)
      button.setAttribute('aria-pressed', String(Boolean(selected && instrumentId(selected) === instrumentId(instrument))))
      button.innerHTML = `
        <strong>${escapeHTML(instrument.name)}</strong>
        <span>${escapeHTML(`${instrument.symbol} · ${instrument.exchange} · ${instrument.type}`)}</span>
      `
      button.addEventListener('click', () => void selectInstrument(instrument))
      item.append(button)
      list.append(item)
    }
  }

  function updateFavoriteButton() {
    const isFavorite = favorites.some((item) => instrumentId(item) === instrumentId(selected))
    favoriteButton.textContent = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
  }

  function renderFavorites() {
    renderInstruments(favoriteList, favorites)
    favoriteStatus.textContent = favorites.length ? '' : 'Aucune valeur suivie pour le moment.'
  }

  async function selectInstrument(instrument) {
    selected = instrument
    const currentRequest = ++requestNumber
    chart?.destroy()
    chart = undefined
    title.textContent = instrument.name
    favoriteButton.parentElement.hidden = false
    updateFavoriteButton()
    updatePositionButton()
    for (const button of page.querySelectorAll('[data-instrument]')) {
      button.setAttribute('aria-pressed', String(button.dataset.instrument === instrumentId(instrument)))
    }
    refresh.disabled = true
    detail.textContent = configured ? 'Chargement des cours…' : 'Configurez la clé Twelve Data pour afficher les cours.'
    if (!configured) return

    try {
      const result = await api.history(instrument)
      if (!page.isConnected || currentRequest !== requestNumber) return
      if (result.error) throw new Error(result.error)
      const { points, currency } = result.data
      portfolio.setQuote(instrument, result.data)
      if (!points.length) {
        detail.textContent = 'Aucun cours disponible pour cette valeur.'
        return
      }

      const currencyCode = currency || instrument.currency || ''
      const priceFormat = new Intl.NumberFormat('fr-FR', /^[A-Z]{3}$/.test(currencyCode)
        ? { style: 'currency', currency: currencyCode, currencyDisplay: 'code', maximumFractionDigits: 4 }
        : { maximumFractionDigits: 4 })
      const latest = points.at(-1)
      const previous = points.at(-2)
      const variation = previous?.close ? (latest.close - previous.close) / previous.close : null
      detail.innerHTML = `
        <p class="market-message">${escapeHTML(instrument.symbol)} · ${escapeHTML(instrument.exchange)} · ${escapeHTML(instrument.type)}</p>
        <p class="market-price">${priceFormat.format(latest.close)}</p>
        <p class="market-variation ${variation < 0 ? 'market-loss' : 'market-gain'}">
          ${variation === null ? 'Variation indisponible' : `${percentFormat.format(variation)} depuis la séance précédente`}
        </p>
        <p class="market-message">Dernier cours journalier disponible · ${formatDay(latest.date)}</p>
        <div class="market-chart"><canvas role="img" aria-label="Historique des cours du ${formatDay(points[0].date)} au ${formatDay(latest.date)}"></canvas></div>
      `
      const { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } = await import('chart.js')
      if (!page.isConnected || currentRequest !== requestNumber) return
      Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip)
      const styles = getComputedStyle(page)
      chart = new Chart(detail.querySelector('canvas'), {
        type: 'line',
        data: {
          labels: points.map(({ date }) => formatDay(date)),
          datasets: [{
            data: points.map(({ close }) => close),
            borderColor: styles.getPropertyValue('--accent-primary').trim(),
            pointRadius: points.length === 1 ? 4 : 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          animation: false,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'nearest' },
          scales: { x: { ticks: { maxTicksLimit: 5 } } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ({ raw }) => priceFormat.format(raw) } }
          }
        }
      })
    } catch (error) {
      if (page.isConnected && currentRequest === requestNumber) detail.textContent = error.message
    } finally {
      if (currentRequest === requestNumber) refresh.disabled = false
    }
  }

  favoriteButton.addEventListener('click', () => {
    const id = instrumentId(selected)
    const next = favorites.some((item) => instrumentId(item) === id)
      ? favorites.filter((item) => instrumentId(item) !== id)
      : [...favorites, selected]
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      favorites = next
      renderFavorites()
      updateFavoriteButton()
    } catch {
      favoriteStatus.textContent = 'Impossible d’enregistrer les favoris sur cet appareil.'
    }
  })

  refresh.addEventListener('click', () => void selectInstrument(selected))
  positionButton.addEventListener('click', () => portfolio.edit(selected))

  function updatePositionButton() {
    if (selected) positionButton.textContent = portfolio.has(selected) ? 'Modifier la position' : 'Ajouter au portefeuille'
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!configured || submit.disabled || !input.value.trim()) return
    submit.disabled = true
    results.replaceChildren()
    searchStatus.textContent = 'Recherche en cours…'
    try {
      const result = await api.search(input.value.trim())
      if (result.error) throw new Error(result.error)
      renderInstruments(results, result.data)
      searchStatus.textContent = result.data.length
        ? `${result.data.length} résultat${result.data.length > 1 ? 's' : ''} affiché${result.data.length > 1 ? 's' : ''}`
        : 'Aucune action ni aucun ETF trouvé.'
    } catch (error) {
      searchStatus.textContent = error.message
    } finally {
      submit.disabled = false
    }
  })

  renderFavorites()
  function updateAccess(available) {
    configured = Boolean(available)
    input.disabled = submit.disabled = !configured
    searchStatus.textContent = configured
      ? ''
      : 'Enregistrez votre clé Twelve Data pour activer la recherche.'
    if (favorites.length && !selected && page.isConnected) void selectInstrument(favorites[0])
    else if (selected && configured && page.isConnected) void selectInstrument(selected)
  }

  keyForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const saveButton = keyForm.querySelector('button')
    const keyInput = keyForm.querySelector('input')
    saveButton.disabled = true
    try {
      const result = await api.saveKey(keyInput.value)
      if (result.error) throw new Error(result.error)
      keyForm.reset()
      keyStatus.textContent = 'Clé enregistrée dans le stockage chiffré de MonBudget.'
      updateAccess(true)
    } catch (error) {
      keyStatus.textContent = error.message
    } finally {
      saveButton.disabled = false
    }
  })

  Promise.resolve(api?.isConfigured()).then((available) => {
    updateAccess(available)
    if (!available) page.querySelector('.market-settings').open = true
  }).catch(() => {
    searchStatus.textContent = 'La connexion au service Bourse est indisponible.'
  })
}
