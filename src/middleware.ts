// src/middleware.ts
// Middleware: przekierowanie po zalogowaniu zależne od roli

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Nie zalogowany — tylko /login jest dostępne
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Zalogowany na /login — przekieruj do właściwego panelu
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    const isCoach = user.email === 'cheerlevelup@gmail.com'
    url.pathname = isCoach ? '/coach' : '/athlete'
    return NextResponse.redirect(url)
  }

  // Coach nie może wejść na /athlete
  if (user && pathname.startsWith('/athlete') && user.email === 'cheerlevelup@gmail.com') {
    const url = request.nextUrl.clone()
    url.pathname = '/coach'
    return NextResponse.redirect(url)
  }

  // Athlete nie może wejść na /coach
  if (user && pathname.startsWith('/coach') && user.email !== 'cheerlevelup@gmail.com') {
    const url = request.nextUrl.clone()
    url.pathname = '/athlete'
    return NextResponse.redirect(url)
  }

  // Stara ścieżka /session — przekieruj do /athlete/training
  if (user && pathname.startsWith('/session')) {
    const url = request.nextUrl.clone()
    url.pathname = '/athlete/training'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
