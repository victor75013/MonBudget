// ===========================
// MonBudget — Main App
// ===========================

import '../assets/styles/base.css'
import '../assets/styles/components.css'
import '../assets/styles/pages.css'

import { router } from './utils/router.js'
import { getSession, onAuthStateChange } from './api/supabase.js'
import { renderNavbar, updateActiveNav } from './components/navbar.js'
import { toast } from './components/toast.js'

// Import pages
import { renderAuth } from './pages/auth.js'
import { renderHome } from './pages/home.js'
import { renderExpenses } from './pages/expenses.js'
import { renderBudgets } from './pages/budgets.js'
import { renderStats } from './pages/stats.js'
import { renderProfile } from './pages/profile.js'

// App state
let currentUser = null
let navbarContainer = null
let contentContainer = null

async function init() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div id="navbar-container"></div>
    <main class="main-content" id="content"></main>
  `

  navbarContainer = document.getElementById('navbar-container')
  contentContainer = document.getElementById('content')

  // Check auth state
  const session = await getSession()
  currentUser = session?.user || null

  // Auth state change listener
  onAuthStateChange((event, session) => {
    currentUser = session?.user || null
    if (event === 'SIGNED_IN') {
      renderNavbar(navbarContainer, currentUser)
      if (router.getCurrentPath() === '/auth') {
        router.navigate('/')
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null
      navbarContainer.innerHTML = ''
      router.navigate('/auth')
    }
  })

  // Setup routes
  router
    .on('/', async () => {
      updateActiveNav()
      await renderHome(contentContainer, currentUser)
    })
    .on('/auth', async () => {
      navbarContainer.innerHTML = ''
      await renderAuth(contentContainer)
    })
    .on('/expenses', async () => {
      updateActiveNav()
      await renderExpenses(contentContainer, currentUser)
    })
    .on('/budgets', async () => {
      updateActiveNav()
      await renderBudgets(contentContainer, currentUser)
    })
    .on('/stats', async () => {
      updateActiveNav()
      await renderStats(contentContainer, currentUser)
    })
    .on('/profile', async () => {
      updateActiveNav()
      await renderProfile(contentContainer, currentUser)
    })
    .guard(async (route) => {
      // Auth page is always accessible
      if (route === '/auth') return true

      // All other routes require auth
      if (!currentUser) {
        toast.info('Connectez-vous pour accéder à cette page')
        router.navigate('/auth')
        return false
      }

      // Show navbar for non-auth routes
      if (navbarContainer.innerHTML === '') {
        renderNavbar(navbarContainer, currentUser)
      }

      return true
    })

  // Initial render
  if (currentUser) {
    renderNavbar(navbarContainer, currentUser)
  }

  // Start router
  router.start()

  // If no hash, navigate to home or auth
  if (!window.location.hash) {
    router.navigate(currentUser ? '/' : '/auth')
  }
}

init().catch((err) => {
  console.error('App init error:', err)
})
