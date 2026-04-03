-- ═══════════════════════════════════════════════════════════════════
-- NYME - Script de Correction Finale Supabase
-- Ce script harmonise les rôles, les triggers et les politiques RLS
-- ═══════════════════════════════════════════════════════════════════

-- 1. S'ASSURER QUE LES RÔLES SONT CORRECTS
ALTER TABLE public.utilisateurs
  DROP CONSTRAINT IF EXISTS utilisateurs_role_check;

ALTER TABLE public.utilisateurs
  ADD CONSTRAINT utilisateurs_role_check
  CHECK (role IN ('client', 'coursier', 'admin', 'partenaire'));

-- 2. RENDRE LE TÉLÉPHONE OPTIONNEL (pour les partenaires)
ALTER TABLE public.utilisateurs
  ALTER COLUMN telephone DROP NOT NULL;

-- 3. TRIGGER DE CRÉATION AUTOMATIQUE D'UTILISATEUR (handle_new_user)
-- Ce trigger lit le rôle dans les métadonnées de Supabase Auth
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
  IF v_role NOT IN ('client', 'coursier', 'partenaire', 'admin') THEN
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
      nom        = EXCLUDED.nom,
      email      = EXCLUDED.email,
      role       = EXCLUDED.role,
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. FONCTION mon_role() POUR LES POLITIQUES RLS
CREATE OR REPLACE FUNCTION mon_role()
RETURNS TEXT AS $$
  SELECT role FROM public.utilisateurs WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. FONCTION POUR PROMOUVOIR UN ADMIN
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

-- 6. POLITIQUES RLS SUPPLÉMENTAIRES
-- Permettre à un admin de tout voir/modifier
DROP POLICY IF EXISTS "Admin gère tout sur utilisateurs" ON public.utilisateurs;
CREATE POLICY "Admin gère tout sur utilisateurs"
  ON public.utilisateurs FOR ALL
  USING (mon_role() = 'admin');

DROP POLICY IF EXISTS "Admin gère tout sur partenaires" ON public.partenaires;
CREATE POLICY "Admin gère tout sur partenaires"
  ON public.partenaires FOR ALL
  USING (mon_role() = 'admin');

-- 7. NOTIFICATIONS ADMIN POUR LES NOUVEAUX PARTENAIRES
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  lu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  WHEN (NEW.statut = 'en_attente')
  EXECUTE FUNCTION public.notify_admin_new_partenaire();
