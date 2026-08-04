(() => {
  console.info('[Noctia Pages] 1. Début du script')

  function logException(context, error) {
    console.info(`[Noctia Pages] Exception — ${context}`, error, error?.stack)
  }

  window.addEventListener?.('error', (event) => {
    console.info('[Noctia Pages] Exception globale', event.error, event.error?.stack, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener?.('unhandledrejection', (event) => {
    console.info('[Noctia Pages] Promesse rejetée non gérée', event.reason, event.reason?.stack)
  })

  const delay = 5_000
  const providerHosts = ['.trycloudflare.com', '.pinggy.link', '.loca.lt']
  let stopped = false

  function valid(value) {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && providerHosts.some((suffix) => url.hostname.endsWith(suffix))
    } catch { return false }
  }

  async function installFreshnessWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    try {
      const workerUrl = new URL('./sw.js', window.location.href).href
      for (const existing of await navigator.serviceWorker.getRegistrations()) {
        const activeUrl = existing.active?.scriptURL || existing.waiting?.scriptURL || existing.installing?.scriptURL
        if (activeUrl && activeUrl !== workerUrl && window.location.href.startsWith(existing.scope)) await existing.unregister()
      }
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      await registration.update()
    } catch (error) {
      logException('installation ou mise à jour du Service Worker', error)
      /* La salle continue sans Service Worker si le navigateur le refuse. */
    }
  }

  function loadCurrentTarget() {
    console.info('[Noctia Pages] 2. Début du chargement de config.js')
    window.NOCTIA_ALPHA_URL = ''
    return fetch(`config.js?update=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => {
        console.info('[Noctia Pages] 2. Réponse de config.js reçue', { status: response.status, ok: response.ok, url: response.url })
        return response.ok ? response.text() : ''
      })
      .then((source) => {
        const match = source.match(/^window\.NOCTIA_ALPHA_URL\s*=\s*("(?:[^"\\]|\\.)*")\s*;?\s*$/)
        const target = match ? JSON.parse(match[1]) : ''
        console.info('[Noctia Pages] 3. URL extraite', { target, source })
        return target
      })
      .catch((error) => {
        logException('chargement ou analyse de config.js', error)
        return ''
      })
  }

  function schedule() { if (!stopped) window.setTimeout(check, delay) }

  async function check() {
    if (stopped) return
    const target = await loadCurrentTarget()
    const targetIsValid = valid(target)
    console.info('[Noctia Pages] 4. Validation de l’URL', { target, valid: targetIsValid })
    if (!targetIsValid) return schedule()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4_000)
    try {
      const healthUrl = `${target.replace(/\/$/, '')}/health?waiting-room=${Date.now()}`
      console.info('[Noctia Pages] 5. Début du fetch /health', { healthUrl })
      const response = await fetch(healthUrl, { cache: 'no-store', credentials: 'omit', mode: 'cors', signal: controller.signal })
      console.info('[Noctia Pages] 6. Réponse HTTP /health reçue', { status: response.status, ok: response.ok, url: response.url, type: response.type })
      const payload = response.ok ? await response.json() : undefined
      console.info('[Noctia Pages] 7. JSON /health reçu', { payload })
      if (payload?.status === 'ok') {
        console.info('[Noctia Pages] 8. Décision de redirection', { redirect: true, target })
        stopped = true
        window.clearTimeout(timeout)
        console.info('[Noctia Pages] 9. Appel à window.location.replace()', { target })
        window.location.replace(target)
        console.info('[Noctia Pages] 9. Retour de window.location.replace()', { target })
        return
      }
      console.info('[Noctia Pages] 8. Décision de redirection', { redirect: false, target, payload })
    } catch (error) {
      logException('vérification de /health ou redirection', error)
      /* Une nouvelle tentative chargera de nouveau config.js. */
    }
    window.clearTimeout(timeout)
    schedule()
  }

  void installFreshnessWorker()
  void check()
})()
