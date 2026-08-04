(() => {
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
    } catch { /* La salle continue sans Service Worker si le navigateur le refuse. */ }
  }

  function loadCurrentTarget() {
    window.NOCTIA_ALPHA_URL = ''
    return fetch(`config.js?update=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => response.ok ? response.text() : '')
      .then((source) => {
        const match = source.match(/^window\.NOCTIA_ALPHA_URL\s*=\s*("(?:[^"\\]|\\.)*")\s*;?\s*$/)
        return match ? JSON.parse(match[1]) : ''
      })
      .catch(() => '')
  }

  function schedule() { if (!stopped) window.setTimeout(check, delay) }

  async function check() {
    if (stopped) return
    const target = await loadCurrentTarget()
    if (!valid(target)) return schedule()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4_000)
    try {
      const response = await fetch(`${target.replace(/\/$/, '')}/health?waiting-room=${Date.now()}`, { cache: 'no-store', credentials: 'omit', mode: 'cors', signal: controller.signal })
      const payload = response.ok ? await response.json() : undefined
      if (payload?.status === 'ok') {
        stopped = true
        window.clearTimeout(timeout)
        window.location.replace(target)
        return
      }
    } catch { /* Une nouvelle tentative chargera de nouveau config.js. */ }
    window.clearTimeout(timeout)
    schedule()
  }

  void installFreshnessWorker()
  void check()
})()
