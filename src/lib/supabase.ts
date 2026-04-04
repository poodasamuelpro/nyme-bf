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
  nom:          string
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

// ── 2. TABLE : coursiers ─────────────────────────────────────────────
export type Coursier = {
  id:                          string
  statut:                      'hors_ligne' | 'disponible' | 'occupe'
  statut_verification:         'en_attente' | 'verifie' | 'rejete'
  cni_recto_url:               string | null
  cni_verso_url:               string | null
  permis_url:                  string | null
  total_courses:               number
  total_gains:                 number
  lat_actuelle:                number | null
  lng_actuelle:                number | null
  derniere_activite:           string | null
  created_at:                  string
  status_validation_documents: 'pending' | 'approved' | 'rejected'
  commission_due:              number
}

// ── 3. TABLE : livraisons ────────────────────────────────────────────
export type Livraison = {
  id:                    string
  client_id:             string
  coursier_id:           string | null
  statut:                'en_attente' | 'acceptee' | 'en_rout_depart' | 'colis_recupere' | 'en_route_arrivee' | 'livree' | 'annulee'
  type:                  'immediate' | 'urgente' | 'programmee'
  pour_tiers:            boolean | null
  depart_adresse:        string
  depart_lat:            number
  depart_lng:            number
  arrivee_adresse:       string
  arrivee_lat:           number
  arrivee_lng:           number
  destinataire_nom:      string
  destinataire_tel:      string
  destinataire_whatsapp: string | null
  destinataire_email:    string | null
  instructions:          string | null
  photos_colis:          string[] | null
  prix_calcule:          number
  prix_final:            number | null
  commission_nyme:       number | null
  distance_km:           number | null
  duree_estimee:         number | null
  statut_paiement:       'en_attente' | 'paye' | 'rembourse'
  mode_paiement:         'cash' | 'mobile_money' | 'carte' | null
  programme_le:          string | null
  created_at:            string
  acceptee_at:           string | null
  recupero_at:           string | null
  livree_at:             string | null
  annulee_at:            string | null
  annulee_par:           'client' | 'coursier' | 'admin' | null
  payment_api_reference: string | null
  payment_api_status:    'pending' | 'success' | 'failed' | null
  is_paid_to_courier:    boolean

  // Jointure optionnelle
  coursier?: {
    id:           string
    nom:          string | null
    telephone:    string | null
    avatar_url:   string | null
    note_moyenne: number
  }
}

// ── 4. TABLE : livraisons_partenaire ─────────────────────────────────
export type LivraisonPartenaire = {
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

// ── 5. TABLE : partenaires ───────────────────────────────────────────
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

// ── 6. TABLE : wallets ───────────────────────────────────────────────
export type Wallet = {
  id:             string
  user_id:        string
  solde:          number
  total_gains:    number
  total_retraits: number
  created_at:     string
  updated_at:     string
}

// ── 7. TABLE : transactions_wallet ──────────────────────────────────
export type TransactionWallet = {
  id:               string
  user_id:          string
  type:             'gain' | 'retrait' | 'commission' | 'bonus' | 'remboursement' | 'recharge' | 'paiement_course'
  montant:          number
  solde_avant:      number
  solde_apres:      number
  livraison_id:     string | null
  reference:        string | null
  note:             string | null
  created_at:       string
  status:           'pending' | 'completed' | 'failed' | 'cancelled' | 'confirmed'
  payment_method:   'cash' | 'mobile_money' | 'carte' | 'wallet' | 'virement_bancaire' | null
  idempotency_key:  string | null
  updated_at:       string
}

// ── 8. TABLE : notifications ─────────────────────────────────────────
export type Notification = {
  id:         string
  user_id:    string
  type:       string
  titre:      string
  message:    string
  data:       Record<string, unknown> | null
  lu:         boolean
  created_at: string
}

// ── 9. TABLE : messages ──────────────────────────────────────────────
export type Message = {
  id:               string
  livraison_id:     string | null
  expediteur_id:    string
  destinataire_id:  string
  contenu:          string
  photo_url:        string | null
  lu:               boolean
  created_at:       string
}

// ── 10. TABLE : evaluations ──────────────────────────────────────────
export type Evaluation = {
  id:             string
  livraison_id:   string
  evaluateur_id:  string
  evalue_id:      string
  note:           number       // 1 à 5
  commentaire:    string | null
  created_at:     string
}

// ── 11. TABLE : propositions_prix ────────────────────────────────────
export type PropositionPrix = {
  id:           string
  livraison_id: string
  auteur_id:    string
  role_auteur:  'client' | 'coursier'
  montant:      number
  statut:       'en_attente' | 'accepte' | 'refuse'
  created_at:   string
}

// ── 12. TABLE : paiements ────────────────────────────────────────────
export type Paiement = {
  id:           string
  livraison_id: string
  montant:      number
  mode:         'cash' | 'mobile_money' | 'carte'
  reference:    string | null
  statut:       'en_attente' | 'succes' | 'echec' | 'rembourse'
  metadata:     Record<string, unknown> | null
  paye_le:      string | null
  created_at:   string
}

// ── 13. TABLE : signalements ─────────────────────────────────────────
export type Signalement = {
  id:           string
  signalant_id: string
  signale_id:   string
  livraison_id: string | null
  motif:        string
  description:  string | null
  statut:       'en_attente' | 'traite' | 'rejete'
  traite_par:   string | null
  created_at:   string
}

// ── 14. TABLE : statuts_livraison ────────────────────────────────────
export type StatutLivraison = {
  id:           string
  livraison_id: string
  statut:       string
  note:         string | null
  changed_at:   string
}

// ── 15. TABLE : vehicules ────────────────────────────────────────────
export type Vehicule = {
  id:              string
  coursier_id:     string
  type:            'moto' | 'velo' | 'voiture' | 'camionnette'
  marque:          string
  modele:          string
  couleur:         string
  plaque:          string
  carte_grise_url: string | null
  est_verifie:     boolean
  created_at:      string
}

// ── 16. TABLE : courier_documents ───────────────────────────────────
export type CourierDocument = {
  id:               string
  coursier_id:      string
  document_type:    'cni_recto' | 'cni_verso' | 'permis' | 'carte_grise'
  file_url:         string
  status:           'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  uploaded_at:      string
  validated_by:     string | null
  validated_at:     string | null
}

// ── 17. TABLE : localisation_coursier ───────────────────────────────
export type LocalisationCoursier = {
  id:           string
  coursier_id:  string
  livraison_id: string | null
  latitude:     number
  longitude:    number
  vitesse:      number | null
  direction:    number | null
  created_at:   string
}

// ── 18. TABLE : logs_appels ──────────────────────────────────────────
export type LogAppel = {
  id:               string
  appelant_id:      string
  appelant_role:    string
  destinataire_id:  string
  livraison_id:     string | null
  type:             'telephoneNatif' | 'whatsapp' | 'voip'
  numero:           string
  created_at:       string
}

// ── 19. TABLE : contacts_favoris ────────────────────────────────────
export type ContactFavori = {
  id:         string
  user_id:    string
  nom:        string
  telephone:  string
  whatsapp:   string | null
  email:      string | null
  created_at: string
}

// ── 20. TABLE : coursiers_favoris ───────────────────────────────────
export type CoursierFavori = {
  id:          string
  client_id:   string
  coursier_id: string
  created_at:  string
}

// ── 21. TABLE : adresses_favorites ──────────────────────────────────
export type AdresseFavorite = {
  id:          string
  user_id:     string
  label:       string
  adresse:     string
  latitude:    number
  longitude:   number
  est_defaut:  boolean
  created_at:  string
}

// ── 22. TABLE : config_tarifs ────────────────────────────────────────
export type ConfigTarif = {
  id:                   string
  tarif_km:             number
  tarif_minute:         number
  frais_fixe:           number
  commission_pct:       number
  multiplicateur_urgent: number
  actif:                boolean
  updated_at:           string
}

// ── HELPERS ──────────────────────────────────────────────────────────

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

export async function getCoursier(userId: string): Promise<Coursier | null> {
  const { data, error } = await supabase
    .from('coursiers')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Coursier
}

export async function getWallet(userId: string): Promise<Wallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as Wallet
}

export async function getLivraison(livraisonId: string): Promise<Livraison | null> {
  const { data, error } = await supabase
    .from('livraisons')
    .select('*, coursier:coursiers(id, nom, telephone, avatar_url, note_moyenne)')
    .eq('id', livraisonId)
    .single()
  if (error) return null
  return data as Livraison
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as Notification[]
}

export async function getTransactionsWallet(userId: string): Promise<TransactionWallet[]> {
  const { data, error } = await supabase
    .from('transactions_wallet')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as TransactionWallet[]
}
