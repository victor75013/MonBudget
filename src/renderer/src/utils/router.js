// ===========================
// MonBudget — SPA Router
// Hash-based routing (identical to SeriesBox)
// ===========================

class Router {
  constructor() {
    this.routes = {}
    this.currentRoute = null
    this.beforeEach = null
    window.addEventListener('hashchange', () => this._onHashChange())
  }

  on(path, handler) {
    this.routes[path] = handler
    return this
  }

  guard(fn) {
    this.beforeEach = fn
    return this
  }

  navigate(path) {
    window.location.hash = path
  }

  getCurrentPath() {
    return window.location.hash.slice(1) || '/'
  }

  start() {
    this._onHashChange()
  }

  async _onHashChange() {
    const content = document.getElementById('content')
    if (content) {
      content.classList.add('fade-out')
      await new Promise((resolve) => setTimeout(resolve, 120))
      content.classList.remove('fade-out')
    }

    const fullPath = this.getCurrentPath()
    const [path, queryString] = fullPath.split('?')

    const params = {}
    if (queryString) {
      new URLSearchParams(queryString).forEach((val, key) => {
        params[key] = val
      })
    }

    let matchedRoute = null
    let routeParams = {}

    for (const routePath in this.routes) {
      const match = this._matchRoute(routePath, path)
      if (match) {
        matchedRoute = routePath
        routeParams = match
        break
      }
    }

    if (!matchedRoute) {
      this.navigate('/')
      return
    }

    if (this.beforeEach) {
      const allowed = await this.beforeEach(matchedRoute, routeParams)
      if (!allowed) return
    }

    this.currentRoute = matchedRoute

    const handler = this.routes[matchedRoute]
    if (handler) {
      await handler({ ...routeParams, ...params })
    }
  }

  _matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean)
    const pathParts = path.split('/').filter(Boolean)

    if (patternParts.length !== pathParts.length) return null

    const params = {}
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
      } else if (patternParts[i] !== pathParts[i]) {
        return null
      }
    }

    return params
  }
}

export const router = new Router()
