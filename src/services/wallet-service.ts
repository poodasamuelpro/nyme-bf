// src/services/wallet-service.ts
import { supabase } from "@/lib/supabase"

export interface WalletData {
  id: string
  user_id: string
  solde: number
  created_at: string
  updated_at: string
}

export interface TransactionData {
  id: string
  wallet_id: string
  montant: number
  type: string
  description: string
  reference: string
  created_at: string
}

class WalletService {
  async getWallet(userId: string): Promise<WalletData | null> {
    const { data, error } = await supabase.from("wallets").select("*").eq("user_id", userId).single()
    if (error && error.code !== "PGRST116") throw new Error("Impossible de récupérer le portefeuille.")
    return data as WalletData | null
  }

  async createWallet(userId: string): Promise<WalletData> {
    const { data, error } = await supabase.from("wallets").insert({ user_id: userId, solde: 0 }).select().single()
    if (error) throw new Error("Impossible de créer le portefeuille.")
    return data as WalletData
  }

  async rechargeWallet(userId: string, montant: number, type: string, reference: string): Promise<WalletData> {
    const { data, error } = await supabase.rpc("recharge_wallet", {
      p_user_id: userId, p_montant: montant, p_type: type,
      p_description: `Recharge de ${montant} XOF`, p_reference: reference,
    })
    if (error) throw new Error("Impossible de recharger le portefeuille.")
    return data as WalletData
  }

  async debitWallet(userId: string, montant: number, type: string, reference: string): Promise<WalletData> {
    const { data, error } = await supabase.rpc("debit_wallet", {
      p_user_id: userId, p_montant: montant, p_type: type,
      p_description: `Paiement de ${montant} XOF`, p_reference: reference,
    })
    if (error) throw new Error("Impossible de débiter le portefeuille.")
    return data as WalletData
  }

  async getTransactions(walletId: string): Promise<TransactionData[]> {
    const { data, error } = await supabase.from("transactions_wallet")
      .select("*").eq("wallet_id", walletId).order("created_at", { ascending: false })
    if (error) throw new Error("Impossible de récupérer les transactions.")
    return (data || []) as TransactionData[]
  }

  async checkTransactionReference(reference: string): Promise<boolean> {
    const { data, error } = await supabase.from("transactions_wallet").select("id").eq("reference", reference).single()
    if (error && error.code !== "PGRST116") throw new Error("Erreur vérification référence.")
    return !!data
  }
}

export const walletService = new WalletService()
