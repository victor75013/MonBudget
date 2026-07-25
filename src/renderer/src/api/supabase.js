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
    if (!data.session && data.user) {
      // Email confirmation is still enabled in Supabase
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

  if (options.month && options.year) {
    const start = `${options.year}-${String(options.month).padStart(2, '0')}-01`
    const endMonth = options.month === 12 ? 1 : options.month + 1
    const endYear = options.month === 12 ? options.year + 1 : options.year
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
    query = query.gte('date', start).lt('date', end)
  }

  if (options.category) {
    query = query.eq('category', options.category)
  }

  if (options.search) {
    query = query.ilike('description', `%${options.search}%`)
  }

  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAllExpenses(userId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

// ── Budgets ──
export async function getBudgets(userId, month, year) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
  if (error) throw error
  return data
}

export async function setBudget(userId, category, amount, month, year) {
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
  const expenses = await getExpenses(userId, { month, year })
  const budgets = await getBudgets(userId, month, year)

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map((e) => Number(e.amount))) : 0

  // Group by category
  const byCategory = {}
  for (const e of expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = 0
    byCategory[e.category] += Number(e.amount)
  }

  // Budget usage per category
  const budgetMap = {}
  for (const b of budgets) {
    budgetMap[b.category] = Number(b.amount)
  }

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0)
  const remaining = totalBudget > 0 ? totalBudget - total : null

  return {
    expenses,
    budgets,
    total,
    maxExpense,
    byCategory,
    budgetMap,
    totalBudget,
    remaining,
    count: expenses.length
  }
}

export async function getYearlyStats(userId, year) {
  const monthlyTotals = []
  for (let m = 1; m <= 12; m++) {
    const expenses = await getExpenses(userId, { month: m, year })
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    monthlyTotals.push({ month: m, year, total, count: expenses.length })
  }
  return monthlyTotals
}
