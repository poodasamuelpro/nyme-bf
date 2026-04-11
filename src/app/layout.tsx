// src/app/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════
// MODIFICATION : Header et Footer masqués sur les pages privées (dashboards)
//
//   - Pages publiques (/, /partenaires, /contact, /cgv, /politique*, etc.)
//     → Header + Footer affichés normalement
//
//   - Pages privées (client/*, coursier/dashboard*, admin/*, partenaires/dashboard)
//     → Header et Footer masqués — ConditionalLayout gère la logique
//
//   - ConditionalCallProvider : WebRTC actif uniquement si session auth détectée
// ═══════════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next'
import './globals.css'
import ConditionalCallProvider from '@/components/calls/ConditionalCallProvider'
import ConditionalLayout from '@/components/ConditionalLayout'
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
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-nyme-dark text-white antialiased">
        {/*
          ConditionalCallProvider : initialise WebRTC uniquement si l'utilisateur
          est connecté. Les pages publiques (/, /contact, /partenaires landing)
          ne chargent pas WebRTC inutilement.

          ConditionalLayout : affiche Header/Footer uniquement sur les pages
          publiques. Les dashboards et pages privées (client, coursier, admin,
          partenaires/dashboard) ne voient plus Header ni Footer.
        */}
        <ConditionalCallProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </ConditionalCallProvider>

        {/* Toast notifications */}
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