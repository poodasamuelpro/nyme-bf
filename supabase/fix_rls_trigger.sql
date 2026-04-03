-- ═══════════════════════════════════════════════════════════════════
-- NYME - Fix SQL : Corrections RLS + Trigger handle_new_user
-- À exécuter dans Supabase SQL Editor
--
-- Structure réelle (migration 001) :
--   wallets         : id, user_id, solde, updated_at
--   transactions_wallet : id, user_id, type, montant, solde_avant,
--                         solde_apres, livraison_id, reference, note,
--                         created_at
--   coursiers       : id (=user_id), statut, statut_verification,
--                     cni_recto_url, cni_verso_url, permis_url,
--                     total_courses, total_gains, ...
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 0. Recréer mon_role() (sécurité — doit exister avant les policies)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mon_role()
RETURNS TEXT AS $$
  SELECT role FROM public.utilisateurs WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────────
-- 1. CORRIGER LE TRIGGER handle_new_user
-- Problème : ON CONFLICT DO NOTHING ignore role='partenaire' dans metadata
-- Fix     : ON CONFLICT DO UPDATE le rôle si l'entrée actuelle est 'client'
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  IF v_role NOT IN ('client', 'coursier', 'partenaire') THEN
    v_role := 'client';
  END IF;

  INSERT INTO public.utilisateurs (
    id, nom, email, telephone, role, est_verifie, est_actif, created_at, updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'telephone', NULL),
    v_role,
    FALSE,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      nom        = COALESCE(EXCLUDED.nom, public.utilisateurs.nom),
      email      = EXCLUDED.email,
      telephone  = COALESCE(EXCLUDED.telephone, public.utilisateurs.telephone),
      role       = CASE
                     WHEN public.utilisateurs.role = 'client' THEN v_role
                     ELSE public.utilisateurs.role
                   END,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- 2. RLS SUR utilisateurs
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateur voit son profil"         ON public.utilisateurs;
DROP POLICY IF EXISTS "Utilisateur insère son profil"       ON public.utilisateurs;
DROP POLICY IF EXISTS "Utilisateur modifie son profil"      ON public.utilisateurs;
DROP POLICY IF EXISTS "Admin gère tous les utilisateurs"    ON public.utilisateurs;
DROP POLICY IF EXISTS "Partenaire voit son profil utilisateur" ON public.utilisateurs;
DROP POLICY IF EXISTS "Tout le monde voit les profils actifs" ON public.utilisateurs;

CREATE POLICY "Utilisateur voit son profil"
  ON public.utilisateurs FOR SELECT
  USING (id = auth.uid() OR est_actif = TRUE OR mon_role() = 'admin');

CREATE POLICY "Utilisateur insère son profil"
  ON public.utilisateurs FOR INSERT
  WITH CHECK (id = auth.uid() OR mon_role() = 'admin');

CREATE POLICY "Utilisateur modifie son profil"
  ON public.utilisateurs FOR UPDATE
  USING (id = auth.uid() OR mon_role() = 'admin')
  WITH CHECK (id = auth.uid() OR mon_role() = 'admin');

CREATE POLICY "Admin gère tous les utilisateurs"
  ON public.utilisateurs FOR ALL
  USING (mon_role() = 'admin')
  WITH CHECK (mon_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- 3. RLS SUR partenaires
-- Problème PRINCIPAL : aucune politique INSERT → inscription bloquée
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.partenaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partenaire insère son profil"     ON public.partenaires;
DROP POLICY IF EXISTS "Partenaire voit son profil"       ON public.partenaires;
DROP POLICY IF EXISTS "Partenaire modifie son profil"    ON public.partenaires;
DROP POLICY IF EXISTS "Admin gère tous les partenaires"  ON public.partenaires;

CREATE POLICY "Partenaire voit son profil"
  ON public.partenaires FOR SELECT
  USING (auth.uid() = user_id OR mon_role() = 'admin');

CREATE POLICY "Partenaire insère son profil"
  ON public.partenaires FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partenaire modifie son profil"
  ON public.partenaires FOR UPDATE
  USING (auth.uid() = user_id OR mon_role() = 'admin')
  WITH CHECK (auth.uid() = user_id OR mon_role() = 'admin');

CREATE POLICY "Admin gère tous les partenaires"
  ON public.partenaires FOR ALL
  USING (mon_role() = 'admin')
  WITH CHECK (mon_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- 4. RLS SUR wallets
-- Structure réelle : id, user_id, solde, updated_at
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateur voit son wallet"  ON public.wallets;
DROP POLICY IF EXISTS "Admin gère tous les wallets"  ON public.wallets;

CREATE POLICY "Utilisateur voit son wallet"
  ON public.wallets FOR SELECT
  USING (user_id = auth.uid() OR mon_role() = 'admin');

CREATE POLICY "Admin gère tous les wallets"
  ON public.wallets FOR ALL
  USING (mon_role() = 'admin')
  WITH CHECK (mon_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- 5. RLS SUR transactions_wallet
-- Structure réelle : id, user_id (pas wallet_id !), type, montant,
--                    solde_avant, solde_apres, livraison_id, reference,
--                    note, created_at
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.transactions_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateur voit ses transactions"   ON public.transactions_wallet;
DROP POLICY IF EXISTS "Admin gère toutes les transactions"  ON public.transactions_wallet;

CREATE POLICY "Utilisateur voit ses transactions"
  ON public.transactions_wallet FOR SELECT
  USING (user_id = auth.uid() OR mon_role() = 'admin');

CREATE POLICY "Admin gère toutes les transactions"
  ON public.transactions_wallet FOR ALL
  USING (mon_role() = 'admin')
  WITH CHECK (mon_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- 6. RLS SUR coursiers
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.coursiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coursier voit son profil"      ON public.coursiers;
DROP POLICY IF EXISTS "Coursier modifie son profil"   ON public.coursiers;
DROP POLICY IF EXISTS "Admin gère tous les coursiers" ON public.coursiers;

CREATE POLICY "Coursier voit son profil"
  ON public.coursiers FOR SELECT
  USING (id = auth.uid() OR mon_role() = 'admin');

CREATE POLICY "Coursier modifie son profil"
  ON public.coursiers FOR UPDATE
  USING (id = auth.uid() OR mon_role() = 'admin')
  WITH CHECK (id = auth.uid() OR mon_role() = 'admin');

CREATE POLICY "Admin gère tous les coursiers"
  ON public.coursiers FOR ALL
  USING (mon_role() = 'admin')
  WITH CHECK (mon_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- 7. RLS SUR livraisons_partenaire (table du site web)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.livraisons_partenaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partenaire gère ses livraisons" ON public.livraisons_partenaire;
DROP POLICY IF EXISTS "Admin gère toutes livraisons partenaire" ON public.livraisons_partenaire;

CREATE POLICY "Partenaire gère ses livraisons"
  ON public.livraisons_partenaire FOR ALL
  USING (
    partenaire_id IN (
      SELECT id FROM public.partenaires WHERE user_id = auth.uid()
    )
    OR mon_role() = 'admin'
  )
  WITH CHECK (
    partenaire_id IN (
      SELECT id FROM public.partenaires WHERE user_id = auth.uid()
    )
    OR mon_role() = 'admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- 8. AJOUTER total_gains à wallets si manquant (migration 003 l'ajoute)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS total_gains    NUMERIC(12,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS total_retraits NUMERIC(12,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ   DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────
-- 9. VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────────

SELECT
  'utilisateurs'         AS tbl, COUNT(*) AS nb FROM public.utilisateurs
UNION ALL SELECT 'partenaires',    COUNT(*) FROM public.partenaires
UNION ALL SELECT 'coursiers',      COUNT(*) FROM public.coursiers
UNION ALL SELECT 'wallets',        COUNT(*) FROM public.wallets
UNION ALL SELECT 'transactions',   COUNT(*) FROM public.transactions_wallet;

SELECT role, COUNT(*) AS nb FROM public.utilisateurs GROUP BY role ORDER BY role;
