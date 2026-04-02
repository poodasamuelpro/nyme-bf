// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes dans .env.local')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    // Pas de redirection email — désactiver aussi dans le dashboard Supabase :
    // Authentication → Settings → Email Auth → décocher "Confirm email"
  },
})

// ── Types harmonisés avec la base de données NYME ──────────────

export type UtilisateurRow = {
  id:           string
  nom:          string
  telephone:    string
  email:        string | null
  role:         'client' | 'coursier' | 'admin' | 'partenaire'
  avatar_url:   string | null
  whatsapp:     string | null
  est_verifie:  boolean
  note_moyenne: number
  est_actif:    boolean
  fcm_token:    string | null
  created_at:   string
  updated_at:   string
}

export type PartenaireRow = {
  id:               string
  user_id:          string
  entreprise:       string
  nom_contact:      string
  telephone:        string | null
  email_pro:        string | null
  adresse:          string | null
  plan:             'starter' | 'business' | 'enterprise'
  statut:           'actif' | 'suspendu' | 'en_attente' | 'rejete'
  livraisons_max:   number
  livraisons_mois:  number
  date_debut:       string
  date_fin:         string | null
  taux_commission:  number
  created_at:       string
  updated_at:       string
}

export type LivraisonPartenaireRow = {
  id:               string
  partenaire_id:    string
  adresse_depart:   string
  adresse_arrivee:  string
  lat_depart:       number | null
  lng_depart:       number | null
  lat_arrivee:      number | null
  lng_arrivee:      number | null
  destinataire_nom: string | null
  destinataire_tel: string | null
  instructions:     string | null
  statut:           'en_attente' | 'en_cours' | 'livre' | 'annule'
  prix:             number | null
  commission:       number | null
  coursier_id:      string | null
  livraison_app_id: string | null
  created_at:       string
  updated_at:       string
}

// ── Helper : récupérer le partenaire de l'utilisateur connecté ──
export async function getPartenaire(userId: string): Promise<PartenaireRow | null> {
  const { data, error } = await supabase
    .from('partenaires')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[Supabase] getPartenaire:', error.message)
    return null
  }
  return data
}

// ── Helper : récupérer les livraisons d'un partenaire ──────────
export async function getLivraisonsPartenaire(
  partenaireId: string,
  limit = 50
): Promise<LivraisonPartenaireRow[]> {
  const { data, error } = await supabase
    .from('livraisons_partenaire')
    .select('*')
    .eq('partenaire_id', partenaireId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Supabase] getLivraisonsPartenaire:', error.message)
    return []
  }
  return data || []
}
