// src/middleware.ts 
// Protège /partenaires/dashboard — redirige vers /partenaires/login si non connecté

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

export async function middleware(req: NextRequest) {
  const res      = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  // Pages protégées
  if (req.nextUrl.pathname.startsWith('/partenaires/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/partenaires/login', req.url))
    }
  }

  // Rediriger vers dashboard si déjà connecté et sur /login
  if (req.nextUrl.pathname === '/partenaires/login' && session) {
    return NextResponse.redirect(new URL('/partenaires/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/partenaires/dashboard/:path*', '/partenaires/login'],
}
