// src/app/layout.tsx 
// ═══════════════════════════════════════════════════════════════════════════
// MODIFICATION : Ajout du CallProvider pour les appels WebRTC globaux.
// Le CallProvider écoute les appels entrants pour TOUS les utilisateurs
// connectés (client, coursier, admin) peu importe la page ouverte.
// Les modals IncomingCallModal et ActiveCallUI sont rendus ici au niveau root.
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CallProvider from '@/components/calls/CallProvider'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: {
    default: "NYME — Livraison Rapide & Intelligente en Afrique de l'Ouest",
    template: '%s | NYME',
  },
  description:
    "NYME est la plateforme de livraison à la demande conçue pour l'Afrique de l'Ouest. Rapide, sécurisée, transparente. Coursiers vérifiés, suivi GPS en temps réel, paiement Mobile Money.",
  keywords: ['livraison', 'Burkina Faso', 'Ouagadougou', "Afrique de l'Ouest", 'coursier', 'colis', 'Mobile Money', 'Orange Money', 'NYME'],
  authors: [{ name: 'NYME' }],
  creator: 'NYME',
  publisher: 'NYME',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://nyme.app',
    siteName: 'NYME',
    title: 'NYME — Livraison Rapide & Intelligente',
    description: "La plateforme de livraison à la demande conçue pour l'Afrique de l'Ouest.",
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'NYME - Livraison Intelligente' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NYME — Livraison Rapide & Intelligente',
    description: "La plateforme de livraison à la demande pour l'Afrique de l'Ouest.",
    images: ['/og-image.png'],
  },
  metadataBase: new URL('https://nyme.app'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Polices NYME : Syne (titres) + Plus Jakarta Sans (corps) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-nyme-dark text-white antialiased">
        {/*
          CallProvider : gestionnaire global des appels WebRTC.
          - Écoute les appels entrants via Supabase Realtime pour l'utilisateur connecté.
          - Affiche IncomingCallModal en superposition quand un appel arrive.
          - Affiche ActiveCallUI en superposition pendant un appel actif.
          - Accessible via le hook useCall() dans n'importe quel composant.
        */}
        <CallProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </CallProvider>

        {/* Toast notifications — positionnées en dehors du CallProvider pour éviter les conflits z-index */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
            },
          }}
        />
      </body>
    </html>
  )
}