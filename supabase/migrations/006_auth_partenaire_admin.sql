-- ═══════════════════════════════════════════════════════════════════
-- NYME - Migration 006 : Notifications email admin + création partenaire
-- À exécuter dans Supabase SQL Editor APRÈS les migrations 001 à 005
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. S'ASSURER QUE LE TRIGGER handle_new_user INSÈRE 'partenaire'
-- Le trigger de la migration 005 lit le metadata.role
-- On le recrée pour être sûr qu'il gère bien tous les rôles
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Lire le rôle depuis les metadata, défaut = 'client'
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'client'
  );

  -- Valider que le rôle est acceptable (sécurité)
  IF v_role NOT IN ('client', 'coursier', 'partenaire') THEN
    v_role := 'client';
  END IF;
  -- Note : 'admin' ne peut JAMAIS être créé via ce trigger
  -- Les comptes admin sont créés manuellement par un super-admin

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
      nom        = EXCLUDED.nom,
      email      = EXCLUDED.email,
      role       = EXCLUDED.role,
      updated_at = NOW()
    WHERE public.utilisateurs.role = 'client'; -- Ne pas écraser les rôles existants non-client

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- 2. FONCTION : NOTIFIER ADMIN lors d'un nouveau partenaire inscrit
-- Insère une notification dans la table notifications pour l'admin
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_admin_new_partenaire()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Trouver le premier admin actif
  SELECT id INTO v_admin_id
  FROM public.utilisateurs
  WHERE role = 'admin' AND est_actif = TRUE
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insérer une notification pour l'admin
  INSERT INTO public.notifications (
    user_id, type, titre, message, data, lu, created_at
  ) VALUES (
    v_admin_id,
    'nouveau_partenaire',
    'Nouveau partenaire inscrit',
    format('"%s" (%s) vient de créer un compte partenaire. Plan : %s. En attente de validation.',
      NEW.entreprise, NEW.nom_contact, NEW.plan),
    jsonb_build_object(
      'partenaire_id', NEW.id,
      'entreprise',    NEW.entreprise,
      'email',         NEW.email_pro,
      'plan',          NEW.plan,
      'statut',        NEW.statut
    ),
    FALSE,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur insert dans partenaires
DROP TRIGGER IF EXISTS trg_notify_admin_new_partenaire ON public.partenaires;
CREATE TRIGGER trg_notify_admin_new_partenaire
  AFTER INSERT ON public.partenaires
  FOR EACH ROW
  WHEN (NEW.statut = 'en_attente')  -- Seulement les inscriptions autonomes (pas les créations admin)
  EXECUTE FUNCTION public.notify_admin_new_partenaire();

-- ─────────────────────────────────────────────────────────────────
-- 3. POLITIQUE RLS : L'ADMIN PEUT VOIR TOUTES LES NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin voit toutes les notifications" ON public.notifications;
CREATE POLICY "Admin voit toutes les notifications"
  ON public.notifications FOR ALL
  USING (mon_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────
-- 4. FONCTION UTILITAIRE : Créer un compte admin manuellement
-- À appeler UNE SEULE FOIS pour créer le premier compte admin
-- USAGE : SELECT create_admin_account('admin@nyme.app', 'NomAdmin');
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_to_admin(p_email TEXT, p_nom TEXT DEFAULT 'Admin NYME')
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Trouver l'utilisateur par email dans auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RETURN format('Utilisateur avec email %s introuvable. Créez d''abord le compte via Supabase Auth.', p_email);
  END IF;

  -- Upsert dans utilisateurs avec rôle admin
  INSERT INTO public.utilisateurs (id, nom, email, role, est_verifie, est_actif, created_at, updated_at)
  VALUES (v_user_id, p_nom, lower(trim(p_email)), 'admin', TRUE, TRUE, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin', nom = p_nom, est_verifie = TRUE, est_actif = TRUE, updated_at = NOW();

  RETURN format('✅ Compte admin créé/mis à jour pour %s (ID: %s)', p_email, v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 5. INDEX POUR PERFORMANCE
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_admin
  ON public.notifications(user_id, lu, created_at DESC)
  WHERE lu = FALSE;

CREATE INDEX IF NOT EXISTS idx_partenaires_created
  ON public.partenaires(created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 6. VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────

-- Compter les utilisateurs par rôle
SELECT role, COUNT(*) as nb, COUNT(*) FILTER (WHERE est_actif) as actifs
FROM public.utilisateurs
GROUP BY role ORDER BY role;

-- Instructions de configuration :
-- 
-- ÉTAPE 1 : Désactiver la confirmation email dans Supabase Dashboard
--   Authentication → Settings → Email Auth → décocher "Confirm email"
--
-- ÉTAPE 2 : Créer un compte admin
--   a) Créer le compte via Supabase Dashboard > Authentication > Users > Add User
--   b) Puis exécuter : SELECT public.promote_to_admin('votre@email.com', 'Votre Nom');
--
-- ÉTAPE 3 : Accéder au dashboard admin
--   URL : /admin-x9k2m/login (route secrète — ne pas partager)