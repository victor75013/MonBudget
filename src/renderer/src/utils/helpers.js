// ===========================
// MonBudget — Helpers
// ===========================

// ── Currency formatting ──
export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// ── Date formatting ──
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  })
}

export function formatMonthYear(month, year) {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function getMonthName(month, year) {
  const date = new Date(year, month - 1, 1)
  const name = date.toLocaleDateString('fr-FR', { month: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getCurrentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function todayISO() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

// ── Category helpers ──
export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Alimentation', emoji: '🛒', color: '#ff7675', bg: 'rgba(255, 118, 117, 0.15)' },
  { id: 'transport', label: 'Transport', emoji: '⛽', color: '#74b9ff', bg: 'rgba(116, 185, 255, 0.15)' },
  { id: 'housing', label: 'Logement', emoji: '🏠', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' },
  { id: 'health', label: 'Santé', emoji: '🩺', color: '#ff7675', bg: 'rgba(255, 118, 117, 0.15)' },
  { id: 'leisure', label: 'Loisirs', emoji: '🎬', color: '#fd79a8', bg: 'rgba(253, 121, 168, 0.15)' },
  { id: 'clothing', label: 'Vêtements', emoji: '👕', color: '#e17055', bg: 'rgba(225, 112, 85, 0.15)' },
  { id: 'bills', label: 'Factures', emoji: '📄', color: '#00cec9', bg: 'rgba(0, 206, 201, 0.15)' },
  { id: 'other_expense', label: 'Autres', emoji: '🏷️', color: '#b2bec3', bg: 'rgba(178, 190, 195, 0.15)' }
]

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salaire', emoji: '💼', color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
  { id: 'freelance', label: 'Freelance', emoji: '💻', color: '#0984e3', bg: 'rgba(9, 132, 227, 0.15)' },
  { id: 'investments', label: 'Investissements', emoji: '📈', color: '#6c5ce7', bg: 'rgba(108, 92, 231, 0.15)' },
  { id: 'gifts', label: 'Cadeaux / Ventes', emoji: '🎁', color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.15)' },
  { id: 'allowance', label: 'Aides / Allocations', emoji: '🏛️', color: '#e84393', bg: 'rgba(232, 67, 147, 0.15)' },
  { id: 'other_income', label: 'Autre revenu', emoji: '🏷️', color: '#55efc4', bg: 'rgba(85, 239, 196, 0.15)' }
]

export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

export function getCategoriesByType(type = 'expense') {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function getCategoryById(id, type = 'expense') {
  const found = CATEGORIES.find((c) => c.id === id)
  if (found) return found
  const list = getCategoriesByType(type)
  return list[list.length - 1]
}

export function getCategoryLabel(id, type = 'expense') {
  return getCategoryById(id, type).label
}

export function getCategoryColor(id, type = 'expense') {
  return getCategoryById(id, type).color
}

// ── Utils ──
export function debounce(fn, delay = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

export function truncate(text, maxLength = 200) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}

export function escapeHTML(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function groupBy(arr, keyFn) {
  return arr.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}

// ── Export CSV ──
export function exportToCSV(expenses, currency = 'EUR') {
  const header = ['Date', 'Description', 'Catégorie', 'Montant', 'Note']
  const rows = expenses.map((e) => [
    e.date,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    getCategoryLabel(e.category),
    e.amount,
    `"${(e.note || '').replace(/"/g, '""')}"`
  ])

  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `monbudget_export_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Emoji Detection & Mapping ──
export const CATEGORY_EMOJIS = {
  housing: '🏠',
  food: '🛒',
  transport: '⛽',
  health: '🩺',
  leisure: '🎬',
  clothing: '👕',
  bills: '📄',
  other_expense: '🏷️',

  salary: '💼',
  freelance: '💻',
  investments: '📈',
  gifts: '🎁',
  allowance: '🏛️',
  other_income: '🏷️'
}

export const EMOJI_MAP = {
  electricite: '⚡',
  edf: '⚡',
  energie: '⚡',
  eau: '💧',
  internet: '📶',
  wifi: '📶',
  loyer: '🏠',
  maison: '🏠',
  appartement: '🏢',
  travaux: '🛠️',

  courses: '🛒',
  supermarche: '🛒',
  carrefour: '🛒',
  leclerc: '🛒',
  auchan: '🛒',
  lidl: '🛒',
  restaurant: '🍕',
  resto: '🍕',
  uber: '🍔',
  fastfood: '🍔',
  mcdonalds: '🍔',
  boulangerie: '🥖',
  cafe: '☕',

  essence: '⛽',
  carburant: '⛽',
  total: '⛽',
  voiture: '🚗',
  parking: '🅿️',
  peage: '🛣️',
  train: '🚆',
  sncf: '🚆',
  navigo: '🚌',
  bus: '🚌',
  avion: '✈️',

  pharmacie: '💊',
  medecin: '🩺',
  doctolib: '🩺',
  dentiste: '🦷',
  mutuelle: '🏥',

  cinema: '🎬',
  netflix: '🍿',
  spotify: '🎵',
  gaming: '🎮',
  ps5: '🎮',
  sport: '🏋️',
  salle: '🏋️',
  voyage: '🧳',

  zara: '👕',
  vetements: '👕',
  chaussures: '👟',

  salaire: '💼',
  paye: '💼',
  freelance: '💻',
  client: '💻',
  virement: '💸',
  bourse: '📈',
  crypto: '🪙',
  vente: '🎁',
  vinted: '👗',
  allocation: '🏛️',
  caf: '🏛️'
}

export function detectEmoji(description = '', categoryId = '') {
  const text = (description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [kw, emoji] of Object.entries(EMOJI_MAP)) {
    if (text.includes(kw)) {
      return emoji
    }
  }
  return CATEGORY_EMOJIS[categoryId] || '🏷️'
}
