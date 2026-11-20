import logoUrl from '../../assets/logo.png'
import { signOut } from '../api/supabase.js'
import { escapeHTML } from '../utils/helpers.js'
import { router } from '../utils/router.js'

export const budgetSections = [
  { route: '/expenses', label: 'Dépenses', description: 'Suivre vos sorties d’argent', tone: 'peach', icon: '↗' },
  { route: '/incomes', label: 'Revenus', description: 'Suivre vos entrées d’argent', tone: 'mint', icon: '↙' },
  { route: '/budgets', label: 'Budgets', description: 'Fixer vos limites par catégorie', tone: 'lilac', icon: '◎' },
  { route: '/stats', label: 'Statistiques', description: 'Analyser l’évolution de vos finances', tone: 'blue', icon: '▥' },
  { route: '/market', label: 'Bourse', description: 'Suivre vos actions et ETF', tone: 'sand', icon: '⌁' }
]

export function renderNavbar(container, user) {
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'U'
  const initial = escapeHTML(username.charAt(0).toUpperCase())

  container.innerHTML = `
    <header class="navbar" id="main-navbar">
      <div class="navbar-inner">
        <a class="navbar-brand" href="#/" aria-label="MonBudget, accueil">
          <img src="${logoUrl}" alt="" class="navbar-logo" />
          <span>Mon<span class="brand-accent">Budget</span></span>
        </a>
        <nav class="navbar-nav" aria-label="Navigation dans MonBudget" hidden>
          <a class="nav-link" href="#/">← Accueil</a>
          <span class="navbar-section" aria-current="page"></span>
        </nav>
        <div class="navbar-actions">
          <details class="dropdown">
            <summary class="navbar-avatar" aria-label="Compte">${initial}</summary>
            <div class="dropdown-menu">
              <a class="dropdown-item" href="#/profile">Mon profil</a>
              <div class="dropdown-divider"></div>
              <button type="button" class="dropdown-item danger" id="logout-btn">Déconnexion</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  `

  const dropdown = container.querySelector('details')
  dropdown.addEventListener('focusout', (event) => {
    if (!dropdown.contains(event.relatedTarget)) dropdown.open = false
  })
  dropdown.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dropdown.open) {
      dropdown.open = false
      dropdown.querySelector('summary').focus()
    }
  })

  container.querySelector('#logout-btn').addEventListener('click', async () => {
    dropdown.open = false
    await signOut()
    router.navigate('/auth')
  })

  updateActiveNav()
}

export function updateActiveNav() {
  const navbar = document.getElementById('main-navbar')
  if (!navbar) return

  const currentPath = router.getCurrentPath().split('?')[0]
  const section = budgetSections.find(({ route }) => route === currentPath)
  const label = currentPath === '/profile' ? 'Mon profil' : section?.label
  const nav = navbar.querySelector('.navbar-nav')
  nav.hidden = !label
  nav.querySelector('.navbar-section').textContent = label || ''
  navbar.querySelector('details').open = false
}
