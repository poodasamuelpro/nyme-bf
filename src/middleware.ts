// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROUTE = '/admin-x9k2m'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // ✅ FIX CRITIQUE : createMiddlewareClient lit ET rafraîchit le cookie de session.
  // Sans l'appel à getSession() ici, le cookie posé par signInWithPassword côté
  // client n'est pas propagé dans la réponse → toutes les navigations suivantes
  // voient session=null → boucle de redirection vers /login.
  // Il FAUT appeler getSession() pour que le middleware synchronise le cookie.
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname

  // ── Protection dashboard partenaire ──────────────────────────
  if (path.startsWith('/partenaires/dashboard')) {
    if (!session) {
      const url = new URL('/partenaires/login', req.url)
      url.searchParams.set('redirect', path)
      return NextResponse.redirect(url)
    }
    // ✅ Retourner `res` (et non NextResponse.next()) pour conserver les Set-Cookie
    // que createMiddlewareClient a potentiellement ajoutés (refresh token, etc.)
    return res
  }

  // ── Redirection si déjà connecté (partenaire) ────────────────
  if (path === '/partenaires/login' && session) {
    return NextResponse.redirect(new URL('/partenaires/dashboard', req.url))
  }

  // ── Protection dashboard admin ───────────────────────────────
  if (path.startsWith(`${ADMIN_ROUTE}/dashboard`)) {
    if (!session) {
      return NextResponse.redirect(new URL(`${ADMIN_ROUTE}/login`, req.url))
    }
    // ✅ Retourner `res` pour conserver les cookies
    return res
  }

  // ── Redirection si déjà connecté (admin) ─────────────────────
  if (path === `${ADMIN_ROUTE}/login` && session) {
    return NextResponse.redirect(new URL(`${ADMIN_ROUTE}/dashboard`, req.url))
  }

  return res
}

export const config = {
  // ✅ Matcher ciblé uniquement sur les routes protégées.
  // Ne PAS inclure les routes /api/* — le middleware n'a rien à faire là-bas
  // et appeler getSession() sur chaque requête API ajouterait une latence inutile.
  matcher: [
    '/partenaires/dashboard/:path*',
    '/partenaires/login',
    '/admin-x9k2m/dashboard/:path*',
    '/admin-x9k2m/login',
  ],
}
