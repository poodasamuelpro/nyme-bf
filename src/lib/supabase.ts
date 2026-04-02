// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client côté navigateur (utilisé dans les composants client)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})

// Types de base
export type PartenaireRow = {
  id:             string
  user_id:        string
  entreprise:     string
  nom_contact:    string
  telephone:      string | null
  plan:           'starter' | 'business' | 'enterprise'
  statut:         'actif' | 'suspendu' | 'en_attente'
  livraisons_max: number
  livraisons_mois: number
  date_debut:     string
  date_fin:       string | null
  created_at:     string
}

export type LivraisonPartenaire = {
  id:               string
  partenaire_id:    string
  adresse_depart:   string
  adresse_arrivee:  string
  statut:           'en_attente' | 'en_cours' | 'livre' | 'annule'
  prix:             number | null
  coursier_id:      string | null
  created_at:       string
}
