// ===========================
// MonBudget — Navbar Component
// ===========================

import { router } from '../utils/router.js'
import { signOut } from '../api/supabase.js'

export function renderNavbar(container, user) {
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'U'
  const initial = username.charAt(0).toUpperCase()

  container.innerHTML = `
    <nav class="navbar" id="main-navbar">
      <a class="navbar-brand" data-nav="/">
        <span>Mon<span class="brand-accent">Budget</span></span>
      </a>

      <div class="navbar-nav">
        <a class="nav-link" data-nav="/" data-route="/">Accueil</a>
        <a class="nav-link" data-nav="/expenses" data-route="/expenses">Dépenses</a>
        <a class="nav-link" data-nav="/incomes" data-route="/incomes">Revenus</a>
        <a class="nav-link" data-nav="/budgets" data-route="/budgets">Budgets</a>
        <a class="nav-link" data-nav="/stats" data-route="/stats">Stats</a>
      </div>

      <div class="navbar-actions">
        <div class="dropdown">
          <div class="navbar-avatar" id="navbar-avatar-el" title="${username}">${initial}</div>
          <div class="dropdown-menu" id="user-dropdown">
            <div class="dropdown-item" data-nav="/profile">Mon profil</div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item danger" id="logout-btn">Déconnexion</div>
          </div>
        </div>
      </div>
    </nav>
  `

  // Navigation links
  container.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      router.navigate(el.dataset.nav)
    })
  })

  updateActiveNav()

  // Avatar dropdown
  const avatarEl = document.getElementById('navbar-avatar-el')
  const dropdown = document.getElementById('user-dropdown')

  avatarEl.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('show')
  })

  document.addEventListener('click', () => {
    dropdown.classList.remove('show')
  })

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut()
    router.navigate('/auth')
  })
}

export function updateActiveNav() {
  const currentPath = router.getCurrentPath().split('?')[0]
  document.querySelectorAll('.nav-link').forEach((link) => {
    const route = link.dataset.route
    if (route === '/' && currentPath === '/') {
      link.classList.add('active')
    } else if (route !== '/' && currentPath.startsWith(route)) {
      link.classList.add('active')
    } else {
      link.classList.remove('active')
    }
  })
}
