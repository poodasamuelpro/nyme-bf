// src/middleware.ts
// ✅ Middleware fusionné : garde la synchro cookies + ajout protection par rôles
// La protection des routes est gérée côté client dans chaque page dashboard.
// Supprimer toute logique de redirection ici évite les boucles sur Vercel.

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ===== PARTIE EXISTANTE (inchangée) =====
// (gardée pour compatibilité)

// ===== NOUVELLES ROUTES PROTÉGÉES PAR RÔLE =====
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/client': ['client', 'admin'],
  '/coursier': ['coursier', 'admin'],
  '/partenaires': ['partenaire', 'admin'],
  '/admin-x9k2m': ['admin'],
}

// Routes publiques (pas de redirection)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/coursier/login',
  '/partenaires/login',
  '/admin-x9k2m/login',
  '/api/auth',
  '/api/public',
]

// ===== MIDDLEWARE PRINCIPAL (fusionné) =====
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // 1. EXISTANT : obligatoire pour que Supabase rafraîchisse le token
  const { data: { session } } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // 2. EXISTANT : routes protégées originales (partenaires et admin-x9k2m)
  // Gardé tel quel pour compatibilité
  const isOriginalProtected = pathname.startsWith('/partenaires/') || 
                               pathname.startsWith('/admin-x9k2m/')

  // 3. NOUVEAU : vérifier si la route est publique
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith('/api/'))

  if (isPublicRoute) {
    // Si connecté et sur page de login, rediriger vers dashboard
    if (session && (pathname === '/login' || pathname === '/register')) {
      const userRole = await getUserRole(supabase, session.user.id)
      return redirectToDashboard(req, userRole)
    }
    return res
  }

  // 4. NOUVEAU : vérifier si route protégée par rôle
  const protectedBase = Object.keys(PROTECTED_ROUTES).find(base =>
    pathname.startsWith(base)
  )

  if (protectedBase || isOriginalProtected) {
    // Pas de session → rediriger vers login approprié
    if (!session) {
      const base = protectedBase || (pathname.startsWith('/partenaires') ? '/partenaires' : '/admin-x9k2m')
      return redirectToLogin(req, base)
    }

    // Vérifier le rôle
    const userRole = await getUserRole(supabase, session.user.id)
    const allowedRoles = protectedBase ? PROTECTED_ROUTES[protectedBase] : 
                         (pathname.startsWith('/partenaires') ? ['partenaire', 'admin'] : ['admin'])

    if (!allowedRoles.includes(userRole)) {
      // Rôle non autorisé → rediriger vers son dashboard
      return redirectToDashboard(req, userRole)
    }
  }

  return res
}

async function getUserRole(supabase: any, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('utilisateurs')
      .select('role')
      .eq('id', userId)
      .single()
    return data?.role || 'client'
  } catch {
    return 'client'
  }
}

function redirectToLogin(req: NextRequest, protectedBase: string): NextResponse {
  let loginPath = '/login'
  if (protectedBase.startsWith('/coursier')) loginPath = '/login?role=coursier'
  if (protectedBase.startsWith('/partenaires')) loginPath = '/partenaires/login'
  if (protectedBase.startsWith('/admin')) loginPath = '/admin-x9k2m/login'

  const url = req.nextUrl.clone()
  url.pathname = loginPath.split('?')[0]
  if (loginPath.includes('?')) {
    const params = loginPath.split('?')[1]
    url.search = '?' + params
  }
  url.searchParams.set('redirect', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

function redirectToDashboard(req: NextRequest, role: string): NextResponse {
  const url = req.nextUrl.clone()
  switch (role) {
    case 'client':
      url.pathname = '/client/dashboard'
      break
    case 'coursier':
      url.pathname = '/coursier/dashboard-new'
      break
    case 'partenaire':
      url.pathname = '/partenaires/dashboard'
      break
    case 'admin':
      url.pathname = '/admin-x9k2m/dashboard'
      break
    default:
      url.pathname = '/login'
  }
  return NextResponse.redirect(url)
}

// ===== MATCHER OPTIMISÉ POUR VERCEL (pas Cloudflare) =====
export const config = {
  matcher: [
    '/partenaires/:path*',
    '/admin-x9k2m/:path*',
    '/client/:path*',
    '/coursier/:path*',
    '/login',
    '/register',
  ],
}