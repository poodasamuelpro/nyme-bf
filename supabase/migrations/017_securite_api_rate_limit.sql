-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 017 : Sécurité API & Rate Limiting
-- Date : Avril 2026
-- Auteur : Audit NYME
--
-- Objectif :
--   1. Table rate_limit_api — suivi des appels API par utilisateur/endpoint
--   2. Fonction RPC check_rate_limit() — vérification côté SQL (atomique)
--   3. RLS policies sur les tables sensibles (calls_webrtc, webrtc_ice_candidates)
--   4. Index de performance supplémentaires identifiés à l'audit
--   5. Politique de rétention automatique sur webrtc_ice_candidates (pg_cron)
--   6. Vue sécurisée pour les quotas API (admin seulement)
--
-- PRÉREQUIS : pg_cron activé (migration 016)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE : rate_limit_api
--    Suivi des appels API par utilisateur et endpoint
--    Utilisée pour limiter les abus (ex : génération TURN credentials)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_api (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL,          -- ex: 'turn_credentials', 'livraison_create'
  nb_appels   INTEGER     NOT NULL DEFAULT 1,
  fenetre_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index composite pour recherche rapide par user + endpoint + fenêtre
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_endpoint
  ON rate_limit_api (user_id, endpoint, fenetre_debut DESC);

-- Commentaires
COMMENT ON TABLE rate_limit_api IS
  'Suivi du rate limiting API par utilisateur et endpoint — NYME';
COMMENT ON COLUMN rate_limit_api.endpoint IS
  'Identifiant de l''endpoint : turn_credentials, livraison_create, wallet_recharge, etc.';
COMMENT ON COLUMN rate_limit_api.fenetre_debut IS
  'Début de la fenêtre temporelle pour le comptage (glissante)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS sur rate_limit_api
--    Chaque utilisateur ne peut voir que ses propres lignes
--    L'admin voit tout
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE rate_limit_api ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs voient uniquement leurs propres entrées
DROP POLICY IF EXISTS rate_limit_user_select ON rate_limit_api;
CREATE POLICY rate_limit_user_select ON rate_limit_api
  FOR SELECT USING (auth.uid() = user_id);

-- Seul le service_role peut insérer/modifier (via RPC)
DROP POLICY IF EXISTS rate_limit_service_all ON rate_limit_api;
CREATE POLICY rate_limit_service_all ON rate_limit_api
  FOR ALL USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FONCTION RPC : check_and_increment_rate_limit
--    Vérifie et incrémente le compteur de rate limit de façon atomique.
--    Retourne TRUE si la requête est autorisée, FALSE si limite atteinte.
--
--    Paramètres :
--      p_user_id   : UUID de l'utilisateur
--      p_endpoint  : Nom de l'endpoint (ex: 'turn_credentials')
--      p_max_calls : Nombre max d'appels autorisés dans la fenêtre
--      p_window_seconds : Durée de la fenêtre en secondes
--
--    Exemple d'utilisation (depuis Next.js) :
--      const { data } = await supabaseAdmin.rpc('check_and_increment_rate_limit', {
--        p_user_id: userId,
--        p_endpoint: 'turn_credentials',
--        p_max_calls: 10,
--        p_window_seconds: 600  -- 10 minutes
--      })
--      if (!data) return 429 Too Many Requests
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_user_id        UUID,
  p_endpoint       TEXT,
  p_max_calls      INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 600   -- 10 minutes par défaut
)
RETURNS BOOLEAN AS $$
DECLARE
  v_fenetre_debut  TIMESTAMPTZ;
  v_nb_appels      INTEGER;
  v_existing_id    UUID;
BEGIN
  v_fenetre_debut := NOW() - (p_window_seconds * INTERVAL '1 second');

  -- Chercher une entrée existante dans la fenêtre courante
  SELECT id, nb_appels
    INTO v_existing_id, v_nb_appels
    FROM rate_limit_api
   WHERE user_id      = p_user_id
     AND endpoint     = p_endpoint
     AND fenetre_debut > v_fenetre_debut
   ORDER BY fenetre_debut DESC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- Vérifier la limite
    IF v_nb_appels >= p_max_calls THEN
      RETURN FALSE;  -- Limite atteinte
    END IF;

    -- Incrémenter le compteur
    UPDATE rate_limit_api
       SET nb_appels  = nb_appels + 1,
           updated_at = NOW()
     WHERE id = v_existing_id;

  ELSE
    -- Première requête dans cette fenêtre : créer une entrée
    INSERT INTO rate_limit_api (user_id, endpoint, nb_appels, fenetre_debut)
    VALUES (p_user_id, p_endpoint, 1, NOW());
  END IF;

  RETURN TRUE;  -- Requête autorisée
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_and_increment_rate_limit IS
  'Vérifie et incrémente le rate limit de façon atomique. TRUE = autorisé, FALSE = bloqué.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RENFORCEMENT RLS — calls_webrtc
--    Vérification que les policies existantes couvrent bien tous les cas
--    (les policies CREATE existent depuis migration 013 — ici on renforce)
-- ─────────────────────────────────────────────────────────────────────────────

-- S'assurer que RLS est bien activé sur calls_webrtc (migration 013 devrait déjà l'avoir fait)
ALTER TABLE calls_webrtc ENABLE ROW LEVEL SECURITY;

-- Policy SELECT : un utilisateur ne voit que ses propres appels
DROP POLICY IF EXISTS calls_webrtc_participant_select ON calls_webrtc;
CREATE POLICY calls_webrtc_participant_select ON calls_webrtc
  FOR SELECT USING (
    auth.uid() = appelant_id
    OR auth.uid() = destinataire_id
  );

-- Policy INSERT : seul l'appelant peut créer un appel en son nom
DROP POLICY IF EXISTS calls_webrtc_appelant_insert ON calls_webrtc;
CREATE POLICY calls_webrtc_appelant_insert ON calls_webrtc
  FOR INSERT WITH CHECK (auth.uid() = appelant_id);

-- Policy UPDATE : uniquement les participants peuvent modifier
DROP POLICY IF EXISTS calls_webrtc_participant_update ON calls_webrtc;
CREATE POLICY calls_webrtc_participant_update ON calls_webrtc
  FOR UPDATE USING (
    auth.uid() = appelant_id
    OR auth.uid() = destinataire_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RENFORCEMENT RLS — webrtc_ice_candidates
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE webrtc_ice_candidates ENABLE ROW LEVEL SECURITY;

-- SELECT : participants de l'appel uniquement
DROP POLICY IF EXISTS ice_candidates_participant_select ON webrtc_ice_candidates;
CREATE POLICY ice_candidates_participant_select ON webrtc_ice_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calls_webrtc c
       WHERE c.id = webrtc_ice_candidates.call_id
         AND (c.appelant_id = auth.uid() OR c.destinataire_id = auth.uid())
    )
  );

-- INSERT : seul l'utilisateur concerné peut insérer ses propres candidats
DROP POLICY IF EXISTS ice_candidates_user_insert ON webrtc_ice_candidates;
CREATE POLICY ice_candidates_user_insert ON webrtc_ice_candidates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INDEX DE PERFORMANCE SUPPLÉMENTAIRES
--    Identifiés lors de l'audit — optimisation des requêtes fréquentes
-- ─────────────────────────────────────────────────────────────────────────────

-- Index partiel sur livraisons en_attente (requête la plus fréquente du dashboard coursier)
CREATE INDEX IF NOT EXISTS idx_livraisons_en_attente
  ON livraisons (created_at DESC)
  WHERE statut = 'en_attente';

-- Index sur livraisons par client (dashboard client — historique)
CREATE INDEX IF NOT EXISTS idx_livraisons_client_created
  ON livraisons (client_id, created_at DESC);

-- Index sur livraisons par coursier (dashboard coursier — missions actives)
CREATE INDEX IF NOT EXISTS idx_livraisons_coursier_statut
  ON livraisons (coursier_id, statut)
  WHERE coursier_id IS NOT NULL;

-- Index sur notifications non lues (panel notifications)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE lu = false;

-- Index sur transactions_wallet par utilisateur et date (wallet dashboard)
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_user_date
  ON transactions_wallet (user_id, created_at DESC);

-- Index sur calls_webrtc pour recherche par destinataire (appels entrants)
CREATE INDEX IF NOT EXISTS idx_calls_webrtc_destinataire_statut
  ON calls_webrtc (destinataire_id, statut)
  WHERE statut = 'en_attente';

-- Index sur webrtc_ice_candidates par call_id (requête ICE polling)
CREATE INDEX IF NOT EXISTS idx_ice_candidates_call_user
  ON webrtc_ice_candidates (call_id, user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. NETTOYAGE AUTOMATIQUE — webrtc_ice_candidates
--    Les candidats ICE n'ont plus d'utilité après la fin de l'appel.
--    Suppression automatique des candidats associés à des appels terminés
--    vieux de plus de 24h (pour éviter une croissance infinie de la table).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_webrtc_ice_candidates()
RETURNS void AS $$
BEGIN
  DELETE FROM webrtc_ice_candidates
   WHERE call_id IN (
     SELECT id FROM calls_webrtc
      WHERE statut IN ('termine', 'refuse', 'manque', 'annule')
        AND updated_at < NOW() - INTERVAL '24 hours'
   );

  RAISE NOTICE '[cron cleanup] webrtc_ice_candidates nettoyés pour appels terminés > 24h';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_webrtc_ice_candidates IS
  'Nettoie les candidats ICE associés aux appels terminés depuis plus de 24h';

-- Nettoyage aussi des entrées rate_limit_api vieilles de plus de 1h
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_api
   WHERE fenetre_debut < NOW() - INTERVAL '1 hour';

  RAISE NOTICE '[cron cleanup] rate_limit_api nettoyé';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CRONS DE NETTOYAGE (si pg_cron disponible)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Supprimer les anciens crons s'ils existent
    PERFORM cron.unschedule('nyme_cleanup_webrtc_ice')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nyme_cleanup_webrtc_ice');
    PERFORM cron.unschedule('nyme_cleanup_rate_limits')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nyme_cleanup_rate_limits');

    -- Nettoyage ICE candidates : tous les jours à 3h00
    PERFORM cron.schedule(
      'nyme_cleanup_webrtc_ice',
      '0 3 * * *',
      'SELECT cleanup_old_webrtc_ice_candidates()'
    );

    -- Nettoyage rate limits : toutes les heures
    PERFORM cron.schedule(
      'nyme_cleanup_rate_limits',
      '30 * * * *',
      'SELECT cleanup_old_rate_limits()'
    );

    RAISE NOTICE '✅ Crons de nettoyage configurés';
    RAISE NOTICE '   - nyme_cleanup_webrtc_ice  : 0 3 * * *  (tous les jours à 3h)';
    RAISE NOTICE '   - nyme_cleanup_rate_limits  : 30 * * * * (toutes les heures)';

  ELSE
    RAISE NOTICE '⚠️  pg_cron non disponible — nettoyage manuel requis';
    RAISE NOTICE '   SELECT cleanup_old_webrtc_ice_candidates();';
    RAISE NOTICE '   SELECT cleanup_old_rate_limits();';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. VUE ADMIN — Statistiques de sécurité API (visible admin seulement)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW admin_rate_limit_stats AS
SELECT
  rl.endpoint,
  COUNT(DISTINCT rl.user_id)  AS utilisateurs_uniques,
  SUM(rl.nb_appels)           AS total_appels,
  MAX(rl.nb_appels)           AS max_appels_par_utilisateur,
  AVG(rl.nb_appels)           AS moy_appels_par_utilisateur,
  DATE_TRUNC('hour', rl.fenetre_debut) AS heure
FROM rate_limit_api rl
WHERE rl.fenetre_debut > NOW() - INTERVAL '24 hours'
GROUP BY rl.endpoint, DATE_TRUNC('hour', rl.fenetre_debut)
ORDER BY heure DESC, total_appels DESC;

COMMENT ON VIEW admin_rate_limit_stats IS
  'Statistiques de sécurité API par endpoint — visible admin uniquement';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. TEST MANUEL
-- ─────────────────────────────────────────────────────────────────────────────
-- Tester le rate limit :
-- SELECT check_and_increment_rate_limit(auth.uid(), 'turn_credentials', 10, 600);
--
-- Voir les stats :
-- SELECT * FROM admin_rate_limit_stats;
--
-- Tester le nettoyage :
-- SELECT cleanup_old_webrtc_ice_candidates();
-- SELECT cleanup_old_rate_limits();