-- ══════════════════════════════════════════════════════════════════
-- NYME BF — Migration 009 : Tokens de suivi tiers
-- Exécuter dans Supabase SQL Editor APRÈS migration 008
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. TABLE : suivi_tokens — liens de suivi sans authentification
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suivi_tokens (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  livraison_id UUID        NOT NULL REFERENCES public.livraisons(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL UNIQUE,
  created_by   UUID        NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  actif        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche par token (le plus fréquent)
CREATE INDEX IF NOT EXISTS idx_suivi_tokens_token
  ON public.suivi_tokens (token)
  WHERE actif = TRUE;

-- Index pour recherche par livraison
CREATE INDEX IF NOT EXISTS idx_suivi_tokens_livraison
  ON public.suivi_tokens (livraison_id);

-- Nettoyage automatique des tokens expirés (facultatif — peut être un cron Supabase)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.suivi_tokens
  SET actif = FALSE
  WHERE expires_at < NOW() AND actif = TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. RLS SUR suivi_tokens
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.suivi_tokens ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire un token (pour la page suivi-tiers — sans auth)
DROP POLICY IF EXISTS "Lecture publique token suivi" ON public.suivi_tokens;
CREATE POLICY "Lecture publique token suivi" ON public.suivi_tokens
  FOR SELECT USING (TRUE);

-- Seul le créateur peut insérer
DROP POLICY IF EXISTS "Créateur insère token" ON public.suivi_tokens;
CREATE POLICY "Créateur insère token" ON public.suivi_tokens
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Seul le créateur ou admin peut désactiver
DROP POLICY IF EXISTS "Créateur ou admin gère token" ON public.suivi_tokens;
CREATE POLICY "Créateur ou admin gère token" ON public.suivi_tokens
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.utilisateurs WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────────
-- 3. PERMETTRE LA LECTURE PUBLIQUE DES LIVRAISONS VIA TOKEN
-- (La page suivi-tiers lit la livraison sans être authentifiée)
-- ─────────────────────────────────────────────────────────────────

-- Politique RLS supplémentaire sur livraisons : 
-- Lecture autorisée si un token valide existe pour cette livraison
DROP POLICY IF EXISTS "Lecture livraison via token suivi" ON public.livraisons;
CREATE POLICY "Lecture livraison via token suivi" ON public.livraisons
  FOR SELECT USING (
    -- L'utilisateur est authentifié et est client/coursier/admin de cette livraison
    (auth.uid() = client_id)
    OR (auth.uid() = coursier_id)
    OR EXISTS (
      SELECT 1 FROM public.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
    -- OU un token de suivi valide existe pour cette livraison (accès public)
    OR EXISTS (
      SELECT 1 FROM public.suivi_tokens
      WHERE livraison_id = livraisons.id
        AND actif = TRUE
        AND expires_at > NOW()
    )
    -- OU la livraison est en_attente (visible pour les coursiers)
    OR statut = 'en_attente'
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. PERMETTRE LA LECTURE PUBLIQUE DE localisation_coursier VIA TOKEN
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Lecture position via token" ON public.localisation_coursier;
CREATE POLICY "Lecture position via token" ON public.localisation_coursier
  FOR SELECT USING (
    -- Coursier lui-même
    coursier_id = auth.uid()
    -- Client de la livraison
    OR EXISTS (
      SELECT 1 FROM public.livraisons
      WHERE id = localisation_coursier.livraison_id
        AND client_id = auth.uid()
    )
    -- Via token de suivi
    OR EXISTS (
      SELECT 1 FROM public.suivi_tokens
      WHERE livraison_id = localisation_coursier.livraison_id
        AND actif = TRUE
        AND expires_at > NOW()
    )
    -- Admin
    OR EXISTS (
      SELECT 1 FROM public.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────
-- 5. TABLE : api_quota_tracking — suivi quotas APIs cartographiques
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_quota_tracking (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider    TEXT    NOT NULL,   -- 'mapbox' | 'google' | 'osrm'
  annee       INTEGER NOT NULL,
  mois        INTEGER NOT NULL,
  nb_requetes INTEGER NOT NULL DEFAULT 0,
  limite      INTEGER,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, annee, mois)
);

ALTER TABLE public.api_quota_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gère quotas" ON public.api_quota_tracking
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.utilisateurs WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────────
-- 6. VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 009 OK — suivi_tokens créé et RLS configuré';
  RAISE NOTICE 'La page /suivi-tiers/[token] peut maintenant lire sans auth';
END $$;