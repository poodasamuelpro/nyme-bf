// src/lib/tarifs.ts
// ══════════════════════════════════════════════════════════════════
// SOURCE UNIQUE DE VÉRITÉ — Tarification NYME
// LIT depuis Supabase (tables config_tarifs + tarifs_baremes)
// Tous les fichiers importent depuis ici — NE PAS dupliquer les prix
// ══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase'
import type { ConfigTarif } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────

export interface BaremeTarif {
  id:          string
  km_min:      number
  km_max:      number
  prix_par_km: number
  label:       string
  ordre:       number
  actif:       boolean
}

export interface ConfigTarifComplet extends ConfigTarif {
  // Colonnes ajoutées par migration 007
  frais_fixe_immediate:    number
  frais_fixe_urgente:      number
  frais_fixe_programmee:   number
  prix_minimum:            number
  multiplicateur_urgente:  number
  multiplicateur_programmee: number
  multiplicateur_pluie:    number
  pluie_actif:             boolean
  commission_immediate:    number
  commission_urgente:      number
  commission_programmee:   number
}

// ── Plans partenaires ─────────────────────────────────────────────
// PRIX OFFICIELS NYME — à synchroniser manuellement si changement

export const PLANS_PARTENAIRES = {
  starter: {
    label:         'Starter',
    emoji:         '🟢',
    prix:          25_000,   // FCFA/mois
    livraisons_max: 30,
    delai_livraison: '45 min',
    taux_commission: 12.0,
    features: [
      "Jusqu'à 30 livraisons/mois",
      'Livreur dédié assigné',
      'Livraison sous 45 min',
      'Suivi GPS en temps réel',
      'Tableau de bord simple',
      'Support par email',
    ],
  },
  business: {
    label:         'Business',
    emoji:         '⭐',
    prix:          65_000,   // FCFA/mois
    livraisons_max: 100,
    delai_livraison: '30 min',
    taux_commission: 10.0,
    features: [
      "Jusqu'à 100 livraisons/mois",
      'Livreur dédié quotidien',
      'Livraison express sous 30 min',
      'Suivi GPS en temps réel',
      'Dashboard avancé + rapports',
      'Traçabilité complète (photos)',
      'Intégration WhatsApp Business',
      'Support prioritaire 7j/7',
    ],
  },
  enterprise: {
    label:         'Enterprise',
    emoji:         '🏢',
    prix:          0,        // Sur devis
    livraisons_max: 9_999,
    delai_livraison: 'Express garanti',
    taux_commission: 8.0,
    features: [
      'Livraisons illimitées',
      'Équipe de livreurs dédiés',
      'Livraison express garantie',
      "API d'intégration sur mesure",
      'Dashboard multi-utilisateurs',
      'Rapports analytiques détaillés',
      'Gestionnaire de compte dédié',
      'SLA garanti & support 24h/24',
    ],
  },
} as const

// ── Cache en mémoire (durée : 5 minutes) ─────────────────────────

let _config:   ConfigTarifComplet | null = null
let _baremes:  BaremeTarif[]             = []
let _cacheTs:  number                    = 0
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

async function getConfigEtBaremes(): Promise<{
  config: ConfigTarifComplet
  baremes: BaremeTarif[]
}> {
  // Retourner le cache si encore valide
  if (_config && _baremes.length > 0 && Date.now() - _cacheTs < CACHE_TTL) {
    return { config: _config, baremes: _baremes }
  }

  // Charger depuis Supabase
  const [{ data: configData }, { data: baremesData }] = await Promise.all([
    supabase
      .from('config_tarifs')
      .select('*')
      .eq('actif', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('tarifs_baremes')
      .select('*')
      .eq('actif', true)
      .order('ordre', { ascending: true }),
  ])

  if (!configData) {
    throw new Error('Aucune configuration tarifaire active en base')
  }

  _config  = configData as ConfigTarifComplet
  _baremes = (baremesData || []) as BaremeTarif[]
  _cacheTs = Date.now()

  return { config: _config, baremes: _baremes }
}

/** Vide le cache — à appeler après modification des tarifs depuis l'admin */
export function invaliderCacheTarifs(): void {
  _config  = null
  _baremes = []
  _cacheTs = 0
}

// ── Calcul principal ──────────────────────────────────────────────

/**
 * Calcule le prix recommandé pour une livraison.
 * Lit les barèmes depuis Supabase (cache 5 min).
 *
 * Logique :
 *   prix = frais_fixe
 *   Pour chaque tranche [km_min, km_max, prix_par_km] :
 *     km_dans_tranche = min(distance, km_max) - min(distance, km_min)
 *     prix += km_dans_tranche × prix_par_km
 *   Modificateurs type + météo appliqués ensuite
 *
 * @param distanceKm  Distance calculée par MapService
 * @param type        Type de course
 * @param pluie       Résultat de isItRaining() — false par défaut
 */
export async function calculerPrix(
  distanceKm: number,
  type: 'immediate' | 'urgente' | 'programmee',
  pluie = false
): Promise<number> {
  const { config, baremes } = await getConfigEtBaremes()

  // Frais fixes selon le type
  let prix: number
  if (type === 'urgente') {
    prix = config.frais_fixe_urgente ?? config.frais_fixe
  } else if (type === 'programmee') {
    prix = config.frais_fixe_programmee ?? config.frais_fixe
  } else {
    prix = config.frais_fixe_immediate ?? config.frais_fixe
  }

  // Appliquer les barèmes par tranche
  let kmRestant = distanceKm
  for (const bareme of baremes) {
    if (kmRestant <= 0) break
    const kmDansTranche = Math.min(kmRestant, bareme.km_max - bareme.km_min)
    prix += kmDansTranche * bareme.prix_par_km
    kmRestant -= kmDansTranche
  }

  // Si distance dépasse le dernier barème, utiliser le tarif du dernier
  if (kmRestant > 0 && baremes.length > 0) {
    const dernierBareme = baremes[baremes.length - 1]
    prix += kmRestant * dernierBareme.prix_par_km
  }

  // Modificateurs de type
  if (type === 'urgente') {
    prix *= config.multiplicateur_urgente ?? config.multiplicateur_urgent ?? 1.25
  } else if (type === 'programmee') {
    prix *= config.multiplicateur_programmee ?? 0.90
  }

  // Modificateur météo (seulement si activé dans la config)
  if (pluie && (config.pluie_actif ?? false)) {
    prix *= config.multiplicateur_pluie ?? 1.15
  }

  const minimum = config.prix_minimum ?? 800
  return Math.max(minimum, Math.round(prix))
}

/**
 * Version synchrone avec fallback hardcodé (si Supabase inaccessible).
 * À utiliser seulement côté client quand un rendu immédiat est requis.
 * Le prix sera recalculé une fois la config chargée.
 */
export function calculerPrixFallback(
  distanceKm: number,
  type: 'immediate' | 'urgente' | 'programmee'
): number {
  // Barèmes par défaut (correspondant aux données de migration 007)
  const baremesDefaut = [
    { km_min: 0,    km_max: 3.5,  prix_par_km: 600 },
    { km_min: 3.5,  km_max: 6.0,  prix_par_km: 580 },
    { km_min: 6.0,  km_max: 9.0,  prix_par_km: 550 },
    { km_min: 9.0,  km_max: 12.0, prix_par_km: 520 },
    { km_min: 12.0, km_max: 16.0, prix_par_km: 490 },
    { km_min: 16.0, km_max: 20.0, prix_par_km: 460 },
  ]

  let prix = 800
  let kmRestant = distanceKm

  for (const b of baremesDefaut) {
    if (kmRestant <= 0) break
    const km = Math.min(kmRestant, b.km_max - b.km_min)
    prix += km * b.prix_par_km
    kmRestant -= km
  }

  if (kmRestant > 0) prix += kmRestant * 440

  if (type === 'urgente')    prix *= 1.25
  if (type === 'programmee') prix *= 0.90

  return Math.max(800, Math.round(prix))
}

// ── Commission NYME ───────────────────────────────────────────────

/**
 * Retourne la commission fixe NYME selon le type de course.
 * LIT depuis config_tarifs — modifiable depuis l'admin sans redéploiement.
 */
export async function getCommissionFixe(
  type: 'immediate' | 'urgente' | 'programmee'
): Promise<number> {
  const { config } = await getConfigEtBaremes()

  if (type === 'urgente')    return config.commission_urgente    ?? 250
  if (type === 'programmee') return config.commission_programmee ?? 250
  return config.commission_immediate ?? 200
}

/**
 * Calcule le gain net du coursier après déduction commission fixe.
 */
export async function getGainCoursier(
  prixFinal: number,
  type: 'immediate' | 'urgente' | 'programmee'
): Promise<{ gainCoursier: number; commissionNyme: number }> {
  const commissionNyme = await getCommissionFixe(type)
  const gainCoursier   = Math.max(0, prixFinal - commissionNyme)
  return { gainCoursier, commissionNyme }
}

// ── Météo ─────────────────────────────────────────────────────────

/**
 * Vérifie s'il pleut à Ouagadougou.
 * Nécessite NEXT_PUBLIC_OPENWEATHER_KEY dans les variables d'environnement.
 * Retourne false si la clé est absente ou en cas d'erreur réseau.
 */
export async function isItRaining(): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_KEY
  if (!apiKey) return false

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=12.3547&lon=-1.5247&appid=${apiKey}`,
      { next: { revalidate: 600 } }  // cache 10 min côté Next.js
    )
    if (!res.ok) return false
    const data = await res.json()
    // codes météo : 2xx=orage, 3xx=bruine, 5xx=pluie → tout < 600 = précipitations
    const weatherId = data.weather?.[0]?.id
    return typeof weatherId === 'number' && weatherId < 600
  } catch {
    return false
  }
}

// ── Validation proposition ────────────────────────────────────────

/**
 * Valide qu'une proposition de prix client est dans les limites acceptables.
 * Fourchette : 50% à 200% du prix calculé, minimum absolu de la config.
 */
export async function validerProposition(
  montant: number,
  prixCalcule: number
): Promise<{ valid: boolean; message?: string; ratio?: number }> {
  const { config } = await getConfigEtBaremes()
  const minimum = config.prix_minimum ?? 800

  if (montant < minimum) {
    return { valid: false, message: `Minimum ${minimum.toLocaleString('fr-FR')} XOF` }
  }
  const ratio = montant / prixCalcule
  if (ratio < 0.5) {
    return { valid: false, message: `Minimum ${Math.round(prixCalcule * 0.5).toLocaleString('fr-FR')} XOF`, ratio }
  }
  if (ratio > 2.0) {
    return { valid: false, message: `Maximum ${Math.round(prixCalcule * 2).toLocaleString('fr-FR')} XOF`, ratio }
  }
  return { valid: true, ratio }
}

// ── Helpers d'affichage ───────────────────────────────────────────

export const fXOF = (n: number): string =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XOF'

/** Charge les barèmes pour affichage (dashboard admin) */
export async function getBaremes(): Promise<BaremeTarif[]> {
  const { baremes } = await getConfigEtBaremes()
  return baremes
}

/** Charge la config complète (dashboard admin) */
export async function getConfig(): Promise<ConfigTarifComplet> {
  const { config } = await getConfigEtBaremes()
  return config
}
