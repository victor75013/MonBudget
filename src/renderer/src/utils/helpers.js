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
  { id: 'food', label: 'Alimentation', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  { id: 'transport', label: 'Transport', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { id: 'housing', label: 'Logement', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  { id: 'health', label: 'Santé', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  { id: 'leisure', label: 'Loisirs', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
  { id: 'clothes', label: 'Vêtements', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  { id: 'bills', label: 'Factures', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  { id: 'other', label: 'Autres', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
]

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salaire', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  { id: 'freelance', label: 'Freelance', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  { id: 'investments', label: 'Investissements', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { id: 'gifts', label: 'Cadeaux / Ventes', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  { id: 'allowance', label: 'Aides / Allocations', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  { id: 'other_income', label: 'Autre revenu', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }
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
