// ===========================
// MonBudget — Supabase Client & API
// ===========================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.RENDERER_VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.RENDERER_VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase env vars manquantes :', { supabaseUrl, supabaseAnonKey })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Convertit une erreur Supabase en message lisible
function formatSupabaseError(err) {
  if (!err) return 'Une erreur est survenue'
  if (typeof err === 'string') return err
  if (err.message && err.message !== '{}' && err.message !== '[object Object]') {
    return err.message
  }
  if (err.error_description) return err.error_description
  if (err.msg) return err.msg
  try {
    const str = JSON.stringify(err)
    if (str && str !== '{}') return str
  } catch (e) {
    // ignore
  }
  return 'Erreur de connexion Supabase. Vérifiez la console (F12) ou la configuration Supabase.'
}

// ── Auth Helpers ──
export async function ensureProfile(userId, username) {
  try {
    const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
    if (!data) {
      await supabase.from('profiles').upsert(
        { id: userId, username: username || 'Utilisateur' },
        { onConflict: 'id' }
      )
    }
  } catch (err) {
    console.error('ensureProfile error:', err)
  }
}

export async function signUp(email, password, username) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (error) {
      console.error('Supabase signUp error:', error)
      throw new Error(formatSupabaseError(error))
    }
    if (data?.user) {
      await ensureProfile(data.user.id, username)
    }
    if (!data.session && data.user) {
      return { ...data, requiresConfirmation: true }
    }
    return data
  } catch (err) {
    console.error('signUp caught error:', err)
    throw new Error(formatSupabaseError(err))
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('Supabase signIn error:', error)
      throw new Error(formatSupabaseError(error))
    }
    return data
  } catch (err) {
    console.error('signIn caught error:', err)
    throw new Error(formatSupabaseError(err))
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

// ── Profile ──
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Expenses ──
export async function addExpense(expense) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single()
  if (error) throw error
  return data
}

export async function updateExpense(id, updates) {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export async function getExpenses(userId, options = {}) {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (options.category) {
    query = query.eq('category', options.category)
  }

  if (options.search) {
    query = query.ilike('description', `%${options.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  // Remplir les valeurs par défaut (si type est null en BDD, c'est 'expense')
  const rawItems = (data || []).map((e) => ({
    ...e,
    type: e.type || 'expense',
    is_recurring: !!e.is_recurring
  }))

  // Filtrer strictement par type ('expense' ou 'income')
  let filteredItems = rawItems
  if (options.type && options.type !== 'all') {
    filteredItems = rawItems.filter((item) => item.type === options.type)
  }

  if (!options.month || !options.year) {
    return filteredItems
  }

  const targetYear = options.year
  const targetMonth = options.month
  const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`

  // 1. Transactions ponctuelles (is_recurring === false) du mois visualisé
  const oneTimeItems = filteredItems.filter((item) => {
    if (item.is_recurring) return false
    const monthKey = item.date ? item.date.substring(0, 7) : ''
    return monthKey === targetMonthKey
  })

  // 2. Opérations récurrentes (is_recurring === true)
  const recurringItems = filteredItems.filter((item) => item.is_recurring)

  // Grouper les récurrentes par (type + category + description)
  const recurringGroups = {}
  for (const item of recurringItems) {
    const key = `${item.type}_${item.category}_${(item.description || '').toLowerCase().trim()}`
    if (!recurringGroups[key]) recurringGroups[key] = []
    recurringGroups[key].push(item)
  }

  const activeRecurringItems = []

  for (const key in recurringGroups) {
    const group = recurringGroups[key]
    // Filtrer les versions récurrentes dont le mois de début est <= au mois visualisé
    const validVersions = group.filter((item) => {
      const startMonthKey = item.date ? item.date.substring(0, 7) : ''
      return startMonthKey <= targetMonthKey
    })

    if (validVersions.length > 0) {
      // Prendre la version récurrente la plus récente pour le mois visualisé
      validVersions.sort((a, b) => b.date.localeCompare(a.date))
      const latestVersion = validVersions[0]

      // Adapter la date virtuelle pour conserver le même jour du mois (ex: le 5 du mois)
      const origDay = latestVersion.date ? parseInt(latestVersion.date.split('-')[2], 10) || 1 : 1
      const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate()
      const dayToUse = Math.min(origDay, daysInTargetMonth)
      const virtualDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayToUse).padStart(2, '0')}`

      activeRecurringItems.push({
        ...latestVersion,
        date: virtualDate,
        original_start_date: latestVersion.date
      })
    }
  }

  let result = [...oneTimeItems, ...activeRecurringItems]
  result.sort((a, b) => b.date.localeCompare(a.date))

  if (options.limit) {
    result = result.slice(0, options.limit)
  }

  return result
}

export async function getAllExpenses(userId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data || []).map((e) => ({
    ...e,
    type: e.type || 'expense',
    is_recurring: !!e.is_recurring
  }))
}

// ── Budgets ──
export async function getBudgets(userId, month, year) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error

  const allBudgets = (data || []).map((b) => ({
    ...b,
    is_recurring: b.is_recurring !== undefined ? !!b.is_recurring : true
  }))

  const targetKey = `${year}-${String(month).padStart(2, '0')}`

  // Group by category
  const byCat = {}
  for (const b of allBudgets) {
    const key = b.category
    if (!byCat[key]) byCat[key] = []
    byCat[key].push(b)
  }

  const activeBudgets = []

  for (const catId in byCat) {
    const list = byCat[catId]

    // 1. Check for exact match in target month/year
    const exact = list.find((b) => Number(b.month) === Number(month) && Number(b.year) === Number(year))

    if (exact) {
      activeBudgets.push(exact)
    } else {
      // 2. Check for recurring budgets from prior months
      const recurring = list.filter((b) => {
        if (!b.is_recurring) return false
        const bKey = `${b.year}-${String(b.month).padStart(2, '0')}`
        return bKey <= targetKey
      })

      if (recurring.length > 0) {
        recurring.sort((a, b) => {
          const keyA = `${a.year}-${String(a.month).padStart(2, '0')}`
          const keyB = `${b.year}-${String(b.month).padStart(2, '0')}`
          return keyB.localeCompare(keyA)
        })
        activeBudgets.push({
          ...recurring[0],
          is_inherited: true
        })
      }
    }
  }

  return activeBudgets
}

export async function setBudget(userId, category, amount, month, year, is_recurring = true) {
  // Upsert with is_recurring field
  const payload = { user_id: userId, category, amount, month, year, is_recurring }

  try {
    const { data, error } = await supabase
      .from('budgets')
      .upsert(payload, { onConflict: 'user_id,category,month,year' })
      .select()
      .single()

    if (!error) return data
  } catch (e) {
    // Fallback if column does not exist yet
  }

  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, category, amount, month, year },
      { onConflict: 'user_id,category,month,year' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}

// ── Stats Helpers ──
export async function getMonthStats(userId, month, year) {
  const allItems = await getExpenses(userId, { month, year })
  const budgets = await getBudgets(userId, month, year)

  const expenses = allItems.filter((item) => (item.type || 'expense') === 'expense')
  const incomes = allItems.filter((item) => item.type === 'income')

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalIncome = incomes.reduce((sum, e) => sum + Number(e.amount), 0)
  const netBalance = totalIncome - totalExpense

  const fixedExpenses = expenses.filter((e) => e.is_recurring).reduce((sum, e) => sum + Number(e.amount), 0)
  const fixedIncome = incomes.filter((e) => e.is_recurring).reduce((sum, e) => sum + Number(e.amount), 0)

  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map((e) => Number(e.amount))) : 0

  // Group expenses by category
  const expenseByCategory = {}
  for (const e of expenses) {
    if (!expenseByCategory[e.category]) expenseByCategory[e.category] = 0
    expenseByCategory[e.category] += Number(e.amount)
  }

  // Group income by category
  const incomeByCategory = {}
  for (const i of incomes) {
    if (!incomeByCategory[i.category]) incomeByCategory[i.category] = 0
    incomeByCategory[i.category] += Number(i.amount)
  }

  // Budget usage per category
  const budgetMap = {}
  for (const b of budgets) {
    budgetMap[b.category] = Number(b.amount)
  }

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)
  const remainingBudget = totalBudget > 0 ? totalBudget - totalExpense : null

  return {
    allItems,
    expenses,
    incomes,
    totalExpense,
    totalIncome,
    netBalance,
    fixedExpenses,
    fixedIncome,
    maxExpense,
    expenseByCategory,
    incomeByCategory,
    budgetMap,
    totalBudget,
    remainingBudget,
    count: allItems.length
  }
}

export async function getYearlyStats(userId, year) {
  const monthlyTotals = []
  for (let m = 1; m <= 12; m++) {
    const items = await getExpenses(userId, { month: m, year })
    const exp = items.filter((i) => (i.type || 'expense') === 'expense').reduce((sum, e) => sum + Number(e.amount), 0)
    const inc = items.filter((i) => i.type === 'income').reduce((sum, e) => sum + Number(e.amount), 0)
    monthlyTotals.push({
      month: m,
      year,
      expense: exp,
      income: inc,
      net: inc - exp,
      count: items.length
    })
  }
  return monthlyTotals
}
