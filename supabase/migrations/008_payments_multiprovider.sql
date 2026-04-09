-- ══════════════════════════════════════════════════════════════════
-- NYME BF — Migration 008 : Paiements multi-providers & wallet mode
-- Exécuter dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. ÉTENDRE LA TABLE paiements
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS provider  TEXT          DEFAULT NULL,   -- 'duniapay' | 'flutterwave' | 'orange' | 'wallet' | 'cash'
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger updated_at pour paiements
CREATE OR REPLACE FUNCTION public.update_paiements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_paiements_updated_at ON public.paiements;
CREATE TRIGGER trg_paiements_updated_at
  BEFORE UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.update_paiements_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 2. ÉTENDRE mode_paiement DANS livraisons
-- Ajouter 'wallet' comme valeur autorisée (en complément de cash/mobile_money/carte)
-- ─────────────────────────────────────────────────────────────────

-- Supprimer l'ancienne contrainte CHECK et en créer une nouvelle
ALTER TABLE public.livraisons
  DROP CONSTRAINT IF EXISTS livraisons_mode_paiement_check;

ALTER TABLE public.livraisons
  ADD CONSTRAINT livraisons_mode_paiement_check
    CHECK (mode_paiement IN ('cash', 'mobile_money', 'carte', 'wallet'));

-- ─────────────────────────────────────────────────────────────────
-- 3. ÉTENDRE mode DANS paiements
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.paiements
  DROP CONSTRAINT IF EXISTS paiements_mode_check;

ALTER TABLE public.paiements
  ADD CONSTRAINT paiements_mode_check
    CHECK (mode IN ('cash', 'mobile_money', 'carte', 'wallet'));

-- ─────────────────────────────────────────────────────────────────
-- 4. ÉTENDRE payment_method DANS transactions_wallet
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.transactions_wallet
  DROP CONSTRAINT IF EXISTS transactions_wallet_payment_method_check;

ALTER TABLE public.transactions_wallet
  ADD CONSTRAINT transactions_wallet_payment_method_check
    CHECK (payment_method IN ('cash', 'mobile_money', 'carte', 'wallet', 'virement_bancaire'));

-- ─────────────────────────────────────────────────────────────────
-- 5. METTRE À JOUR process_wallet_transaction pour accepter livraison_id et payment_method
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_user_id       UUID,
  p_type          TEXT,
  p_montant       NUMERIC,
  p_reference     TEXT,
  p_note          TEXT          DEFAULT NULL,
  p_livraison_id  UUID          DEFAULT NULL,
  p_payment_method TEXT         DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id     UUID;
  v_solde_avant   NUMERIC;
  v_solde_apres   NUMERIC;
  v_tx_id         UUID;
  v_idempotency   TEXT;
BEGIN
  -- Clé d'idempotence basée sur user + référence
  v_idempotency := p_user_id::TEXT || '_' || p_reference;

  -- Vérifier si transaction déjà effectuée (idempotence)
  SELECT id INTO v_tx_id
  FROM public.transactions_wallet
  WHERE idempotency_key = v_idempotency
  LIMIT 1;

  IF v_tx_id IS NOT NULL THEN
    RETURN v_tx_id;  -- Transaction déjà effectuée — retourner l'ID existant
  END IF;

  -- Récupérer ou créer le wallet
  SELECT id, solde INTO v_wallet_id, v_solde_avant
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Lock pour éviter les race conditions

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, solde, total_gains, total_retraits, created_at, updated_at)
    VALUES (p_user_id, 0, 0, 0, NOW(), NOW())
    RETURNING id, solde INTO v_wallet_id, v_solde_avant;
  END IF;

  -- Calculer le nouveau solde
  v_solde_apres := v_solde_avant + p_montant;

  -- Vérifier le solde pour les débits
  IF p_montant < 0 AND v_solde_apres < 0 THEN
    RAISE EXCEPTION 'Solde insuffisant: % XOF disponible, % XOF requis',
      v_solde_avant, ABS(p_montant);
  END IF;

  -- Mettre à jour le wallet
  UPDATE public.wallets
  SET
    solde          = v_solde_apres,
    total_gains    = CASE WHEN p_montant > 0 THEN total_gains    + p_montant ELSE total_gains    END,
    total_retraits = CASE WHEN p_montant < 0 THEN total_retraits + ABS(p_montant) ELSE total_retraits END,
    updated_at     = NOW()
  WHERE id = v_wallet_id;

  -- Insérer la transaction
  INSERT INTO public.transactions_wallet (
    user_id, type, montant, solde_avant, solde_apres,
    livraison_id, reference, note, status, payment_method,
    idempotency_key, created_at, updated_at
  ) VALUES (
    p_user_id, p_type, p_montant, v_solde_avant, v_solde_apres,
    p_livraison_id, p_reference, p_note, 'completed', p_payment_method,
    v_idempotency, NOW(), NOW()
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 6. INDEX SUPPLÉMENTAIRES POUR PERFORMANCE
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_paiements_livraison_id
  ON public.paiements (livraison_id);

CREATE INDEX IF NOT EXISTS idx_paiements_reference
  ON public.paiements (reference);

CREATE INDEX IF NOT EXISTS idx_paiements_statut
  ON public.paiements (statut);

CREATE INDEX IF NOT EXISTS idx_livraisons_payment_ref
  ON public.livraisons (payment_api_reference)
  WHERE payment_api_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_livraisons_statut_paiement
  ON public.livraisons (statut_paiement);

-- ─────────────────────────────────────────────────────────────────
-- 7. VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 008 OK — paiements multi-providers + wallet mode';
  RAISE NOTICE 'Modes livraisons autorisés : cash, mobile_money, carte, wallet';
END $$;