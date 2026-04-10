-- ══════════════════════════════════════════════════════════════════
-- NYME BF — Migration 011 : Évaluations, Retraits clients, Index finaux
-- Exécuter dans Supabase SQL Editor APRÈS migrations 001-010
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. CONTRAINTE UNIQUE evaluations (livraison_id + evaluateur_id)
-- Évite la double évaluation d'une même livraison par le même client
-- ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evaluations_livraison_evaluateur_unique'
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_livraison_evaluateur_unique
        UNIQUE (livraison_id, evaluateur_id);
    RAISE NOTICE 'Contrainte unique evaluations ajoutée';
  ELSE
    RAISE NOTICE 'Contrainte unique evaluations déjà présente';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. INDEX OPTIMISATION — requêtes fréquentes
-- ─────────────────────────────────────────────────────────────────

-- Index propositions_prix par livraison
CREATE INDEX IF NOT EXISTS idx_propositions_livraison_statut
  ON public.propositions_prix (livraison_id, statut);

-- Index propositions_prix par auteur
CREATE INDEX IF NOT EXISTS idx_propositions_auteur
  ON public.propositions_prix (auteur_id, statut);

-- Index evaluations par evalue (coursier)
CREATE INDEX IF NOT EXISTS idx_evaluations_evalue
  ON public.evaluations (evalue_id);

-- Index evaluations par livraison
CREATE INDEX IF NOT EXISTS idx_evaluations_livraison
  ON public.evaluations (livraison_id);

-- Index transactions_wallet par référence (idempotence)
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_reference
  ON public.transactions_wallet (reference)
  WHERE reference IS NOT NULL;

-- Index messages par destinataire non lu (performance messagerie)
CREATE INDEX IF NOT EXISTS idx_messages_destinataire_non_lu
  ON public.messages (destinataire_id, lu)
  WHERE lu = FALSE;

-- Index messages par paire (expediteur, destinataire)
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (expediteur_id, destinataire_id);

-- ─────────────────────────────────────────────────────────────────
-- 3. RLS POUR propositions_prix (si pas encore présent)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.propositions_prix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client lit ses propositions" ON public.propositions_prix;
CREATE POLICY "Client lit ses propositions" ON public.propositions_prix
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = propositions_prix.livraison_id
        AND l.client_id = auth.uid()
    )
    OR auteur_id = auth.uid()
  );

DROP POLICY IF EXISTS "Client et coursier insèrent propositions" ON public.propositions_prix;
CREATE POLICY "Client et coursier insèrent propositions" ON public.propositions_prix
  FOR INSERT WITH CHECK (auteur_id = auth.uid());

DROP POLICY IF EXISTS "Client met à jour ses propositions" ON public.propositions_prix;
CREATE POLICY "Client met à jour ses propositions" ON public.propositions_prix
  FOR UPDATE USING (
    auteur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.livraisons l
      WHERE l.id = propositions_prix.livraison_id
        AND l.client_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. RLS POUR evaluations (si pas encore présent)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Évaluateur insère" ON public.evaluations;
CREATE POLICY "Évaluateur insère" ON public.evaluations
  FOR INSERT WITH CHECK (evaluateur_id = auth.uid());

DROP POLICY IF EXISTS "Lecture évaluations publique" ON public.evaluations;
CREATE POLICY "Lecture évaluations publique" ON public.evaluations
  FOR SELECT USING (
    evaluateur_id = auth.uid()
    OR evalue_id   = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 5. RLS POUR coursiers_favoris (si pas encore présent)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.coursiers_favoris ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client gère ses favoris coursiers" ON public.coursiers_favoris;
CREATE POLICY "Client gère ses favoris coursiers" ON public.coursiers_favoris
  FOR ALL USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 6. MISE À JOUR TRIGGER handle_new_user pour wallet auto-créé
-- (déjà dans migration 010 mais on s'assure que total_gains et
--  total_retraits sont bien à 0 lors de la création du wallet)
-- ─────────────────────────────────────────────────────────────────

-- Vérifier que wallets a les colonnes total_gains et total_retraits
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS total_gains    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_retraits NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────
-- 7. VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════';
  RAISE NOTICE 'Migration 011 complète';
  RAISE NOTICE 'Contraintes, index, RLS ajoutés';
  RAISE NOTICE '═══════════════════════════════════';
END $$;