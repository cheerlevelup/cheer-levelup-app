'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface PageMeta {
  title: string
  backHref?: string
  backLabel?: string
  // Strona pozwala zwinąć boczne menu (np. trening live — więcej miejsca na siatkę)
  sidebarCollapsible?: boolean
}

interface PageMetaContextValue {
  meta: PageMeta | null
  setMeta: (meta: PageMeta | null) => void
  // Stan zwinięcia bocznego menu — trzymany tu (nie w samej stronie), żeby
  // zarówno CoachShell (układ), jak i strona (własny przycisk przełącznika)
  // mogły go czytać i zmieniać.
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null)

export function PageMetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  return (
    <PageMetaContext.Provider value={{ meta, setMeta, sidebarCollapsed, setSidebarCollapsed }}>
      {children}
    </PageMetaContext.Provider>
  )
}

export function usePageMeta() {
  const ctx = useContext(PageMetaContext)
  if (!ctx) throw new Error('usePageMeta must be used within PageMetaProvider')
  return ctx
}

// Renderowany na początku strony klienckiej, żeby ustawić tytuł/przycisk "wstecz" w TopBar
// bez przekazywania propsów przez server-side page.tsx.
export function SetPageMeta({ title, backHref, backLabel, sidebarCollapsible }: PageMeta) {
  const { setMeta } = usePageMeta()
  useEffect(() => {
    setMeta({ title, backHref, backLabel, sidebarCollapsible })
    return () => setMeta(null)
  }, [title, backHref, backLabel, sidebarCollapsible, setMeta])
  return null
}
