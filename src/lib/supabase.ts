import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!URL || !ANON) {
  throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes dans .env.local')
}

export const supabase = createClient(URL, ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
})

// ── Types alignés avec le schéma NYME ─────────────────────────────

export interface PropositionPrix {
  id: string
  livraison_id: string
  auteur_id: string
  role_auteur: 'client' | 'coursier'
  montant: number
  statut: 'en_attente' | 'accepte' | 'refuse'
  created_at: string
}

// CORRECTION : Renommé de UtilisateurRow vers Utilisateur pour matcher l'import du build
export type Utilisateur = {
  id:           string
  nom:          string | null
  telephone:    string | null
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

// AJOUT : Type Livraison manquant qui cause l'échec du build
export type Livraison = {
  id:                string
  client_id:         string
  coursier_id:       string | null
  statut:            string
  adresse_depart:    string
  adresse_arrivee:   string
  lat_depart:        number | null
  lng_depart:        number | null
  lat_arrivee:       number | null
  lng_arrivee:       number | null
  prix_calcule:      number | null
  prix_final:        number | null
  created_at:        string
  updated_at:        string
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

// ── Helpers ────────────────────────────────────────────────────────

export async function getPartenaire(userId: string): Promise<PartenaireRow | null> {
  const { data, error } = await supabase
    .from('partenaires')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) { console.error('[supabase] getPartenaire:', error.message); return null }
  return data
}

export async function getLivraisonsPartenaire(
  partenaireId: string, limit = 100
): Promise<LivraisonPartenaireRow[]> {
  const { data, error } = await supabase
    .from('livraisons_partenaire')
    .select('*')
    .eq('partenaire_id', partenaireId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[supabase] getLivraisons:', error.message); return [] }
  return data || []
}
