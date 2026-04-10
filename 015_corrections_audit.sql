-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 015 : Corrections Audit NYME
-- Date : Avril 2026
-- Auteur : Manus AI / Audit NYME
--
-- Corrections incluses :
--   1. Trigger automatique calcul note_moyenne dans utilisateurs
--   2. Champ preuve_livraison_url dans la table livraisons
--   3. Index de performance sur evaluations
--   4. Bucket Supabase Storage pour les preuves de livraison
--   5. Policy RLS pour bucket preuves-livraison
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CHAMP PREUVE DE LIVRAISON (optionnel, recommandé)
--    Stocke l'URL de la photo prise par le coursier lors de la remise du colis
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE livraisons
  ADD COLUMN IF NOT EXISTS preuve_livraison_url TEXT;

COMMENT ON COLUMN livraisons.preuve_livraison_url IS
  'URL de la photo de preuve de livraison uploadée par le coursier (optionnel, recommandé)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER AUTOMATIQUE : CALCUL NOTE MOYENNE
--    Recalcule note_moyenne dans utilisateurs après chaque INSERT/DELETE
--    dans la table evaluations.
--
--    POURQUOI : L'audit indique que note_moyenne n'était pas mis à jour
--    automatiquement. Ce trigger garantit la cohérence en temps réel.
--
--    FORMULE : Moyenne des notes sur toutes les évaluations reçues,
--    arrondie à 2 décimales.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fonction déclenchée après INSERT/UPDATE/DELETE sur evaluations
CREATE OR REPLACE FUNCTION update_note_moyenne_utilisateur()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id  UUID;
  v_moyenne  NUMERIC(3,2);
BEGIN
  -- Identifier l'utilisateur dont la note change
  IF (TG_OP = 'DELETE') THEN
    v_user_id := OLD.evalue_id;
  ELSE
    v_user_id := NEW.evalue_id;
  END IF;

  -- Calculer la nouvelle moyenne (ignorer les notes hors [1,5])
  SELECT COALESCE(ROUND(AVG(note::NUMERIC)::NUMERIC, 2), 0.00)
    INTO v_moyenne
    FROM evaluations
   WHERE evalue_id = v_user_id
     AND note BETWEEN 1 AND 5;

  -- Mettre à jour la table utilisateurs
  UPDATE utilisateurs
     SET note_moyenne = v_moyenne,
         updated_at   = NOW()
   WHERE id = v_user_id;

  -- Log pour debugging (optionnel, à supprimer en production)
  -- RAISE NOTICE '[trigger] note_moyenne pour % = %', v_user_id, v_moyenne;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà (idempotent)
DROP TRIGGER IF EXISTS trg_update_note_moyenne ON evaluations;

-- Créer le trigger sur INSERT, UPDATE et DELETE
CREATE TRIGGER trg_update_note_moyenne
  AFTER INSERT OR UPDATE OR DELETE ON evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_note_moyenne_utilisateur();

COMMENT ON FUNCTION update_note_moyenne_utilisateur() IS
  'Trigger NYME : recalcule note_moyenne dans utilisateurs après chaque évaluation';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RECALCUL INITIAL DES NOTES MOYENNES
--    Met à jour les notes existantes pour les utilisateurs déjà évalués.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE utilisateurs u
   SET note_moyenne = COALESCE((
         SELECT ROUND(AVG(e.note::NUMERIC)::NUMERIC, 2)
           FROM evaluations e
          WHERE e.evalue_id = u.id
            AND e.note BETWEEN 1 AND 5
       ), 0.00),
       updated_at = NOW()
 WHERE id IN (
   SELECT DISTINCT evalue_id FROM evaluations
 );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Index sur evalue_id pour accélérer le calcul de la moyenne
CREATE INDEX IF NOT EXISTS idx_evaluations_evalue_id
  ON evaluations (evalue_id);

-- Index sur livraison_id pour les évaluations liées à une course
CREATE INDEX IF NOT EXISTS idx_evaluations_livraison_id
  ON evaluations (livraison_id);

-- Index sur note pour filtrage rapide des notes valides
CREATE INDEX IF NOT EXISTS idx_evaluations_note
  ON evaluations (note)
  WHERE note BETWEEN 1 AND 5;

-- Index composite pour les livraisons programmées (courses_programmees cron)
CREATE INDEX IF NOT EXISTS idx_livraisons_programme_statut
  ON livraisons (programme_le, statut)
  WHERE statut = 'en_attente' AND programme_le IS NOT NULL;

-- Index sur notifications pour les requêtes non-lues par user
CREATE INDEX IF NOT EXISTS idx_notifications_user_lu
  ON notifications (user_id, lu, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. POLITIQUE RLS pour preuves-livraison (Storage)
--    Le bucket est géré depuis le dashboard Supabase Storage.
--    Ces politiques SQL assurent la sécurité d'accès.
-- ─────────────────────────────────────────────────────────────────────────────

-- IMPORTANT : Créer d'abord le bucket via le dashboard Supabase Storage :
--   Nom du bucket : preuves-livraison
--   Type          : Private (accès sécurisé)
--   Max file size : 10 MB
--   Allowed MIME  : image/jpeg, image/png, image/webp

-- Policy : Coursier peut uploader sa preuve
-- (À exécuter APRÈS création du bucket dans le dashboard)
DO $$
BEGIN
  -- Vérifier si la table storage.objects existe (Supabase)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN

    -- Upload : seul le coursier assigné peut uploader
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = 'coursier_upload_preuve_livraison'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY coursier_upload_preuve_livraison ON storage.objects
          FOR INSERT TO authenticated
          WITH CHECK (
            bucket_id = 'preuves-livraison'
            AND auth.uid()::text = (storage.foldername(name))[2]
          );
      $policy$;
    END IF;

    -- Lecture : client ET coursier peuvent voir la preuve
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = 'client_coursier_read_preuve'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY client_coursier_read_preuve ON storage.objects
          FOR SELECT TO authenticated
          USING (
            bucket_id = 'preuves-livraison'
            AND (
              -- Le coursier qui a uploadé
              auth.uid()::text = (storage.foldername(name))[2]
              OR
              -- Le service admin (service_role bypass RLS)
              auth.role() = 'service_role'
            )
          );
      $policy$;
    END IF;

  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. POLITIQUE RLS pour chat-photos (Storage) — si manquante
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = 'authenticated_upload_chat_photos'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY authenticated_upload_chat_photos ON storage.objects
          FOR INSERT TO authenticated
          WITH CHECK (bucket_id = 'chat-photos');
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname = 'authenticated_read_chat_photos'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY authenticated_read_chat_photos ON storage.objects
          FOR SELECT TO authenticated
          USING (bucket_id = 'chat-photos');
      $policy$;
    END IF;

  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. VÉRIFICATION FINALE
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_trigger_exists  BOOLEAN;
  v_column_exists   BOOLEAN;
  v_eval_count      INTEGER;
  v_users_updated   INTEGER;
BEGIN
  -- Vérifier le trigger
  SELECT EXISTS(
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_name = 'trg_update_note_moyenne'
       AND event_object_table = 'evaluations'
  ) INTO v_trigger_exists;

  -- Vérifier la colonne preuve
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'livraisons'
       AND column_name = 'preuve_livraison_url'
  ) INTO v_column_exists;

  -- Compter les évaluations
  SELECT COUNT(*) INTO v_eval_count FROM evaluations;

  -- Compter les utilisateurs avec note > 0
  SELECT COUNT(*) INTO v_users_updated FROM utilisateurs WHERE note_moyenne > 0;

  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE 'Migration 015 — Résultats :';
  RAISE NOTICE '  ✅ Trigger note_moyenne créé : %',   v_trigger_exists;
  RAISE NOTICE '  ✅ Colonne preuve_livraison_url : %', v_column_exists;
  RAISE NOTICE '  📊 Évaluations en base : %',          v_eval_count;
  RAISE NOTICE '  📊 Utilisateurs avec note > 0 : %',   v_users_updated;
  RAISE NOTICE '═══════════════════════════════════════════════';
END $$;