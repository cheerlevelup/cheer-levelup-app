'use client'
// src/lib/useLiveRefresh.ts
// Odświeżanie danych z serwera „na żywo" (router.refresh co kilka sekund), gdy karta
// jest widoczna i nikt akurat nie pisze w polu — np. trening rozpoczęty przez trenera
// pojawia się zawodniczce bez przeładowania, a trener widzi ciężary wpisane przez zawodniczki.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useLiveRefresh(intervalMs = 15000, enabled = true) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    const typing = () => {
      const el = document.activeElement as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const tick = () => { if (document.visibilityState === 'visible' && !typing()) router.refresh() }
    const id = setInterval(tick, intervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [router, intervalMs, enabled])
}
