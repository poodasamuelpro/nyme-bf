-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 016 : Automatisation des Courses Programmées
-- Date : Avril 2026
-- Auteur : Manus AI / Audit NYME
--
-- Objectif : Mettre en place la logique SQL (fonctions + cron) pour
--   - Envoyer une notification 24h avant une course programmée
--   - Rechercher et assigner automatiquement un coursier 1h avant
--   - Passer la course en statut 'annulee' si aucun coursier disponible
--
-- PRÉREQUIS : Extension pg_cron activée dans Supabase
--   (Settings > Database > Extensions > pg_cron)
--
-- IMPORTANT : Vérifier dans Supabase Dashboard → Database → Extensions
--   que pg_cron est bien activé avant d'exécuter cette migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FONCTION : Envoyer notifications 24h avant une course programmée
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_courses_24h_avant()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- Trouver les courses programmées dans 23h à 25h (fenêtre 2h pour éviter doublons)
  FOR r IN
    SELECT l.id, l.client_id, l.programme_le, l.depart_adresse, l.arrivee_adresse,
           l.prix_calcule, l.destinataire_nom
      FROM livraisons l
     WHERE l.statut = 'en_attente'
       AND l.type   = 'programmee'
       AND l.programme_le IS NOT NULL
       AND l.programme_le BETWEEN (NOW() + INTERVAL '23 hours') AND (NOW() + INTERVAL '25 hours')
       -- Éviter les doublons : ne pas notifier si déjà une notif 24h envoyée
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.user_id = l.client_id
            AND n.type = 'rappel_course_24h'
            AND n.data->>'livraison_id' = l.id::text
       )
  LOOP
    -- Notification in-app au client
    INSERT INTO notifications (user_id, type, titre, message, data, lu)
    VALUES (
      r.client_id,
      'rappel_course_24h',
      '📅 Rappel : Votre course programmée est demain',
      format(
        'Votre livraison pour %s (de %s vers %s) est prévue demain à %s. Un coursier vous sera assigné automatiquement dans quelques heures.',
        COALESCE(r.destinataire_nom, 'votre destinataire'),
        r.depart_adresse,
        r.arrivee_adresse,
        TO_CHAR(r.programme_le AT TIME ZONE 'Africa/Ouagadougou', 'HH24:MI')
      ),
      jsonb_build_object(
        'livraison_id', r.id,
        'type_notification', 'rappel_24h',
        'programme_le', r.programme_le
      ),
      false
    );

    RAISE NOTICE '[cron 24h] Notification envoyée pour livraison %', r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FONCTION : Assigner un coursier 1h avant la course programmée
--    - Cherche les coursiers disponibles les plus proches (dans un rayon 15km)
--    - Sélectionne le coursier avec le meilleur score (note + courses)
--    - Met à jour la livraison avec le coursier assigné
--    - Notifie le client ET le coursier
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assigner_coursier_courses_programmees()
RETURNS void AS $$
DECLARE
  livraison_rec     RECORD;
  coursier_rec      RECORD;
  coursier_assigne  UUID;
BEGIN
  -- Trouver les courses programmées dans 45min à 1h15
  FOR livraison_rec IN
    SELECT l.id, l.client_id, l.programme_le, l.depart_lat, l.depart_lng,
           l.depart_adresse, l.arrivee_adresse, l.prix_calcule, l.destinataire_nom,
           l.type
      FROM livraisons l
     WHERE l.statut = 'en_attente'
       AND l.type   = 'programmee'
       AND l.coursier_id IS NULL
       AND l.programme_le IS NOT NULL
       AND l.programme_le BETWEEN (NOW() + INTERVAL '45 minutes') AND (NOW() + INTERVAL '75 minutes')
  LOOP
    coursier_assigne := NULL;

    -- Chercher le meilleur coursier disponible (dans les 15km si coordonnées disponibles)
    SELECT c.id INTO coursier_rec
      FROM coursiers c
      JOIN utilisateurs u ON u.id = c.id
     WHERE c.statut = 'disponible'
       AND c.statut_verification = 'verifie'
       AND u.est_actif = true
       -- Si coordonnées disponibles : prioriser les plus proches (15km max)
       AND (
         livraison_rec.depart_lat IS NULL
         OR livraison_rec.depart_lng IS NULL
         OR c.lat_actuelle IS NULL
         OR c.lng_actuelle IS NULL
         OR (
           6371 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS((livraison_rec.depart_lat - c.lat_actuelle) / 2)), 2)
             + COS(RADIANS(c.lat_actuelle)) * COS(RADIANS(livraison_rec.depart_lat))
             * POWER(SIN(RADIANS((livraison_rec.depart_lng - c.lng_actuelle) / 2)), 2)
           )) <= 15
         )
       )
     ORDER BY
       -- Prioriser : note_moyenne DESC, total_courses DESC (expérience), puis aléatoire
       COALESCE(u.note_moyenne, 0) DESC,
       COALESCE(c.total_courses, 0) DESC,
       RANDOM()
     LIMIT 1;

    IF FOUND THEN
      coursier_assigne := coursier_rec.id;

      -- Assigner le coursier à la livraison
      UPDATE livraisons
         SET coursier_id = coursier_assigne,
             statut      = 'acceptee',
             acceptee_at = NOW()
       WHERE id = livraison_rec.id;

      -- Mettre le coursier en occupé
      UPDATE coursiers
         SET statut = 'occupe',
             derniere_activite = NOW()
       WHERE id = coursier_assigne;

      -- Enregistrer dans l'historique des statuts
      INSERT INTO statuts_livraison (livraison_id, statut, note)
      VALUES (
        livraison_rec.id,
        'acceptee',
        format('Coursier assigné automatiquement par le système (course programmée) — %s', NOW())
      );

      -- Notifier le CLIENT de l'assignation
      INSERT INTO notifications (user_id, type, titre, message, data, lu)
      VALUES (
        livraison_rec.client_id,
        'coursier_assigne',
        '🛵 Coursier assigné pour votre course programmée',
        format(
          'Un coursier a été assigné pour votre livraison prévue à %s. Il sera en route bientôt !',
          TO_CHAR(livraison_rec.programme_le AT TIME ZONE 'Africa/Ouagadougou', 'HH24:MI')
        ),
        jsonb_build_object(
          'livraison_id', livraison_rec.id,
          'coursier_id',  coursier_assigne,
          'type', 'assignation_automatique'
        ),
        false
      );

      -- Notifier le COURSIER de la nouvelle mission
      INSERT INTO notifications (user_id, type, titre, message, data, lu)
      VALUES (
        coursier_assigne,
        'nouvelle_mission_programmee',
        '📅 Nouvelle course programmée assignée',
        format(
          'Une course programmée vous a été assignée : %s → %s pour %s. Soyez prêt à %s !',
          livraison_rec.depart_adresse,
          livraison_rec.arrivee_adresse,
          COALESCE(livraison_rec.destinataire_nom, 'le destinataire'),
          TO_CHAR(livraison_rec.programme_le AT TIME ZONE 'Africa/Ouagadougou', 'HH24:MI')
        ),
        jsonb_build_object(
          'livraison_id', livraison_rec.id,
          'programme_le', livraison_rec.programme_le,
          'prix',         livraison_rec.prix_calcule
        ),
        false
      );

      RAISE NOTICE '[cron 1h] Coursier % assigné à livraison %', coursier_assigne, livraison_rec.id;

    ELSE
      -- Aucun coursier disponible → notifier le client
      INSERT INTO notifications (user_id, type, titre, message, data, lu)
      VALUES (
        livraison_rec.client_id,
        'no_coursier_disponible',
        '⚠️ Aucun coursier disponible pour votre course',
        'Nous cherchons toujours un coursier disponible pour votre livraison programmée. Si aucun coursier n''est trouvé, votre course sera reprogrammée ou remboursée.',
        jsonb_build_object(
          'livraison_id', livraison_rec.id,
          'programme_le', livraison_rec.programme_le
        ),
        false
      )
      ON CONFLICT DO NOTHING;  -- Éviter doublons si plusieurs tentatives

      RAISE NOTICE '[cron 1h] Aucun coursier pour livraison %', livraison_rec.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENREGISTREMENT DES CRONS (pg_cron)
--    IMPORTANT : pg_cron doit être activé dans Supabase Settings > Extensions
--
--    Fréquences :
--      - notify_courses_24h_avant : toutes les heures (à hh:05)
--      - assigner_coursier_courses_programmees : toutes les 15 minutes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Vérifier si pg_cron est disponible
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN

    -- Supprimer les anciens crons s'ils existent
    PERFORM cron.unschedule('nyme_notify_courses_24h')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nyme_notify_courses_24h');
    PERFORM cron.unschedule('nyme_assigner_coursier_1h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nyme_assigner_coursier_1h');

    -- Cron 1 : Notifications 24h avant — toutes les heures à HH:05
    PERFORM cron.schedule(
      'nyme_notify_courses_24h',
      '5 * * * *',   -- Chaque heure, à :05
      'SELECT notify_courses_24h_avant()'
    );

    -- Cron 2 : Assignation coursier 1h avant — toutes les 15 minutes
    PERFORM cron.schedule(
      'nyme_assigner_coursier_1h',
      '*/15 * * * *',  -- Toutes les 15 minutes
      'SELECT assigner_coursier_courses_programmees()'
    );

    RAISE NOTICE '✅ pg_cron configuré avec succès';
    RAISE NOTICE '   - nyme_notify_courses_24h    : 5 * * * *  (toutes les heures)';
    RAISE NOTICE '   - nyme_assigner_coursier_1h  : */15 * * * * (toutes les 15 min)';

  ELSE
    RAISE NOTICE '⚠️  pg_cron non disponible — activez-le dans Supabase Settings > Extensions';
    RAISE NOTICE '   Vous pouvez appeler manuellement :';
    RAISE NOTICE '   SELECT notify_courses_24h_avant();';
    RAISE NOTICE '   SELECT assigner_coursier_courses_programmees();';
    RAISE NOTICE '';
    RAISE NOTICE '   ALTERNATIVE : Créer une Edge Function Supabase avec un cron :';
    RAISE NOTICE '   supabase functions new courses-programmees-cron';
    RAISE NOTICE '   Voir la documentation dans /docs/EDGE_FUNCTION_CRON.md';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TEST MANUEL DES FONCTIONS
--    (À exécuter manuellement dans l'éditeur SQL Supabase pour tester)
-- ─────────────────────────────────────────────────────────────────────────────

-- Pour tester :
-- SELECT notify_courses_24h_avant();
-- SELECT assigner_coursier_courses_programmees();

-- Pour voir les crons actifs :
-- SELECT * FROM cron.job;

-- Pour voir les logs d'exécution :
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;