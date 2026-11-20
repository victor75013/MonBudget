let startupTimer

try {
  await Promise.race([
    import('./app.js').then(({ init }) => init()),
    new Promise((_, reject) => {
      startupTimer = setTimeout(() => reject(new Error('Délai de démarrage dépassé.')), 15000)
    })
  ])
} catch (error) {
  console.error('Erreur de démarrage de MonBudget :', error)
  const app = document.getElementById('app')
  app.innerHTML = `
    <main style="margin: auto; text-align: center; padding: 24px">
      <h1>MonBudget n’a pas pu démarrer</h1>
      <p style="margin: 12px 0">Vérifiez votre connexion, puis réessayez.</p>
      <button type="button" id="retry-startup">Réessayer</button>
    </main>
  `
  app.querySelector('#retry-startup').addEventListener('click', () => location.reload())
} finally {
  clearTimeout(startupTimer)
}
