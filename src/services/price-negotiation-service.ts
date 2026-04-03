/**
 * Service de négociation de prix (style InDrive)
 * Permet aux clients de proposer un prix et aux coursiers de contre-proposer
 */

import { supabase } from '@/lib/supabase'
import type { PropositionPrix } from '@/lib/supabase'

export interface PriceProposal extends PropositionPrix {
  auteur?: { nom: string; avatar_url?: string }
}

class PriceNegotiationService {
  /**
   * Le client propose un prix initial
   */
  async proposePriceAsClient(
    livraison_id: string,
    client_id: string,
    montant: number
  ): Promise<PropositionPrix> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .insert({
        livraison_id,
        auteur_id: client_id,
        role_auteur: 'client',
        montant,
        statut: 'en_attente',
      })
      .select()
      .single()

    if (error) throw error
    return data as PropositionPrix
  }

  /**
   * Le coursier propose un prix (contre-proposition)
   */
  async proposePriceAsCourier(
    livraison_id: string,
    coursier_id: string,
    montant: number
  ): Promise<PropositionPrix> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .insert({
        livraison_id,
        auteur_id: coursier_id,
        role_auteur: 'coursier',
        montant,
        statut: 'en_attente',
      })
      .select()
      .single()

    if (error) throw error
    return data as PropositionPrix
  }

  /**
   * Récupère toutes les propositions pour une livraison
   */
  async getProposalsForDelivery(livraison_id: string): Promise<PriceProposal[]> {
    const { data, error } = await supabase
      .from('propositions_prix')
      .select('*, auteur:auteur_id(nom, avatar_url)')
      .eq('livraison_id', livraison_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as PriceProposal[]
  }

  /**
   * Le client accepte une proposition de prix
   */
  async acceptProposal(
    livraison_id: string,
    proposition_id: string,
    montant: number
  ): Promise<void> {
    const { error: updateError } = await supabase
      .from('propositions_prix')
      .update({ statut: 'accepte' })
      .eq('id', proposition_id)

    if (updateError) throw updateError

    const { error: livraisonError } = await supabase
      .from('livraisons')
      .update({
        prix_final: montant,
        statut_paiement: 'en_attente',
      })
      .eq('id', livraison_id)

    if (livraisonError) throw livraisonError

    await supabase
      .from('propositions_prix')
      .update({ statut: 'refuse' })
      .eq('livraison_id', livraison_id)
      .neq('id', proposition_id)
  }

  /**
   * Calcule le prix recommandé basé sur la distance et le type de course
   * Alignement avec les types de l'interface : 'immediate' | 'urgent' | 'programmed'
   */
  calculateRecommendedPrice(
    distanceKm: number,
    type: 'immediate' | 'urgent' | 'programmed'
  ): number {
    let price = 800
    price += distanceKm * 200

    if (type === 'urgent') {
      price *= 1.3
    } else if (type === 'programmed') {
      price *= 0.9
    }

    return Math.round(price)
  }

  /**
   * Refuse une proposition de prix
   */
  async rejectProposal(proposition_id: string): Promise<void> {
    const { error } = await supabase
      .from('propositions_prix')
      .update({ statut: 'refuse' })
      .eq('id', proposition_id)

    if (error) throw error
  }
}

export const priceNegotiationService = new PriceNegotiationService()
