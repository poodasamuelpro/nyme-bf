// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ROUTE = '/admin-x9k2m'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Synchronise le cookie de session Supabase dans la réponse.
  // OBLIGATOIRE pour que le refresh token fonctionne côté serveur.
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname

  // ── Protection dashboard partenaire ──────────────────────────
  if (path.startsWith('/partenaires/dashboard')) {
    if (!session) {
      // ✅ Pas de ?redirect dans l'URL pour éviter les boucles
      return NextResponse.redirect(new URL('/partenaires/login', req.url))
    }
    return res
  }

  // ── Protection dashboard admin ───────────────────────────────
  if (path.startsWith(`${ADMIN_ROUTE}/dashboard`)) {
    if (!session) {
      return NextResponse.redirect(new URL(`${ADMIN_ROUTE}/login`, req.url))
    }
    return res
  }

  // ✅ IMPORTANT : on ne redirige PAS depuis les pages /login même si session présente.
  // Raison : la page login vérifie elle-même la session dans un useEffect et fait
  // window.location.href → dashboard. Si le middleware redirige aussi → boucle infinie :
  //   middleware voit session → redirect dashboard
  //   → middleware dashboard voit session → OK passe
  //   mais si un cookie mal timé : dashboard → redirect login → middleware login
  //   → redirect dashboard → boucle.
  // Solution : laisser les pages /login gérer leur propre redirection post-session.

  return res
}

export const config = {
  matcher: [
    '/partenaires/dashboard/:path*',
    '/partenaires/login',
    '/admin-x9k2m/dashboard/:path*',
    '/admin-x9k2m/login',
  ],
}
