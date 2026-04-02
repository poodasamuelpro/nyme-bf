import type { Metadata } from 'next'
import PartenairesClient from './PartenairesClient'

export const metadata: Metadata = {
  title: 'Espace Partenaires — NYME',
  description: 'Abonnement mensuel NYME pour entreprises et particuliers. Livreur dédié quotidien, traçabilité complète, livraison express garantie.',
}

export default function PartenairesPage() {
  return <PartenairesClient />
}