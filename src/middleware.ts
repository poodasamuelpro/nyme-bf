// src/middleware.ts
// ✅ Middleware minimal : uniquement synchroniser les cookies Supabase.
// La protection des routes est gérée côté client dans chaque page dashboard.
// Supprimer toute logique de redirection ici évite les boucles sur Vercel.

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  // Obligatoire pour que Supabase rafraîchisse le token et pose le cookie
  await supabase.auth.getSession()
  return res
}

export const config = {
  matcher: [
    '/partenaires/:path*',
    '/admin-x9k2m/:path*',
  ],
}
