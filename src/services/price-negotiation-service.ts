/**
 * Service de négociation de prix (style InDrive)
 */

import { supabase } from '@/lib/supabase'
import type { PropositionPrix } from '@/lib/supabase'

export interface PriceProposal {
  id: string
  livraison_id: string
  auteur_id: string
  role_auteur: 'client' | 'coursier'
  montant: number
  statut: 'en_attente' | 'accepte' | 'refuse'
  created_at: string
  auteur?: { nom: string; avatar_url?: string }
}

class PriceNegotiationService {

  async proposePriceAsClient(
    livraison_id: string,
    client_id: string,
    montant: number
  ): Promise<PropositionPrix> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .insert({ livraison_id, auteur_id: client_id, role_auteur: 'client', montant, statut: 'en_attente' })
      .select()
      .single()

    if (error) throw error
    return data as PropositionPrix
  }

  async proposePriceAsCourier(
    livraison_id: string,
    coursier_id: string,
    montant: number
  ): Promise<PropositionPrix> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .insert({ livraison_id, auteur_id: coursier_id, role_auteur: 'coursier', montant, statut: 'en_attente' })
      .select()
      .single()

    if (error) throw error
    return data as PropositionPrix
  }

  async getProposalsForDelivery(livraison_id: string): Promise<PriceProposal[]> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .select('*, auteur:auteur_id(nom, avatar_url)')
      .eq('livraison_id', livraison_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as PriceProposal[]
  }

  async acceptProposal(
    livraison_id: string,
    proposition_id: string,
    montant: number
  ): Promise<void> {
    const { error: e1 } = await supabase
      .from('propositions_prix')
      .update({ statut: 'accepte' })
      .eq('id', proposition_id)
    if (e1) throw e1

    const { error: e2 } = await supabase
      .from('livraisons')
      .update({ prix_final: montant, statut_paiement: 'en_attente' })
      .eq('id', livraison_id)
    if (e2) throw e2

    // Refuser les autres propositions
    await supabase
      .from('propositions_prix')
      .update({ statut: 'refuse' })
      .eq('livraison_id', livraison_id)
      .neq('id', proposition_id)
  }

  async rejectProposal(proposition_id: string): Promise<void> {
    const { error } = await supabase
      .from('propositions_prix')
      .update({ statut: 'refuse' })
      .eq('id', proposition_id)
    if (error) throw error
  }

  async getPendingProposalsForCourier(coursier_id: string): Promise<PriceProposal[]> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .select('*, livraison:livraison_id(*, client:client_id(nom, avatar_url))')
      .eq('auteur_id', coursier_id)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as PriceProposal[]
  }

  calculateRecommendedPrice(
    distanceKm: number,
    type: 'immediate' | 'urgente' | 'programmee'
  ): number {
    let price = 800 + distanceKm * 200
    if (type === 'urgente') price *= 1.3
    else if (type === 'programmee') price *= 0.9
    return Math.round(price)
  }

  validateProposal(
    montant: number,
    prixCalcule: number
  ): { valid: boolean; message?: string; ratio?: number } {
    if (montant <= 0) return { valid: false, message: 'Le montant doit être positif' }

    const ratio = montant / prixCalcule
    if (ratio < 0.5) return { valid: false, message: `Minimum ${Math.round(prixCalcule * 0.5)} XOF`, ratio }
    if (ratio > 2.0) return { valid: false, message: `Maximum ${Math.round(prixCalcule * 2.0)} XOF`, ratio }

    return { valid: true, ratio }
  }
}

export const priceNegotiationService = new PriceNegotiationService()
