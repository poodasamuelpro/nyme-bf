-- ═══════════════════════════════════════════════════════════════════
-- NYME - Migration 005 : Corrections compatibilité + désactivation email confirm
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. DÉSACTIVER LA CONFIRMATION EMAIL
-- Cette commande SQL ne suffit pas — faire aussi dans le Dashboard :
-- Authentication → Settings → Email Auth → décocher "Confirm email"
-- ─────────────────────────────────────────────────────────────────

-- Confirmer tous les utilisateurs existants non confirmés
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- 2. TRIGGER AUTO-CRÉATION UTILISATEUR
-- Crée automatiquement l'entrée dans "utilisateurs" quand un compte
-- est créé via Supabase Auth (évite d'avoir à le faire manuellement)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer seulement si pas déjà présent
  INSERT INTO public.utilisateurs (
    id, nom, email, telephone, role, est_verifie, est_actif, created_at, updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    FALSE,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- 3. CORRIGER LA POLICY ADMIN SUR PARTENAIRES
-- La migration 004 utilise mon_role() qui est défini dans 002
-- Vérifier que mon_role() existe bien
-- ─────────────────────────────────────────────────────────────────

-- Recréer mon_role() si absent
CREATE OR REPLACE FUNCTION mon_role()
RETURNS TEXT AS $$
  SELECT role FROM public.utilisateurs WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────────
-- 4. POLITIQUE RLS POUR LES PARTENAIRES — lecture du profil utilisateur
-- Un partenaire doit pouvoir lire son propre profil dans utilisateurs
-- ─────────────────────────────────────────────────────────────────

-- Vérifier que la policy partenaire sur utilisateurs existe
DROP POLICY IF EXISTS "Partenaire voit son profil utilisateur" ON public.utilisateurs;
CREATE POLICY "Partenaire voit son profil utilisateur"
  ON public.utilisateurs
  FOR SELECT
  USING (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 5. CONTRAINTE telephone NULLABLE dans utilisateurs
-- Le signup partenaire peut ne pas fournir de téléphone
-- ─────────────────────────────────────────────────────────────────

-- Retirer la contrainte NOT NULL sur telephone si elle existe
ALTER TABLE public.utilisateurs
  ALTER COLUMN telephone DROP NOT NULL;

-- Mettre une valeur par défaut vide si nécessaire
ALTER TABLE public.utilisateurs
  ALTER COLUMN telephone SET DEFAULT '';

-- ─────────────────────────────────────────────────────────────────
-- 6. VÉRIFICATION
-- ─────────────────────────────────────────────────────────────────

-- Voir les rôles disponibles
SELECT DISTINCT role, COUNT(*) as nb
FROM public.utilisateurs
GROUP BY role
ORDER BY role;

-- Voir les partenaires
SELECT id, entreprise, statut, plan, livraisons_mois, livraisons_max
FROM public.partenaires
ORDER BY created_at DESC
LIMIT 10;
