import { app, ipcMain, safeStorage } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const keyPath = () => join(app.getPath('userData'), 'market-key.bin')
let marketKey

function saveKey(input) {
  const key = typeof input === 'string' ? input.trim() : ''
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    throw new Error('Saisissez une clé API Twelve Data valide.')
  }
  if (!safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
    throw new Error('Le stockage chiffré est indisponible sur cet appareil.')
  }
  const path = keyPath()
  try {
    writeFileSync(`${path}.tmp`, safeStorage.encryptString(key), { mode: 0o600 })
    renameSync(`${path}.tmp`, path)
  } catch {
    throw new Error('Impossible d’enregistrer la clé sur cet appareil.')
  }
  marketKey = key
}

function loadKey() {
  try {
    marketKey = safeStorage.decryptString(readFileSync(keyPath()))
  } catch {
    marketKey = process.env.TWELVE_DATA_API_KEY?.trim()
  }
}

async function request(endpoint, parameters) {
  const apiKey = marketKey
  if (!apiKey) throw new Error('Configurez une clé Twelve Data pour accéder aux cours.')

  const url = new URL(`https://api.twelvedata.com/${endpoint}`)
  url.search = new URLSearchParams(parameters)

  let response
  let result
  try {
    response = await fetch(url, {
      headers: { Authorization: `apikey ${apiKey}` },
      redirect: 'error',
      signal: AbortSignal.timeout(12000)
    })
    result = await response.json()
  } catch {
    throw new Error('Impossible de joindre Twelve Data. Réessayez dans un instant.')
  }

  const code = Number(result?.code ?? response.status)
  if (code === 401) throw new Error('La clé Twelve Data est invalide.')
  if (code === 403) throw new Error('Votre offre Twelve Data ne donne pas accès à ces données.')
  if (code === 429) throw new Error('Le quota Twelve Data est atteint. Réessayez plus tard.')
  if (!response.ok || result?.status === 'error' || !result) {
    throw new Error('Ces données sont momentanément indisponibles chez Twelve Data.')
  }

  return result
}

async function search(query) {
  if (typeof query !== 'string' || !query.trim() || query.length > 80) {
    throw new Error('Saisissez un nom ou un symbole de 80 caractères maximum.')
  }
  const { data } = await request('symbol_search', { symbol: query.trim(), outputsize: '60' })
  return (Array.isArray(data) ? data : [])
    .filter((item) =>
      item?.symbol && item.mic_code &&
      (item.instrument_type === 'ETF' ||
        (['Common Stock', 'Preferred Stock', 'REIT'].includes(item.instrument_type) &&
          ['France', 'United States'].includes(item.country)))
    )
    .slice(0, 15)
    .map((item) => ({
      symbol: item.symbol,
      mic: item.mic_code,
      name: item.instrument_name || item.symbol,
      exchange: item.exchange || item.mic_code,
      currency: item.currency,
      type: item.instrument_type === 'ETF' ? 'ETF' : 'Action'
    }))
}

async function history({ symbol, mic } = {}) {
  if (typeof symbol !== 'string' || !/^[\p{L}\d.^_:/+ -]{1,40}$/u.test(symbol) ||
      typeof mic !== 'string' || !/^[A-Z0-9]{4}$/.test(mic)) {
    throw new Error('Ce symbole ou cette place boursière est invalide.')
  }

  const result = await request('time_series', {
    symbol,
    mic_code: mic,
    interval: '1day',
    outputsize: '90'
  })
  const points = (Array.isArray(result.values) ? result.values : [])
    .filter((value) => typeof value?.datetime === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.datetime) &&
      Number.isFinite(Date.parse(value.datetime)) &&
      value.close != null && value.close !== '' && Number.isFinite(Number(value.close)))
    .map((value) => ({ date: value.datetime, close: Number(value.close) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { points, currency: result.meta?.currency }
}

function handle(channel, action) {
  ipcMain.handle(channel, async (_event, input) => {
    try {
      return { data: await action(input) }
    } catch (error) {
      return { error: error.message }
    }
  })
}

export function registerMarketHandlers() {
  loadKey()
  ipcMain.handle('market:is-configured', () => Boolean(marketKey))
  handle('market:save-key', saveKey)
  handle('market:search', search)
  handle('market:history', history)
}
