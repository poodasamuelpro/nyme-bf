import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!URL || !ANON) {
  throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes')
}

export const supabase = createClient(URL, ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
})

// ── 1. TABLE : utilisateurs ──────────────────────────────────────────
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

// ── 2. TABLE : livraisons ───────────────────────────────────────────
export type Livraison = {
  id:                string
  client_id:         string
  coursier_id:       string | null
  statut:            'en_attente' | 'acceptee' | 'en_route_depart' | 'colis_recupere' | 'en_route_arrivee' | 'livree' | 'annulee'
  type:              'immediate' | 'urgente' | 'programmee'
  pour_tiers:        boolean | null
  depart_adresse:    string
  depart_lat:        number 
  depart_lng:        number
  arrivee_adresse:   string
  arrivee_lat:       number
  arrivee_lng:       number
  destinataire_nom:  string
  destinataire_tel:  string
  destinataire_whatsapp: string | null
  destinataire_email:    string | null
  instructions:      string | null
  photos_colis:      string[] | null
  prix_calcule:      number
  prix_final:        number | null
  commission_nyme:   number | null
  distance_km:       number | null
  duree_estimee:     number | null
  statut_paiement:   'en_attente' | 'paye' | 'rembourse'
  mode_paiement:     'cash' | 'mobile_money' | 'carte' | null
  
  // La colonne qui manquait
  programme_le:      string | null 
  
  created_at:        string
  acceptee_at:       string | null
  recupere_at:       string | null
  livree_at:         string | null 
  annulee_at:        string | null
  annulee_par:       'client' | 'coursier' | 'admin' | null
  payment_api_reference: string | null
  payment_api_status:    'pending' | 'success' | 'failed' | null
  is_paid_to_courier:    boolean

  // Jointures pour les requêtes .select('*, coursier(...)')
  coursier?: {
    id: string
    nom: string | null
    telephone: string | null
    avatar_url: string | null
    note_moyenne: number
  }
}

// ── 3. TABLE : coursiers ────────────────────────────────────────────
export type Coursier = {
  id: string 
  statut: 'disponible' | 'en_course' | 'hors_ligne'
  statut_verification: 'en_attente' | 'verifie' | 'rejete'
  vehicule_type: string
  immatriculation: string | null
  total_courses: number
  note_moyenne: number
  lat_actuelle: number | null
  lng_actuelle: number | null
  derniere_activite: string
}

// ── 4. TABLE : partenaires ──────────────────────────────────────────
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

// ── 5. TABLE : Wallets & Transactions ───────────────────────────────
export type Wallet = {
  id: string
  user_id: string
  solde: number
  devise: string
  created_at: string
  updated_at: string
}

export type TransactionWallet = {
  id: string
  user_id: string
  montant: number
  // Ajout de 'gain' et 'bonus' pour correspondre à ton dashboard
  type: 'depot' | 'retrait' | 'gain_course' | 'commission' | 'gain' | 'bonus' | string
  statut: 'succes' | 'en_attente' | 'echec'
  note: string | null
  created_at: string
}

// ── 6. TABLE : Notifications ────────────────────────────────────────
export type Notification = {
  id: string
  user_id: string
  titre: string
  message: string
  type: string
  lu: boolean
  created_at: string
}

// ── TYPES ADDITIONNELS ──────────────────────────────────────────────
export interface PropositionPrix {
  id: string
  livraison_id: string
  auteur_id: string
  role_auteur: 'client' | 'coursier'
  montant: number
  statut: 'en_attente' | 'accepte' | 'refuse'
  created_at: string
}

// ── HELPERS ────────────────────────────────────────────────────────
export async function getUtilisateur(userId: string): Promise<Utilisateur | null> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Utilisateur
}

export async function getPartenaire(userId: string): Promise<PartenaireRow | null> {
  const { data, error } = await supabase
    .from('partenaires')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as PartenaireRow
}
