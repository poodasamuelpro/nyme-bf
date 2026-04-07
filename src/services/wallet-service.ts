// src/services/wallet-service.ts
// ══════════════════════════════════════════════════════════════════
// CORRECTION : Suppression des appels à recharge_wallet et debit_wallet
// (fonctions SQL inexistantes). Tout passe par process_wallet_transaction
// qui est définie et fonctionnelle (migration 003).
// ══════════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase'
import type { Wallet, TransactionWallet } from '@/lib/supabase'

export type { Wallet as WalletData }
export type TransactionData = TransactionWallet

class WalletService {
  /**
   * Récupère le wallet d'un utilisateur.
   */
  async getWallet(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error && error.code !== 'PGRST116') throw new Error('Impossible de récupérer le portefeuille.')
    return data as Wallet | null
  }

  /**
   * Crée un wallet vide pour un utilisateur.
   */
  async createWallet(userId: string): Promise<Wallet> {
    const { data, error } = await supabase
      .from('wallets')
      .insert({ user_id: userId, solde: 0, total_gains: 0, total_retraits: 0 })
      .select()
      .single()
    if (error) throw new Error('Impossible de créer le portefeuille.')
    return data as Wallet
  }

  /**
   * Crédite le wallet via process_wallet_transaction (RPC).
   * Remplace l'ancienne recharge_wallet() qui n'existe pas en SQL.
   *
   * @param userId     ID de l'utilisateur
   * @param montant    Montant positif à créditer
   * @param type       Type de transaction ('recharge' | 'gain' | 'bonus' | 'remboursement')
   * @param reference  Référence unique de la transaction
   * @param note       Description optionnelle
   */
  async crediterWallet(
    userId: string,
    montant: number,
    type: 'recharge' | 'gain' | 'bonus' | 'remboursement',
    reference: string,
    note?: string
  ): Promise<string> {
    if (montant <= 0) throw new Error('Le montant doit être positif')

    const { data: txId, error } = await supabase.rpc('process_wallet_transaction', {
      p_user_id:    userId,
      p_type:       type,
      p_montant:    montant,
      p_reference:  reference,
      p_note:       note || `Crédit ${type} — ${montant.toLocaleString('fr-FR')} XOF`,
    })
    if (error) throw new Error(`Erreur crédit wallet : ${error.message}`)
    return txId as string
  }

  /**
   * Débite le wallet via process_wallet_transaction (RPC).
   * Remplace l'ancienne debit_wallet() qui n'existe pas en SQL.
   * La fonction SQL utilise des montants NÉGATIFS pour les débits.
   *
   * @param userId     ID de l'utilisateur
   * @param montant    Montant positif à débiter (sera passé en négatif)
   * @param type       Type de transaction ('retrait' | 'paiement_course' | 'commission')
   * @param reference  Référence unique
   * @param note       Description optionnelle
   */
  async debiterWallet(
    userId: string,
    montant: number,
    type: 'retrait' | 'paiement_course' | 'commission',
    reference: string,
    note?: string
  ): Promise<string> {
    if (montant <= 0) throw new Error('Le montant doit être positif')

    // process_wallet_transaction accepte des montants NÉGATIFS pour les débits
    const { data: txId, error } = await supabase.rpc('process_wallet_transaction', {
      p_user_id:    userId,
      p_type:       type,
      p_montant:    -montant,  // négatif = débit
      p_reference:  reference,
      p_note:       note || `Débit ${type} — ${montant.toLocaleString('fr-FR')} XOF`,
    })
    if (error) throw new Error(`Erreur débit wallet : ${error.message}`)
    return txId as string
  }

  /**
   * Récupère les transactions d'un utilisateur.
   */
  async getTransactions(userId: string, limit = 50): Promise<TransactionData[]> {
    const { data, error } = await supabase
      .from('transactions_wallet')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error('Impossible de récupérer les transactions.')
    return (data || []) as TransactionData[]
  }

  /**
   * Vérifie si une référence de transaction existe déjà (idempotence).
   */
  async checkTransactionReference(reference: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('transactions_wallet')
      .select('id')
      .eq('reference', reference)
      .single()
    if (error && error.code !== 'PGRST116') throw new Error('Erreur vérification référence.')
    return !!data
  }
}

export const walletService = new WalletService()
