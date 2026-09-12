'use client'
import { createContext, useContext, useEffect, useState } from 'react'

interface PageMeta {
  title: string
  backHref?: string
  backLabel?: string
}

interface PageMetaContextValue {
  meta: PageMeta | null
  setMeta: (meta: PageMeta | null) => void
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null)

export function PageMetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<PageMeta | null>(null)
  return (
    <PageMetaContext.Provider value={{ meta, setMeta }}>
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
export function SetPageMeta({ title, backHref, backLabel }: PageMeta) {
  const { setMeta } = usePageMeta()
  useEffect(() => {
    setMeta({ title, backHref, backLabel })
    return () => setMeta(null)
  }, [title, backHref, backLabel, setMeta])
  return null
}
