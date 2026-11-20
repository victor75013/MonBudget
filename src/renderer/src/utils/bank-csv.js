const normalize = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')

export function parseBankCsv(text) {
  const candidates = [';', ',', '\t'].map((separator) => {
    try {
      const rows = readRows(text.replace(/^\uFEFF/, ''), separator)
      const width = rows[0]?.length || 0
      const mapped = Object.values(detectBankColumns(rows[0] || [])).filter((index) => index >= 0).length
      const sample = rows.slice(1, 21)
      const consistency = sample.filter((row) => row.length === width).length / (sample.length || 1)
      return { rows, score: width >= 3 ? mapped * 2 + consistency : -1 }
    } catch {
      return { rows: [], score: -1 }
    }
  })
  candidates.sort((a, b) => b.score - a.score)
  const [headers, ...rows] = candidates[0].rows
  if (!headers || headers.length < 3 || !rows.length) {
    throw new Error('Le CSV doit contenir une ligne d’en-têtes et au moins une opération.')
  }
  if (rows.length > 2000) throw new Error('Le relevé dépasse 2 000 lignes. Découpez-le en plusieurs fichiers.')
  return { headers, rows }
}

function readRows(text, separator) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  let closed = false
  const endCell = () => {
    row.push(cell.trim())
    cell = ''
    closed = false
  }
  const endRow = () => {
    endCell()
    if (row.some(Boolean)) rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character !== '"') cell += character
      else if (text[index + 1] === '"') {
        cell += '"'
        index++
      } else {
        quoted = false
        closed = true
      }
    } else if (character === separator) endCell()
    else if (character === '\r' || character === '\n') {
      endRow()
      if (character === '\r' && text[index + 1] === '\n') index++
    } else if (character === '"' && !cell.trim() && !closed) quoted = true
    else if (!closed || character === ' ') cell += character
    else throw new Error('Champ CSV invalide.')
  }
  if (quoted) throw new Error('Champ CSV non fermé.')
  endRow()
  return rows
}

export function detectBankColumns(headers) {
  const names = headers.map(normalize)
  const match = (...patterns) => names.findIndex((name) => patterns.some((pattern) => pattern.test(name)))
  return {
    date: match(/^date$/, /^date d.?operation/, /^date (de |comptable|operation|transaction)/, /^booking date$/, /^transaction date$/),
    description: match(/^libelle/, /^description/, /^intitule/, /^operation$/, /^details$/, /^payee$/, /^tiers$/),
    amount: match(/^montant(?:$|\s|\()/, /^amount(?:$|\s|\()/),
    debit: match(/^debit(?:$|\s|\()/, /^withdrawal/),
    credit: match(/^credit(?:$|\s|\()/, /^deposit/)
  }
}

function parseDate(value) {
  const iso = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(value)
  const french = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value)
  const parts = iso ? iso.slice(1) : french ? [french[3], french[2], french[1]] : null
  if (!parts) return null
  const date = parts.map((part) => part.padStart(2, '0')).join('-')
  const timestamp = Date.parse(date)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date ? date : null
}

function parseAmount(value) {
  let amount = value.replace(/[\s€]/gu, '').replace(/EUR$/i, '').replace(/^−/, '-')
  if (!amount) return 0
  if (/^\(.*\)$/.test(amount)) amount = '-' + amount.slice(1, -1)
  if (/^[-+]?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(amount)) amount = amount.replaceAll('.', '')
  if (/^[-+]?\d{1,3}(,\d{3})+\.\d{1,2}$/.test(amount)) amount = amount.replaceAll(',', '')
  if (!/^[-+]?\d+(?:[.,]\d{1,2})?$/.test(amount)) return NaN
  return Number(amount.replace(',', '.'))
}

export function mapBankRow(row, columns) {
  const date = parseDate(row[columns.date] || '')
  const description = (row[columns.description] || '').replace(/\s+/g, ' ').trim()
  let amount
  if (columns.amount >= 0) amount = parseAmount(row[columns.amount] || '')
  else {
    const debit = parseAmount(row[columns.debit] || '')
    const credit = parseAmount(row[columns.credit] || '')
    if (debit && credit) return null
    amount = Math.abs(credit) - Math.abs(debit)
  }
  if (!date || !description || !Number.isFinite(amount) || !amount) return null
  return { date, description, amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income' }
}

export const bankRuleKey = ({ type, description }) => JSON.stringify([type, normalize(description)])
export const bankFingerprint = (entry) => JSON.stringify([entry.date, bankRuleKey(entry), Number(entry.amount).toFixed(2)])
