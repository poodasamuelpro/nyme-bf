-- supabase/migrations/012_blocages_photos_colis.sql
-- NOUVEAU FICHIER MIGRATION
-- Ajoute :
--   1. Table blocages (fonctionnalité blocage utilisateur)
--   2. Bucket Supabase Storage photos-colis (pour les photos du colis)
--   3. Bucket chat-photos (pour les photos dans le chat)
--   4. RLS pour les nouvelles tables

-- ═══════════════════════════════════════════════════════════════════
-- 1. TABLE : blocages
-- Permet à un utilisateur de bloquer un autre (client <-> coursier)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blocages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloqueur_id  uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  bloque_id    uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  motif        text,
  created_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE(bloqueur_id, bloque_id)
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_blocages_bloqueur ON public.blocages(bloqueur_id);
CREATE INDEX IF NOT EXISTS idx_blocages_bloque   ON public.blocages(bloque_id);

-- RLS
ALTER TABLE public.blocages ENABLE ROW LEVEL SECURITY;

-- Un utilisateur peut voir ses propres blocages
CREATE POLICY "blocages_select_own" ON public.blocages
  FOR SELECT USING (auth.uid() = bloqueur_id);

-- Un utilisateur peut bloquer quelqu'un
CREATE POLICY "blocages_insert_own" ON public.blocages
  FOR INSERT WITH CHECK (auth.uid() = bloqueur_id);

-- Un utilisateur peut débloquer (supprimer son propre blocage)
CREATE POLICY "blocages_delete_own" ON public.blocages
  FOR DELETE USING (auth.uid() = bloqueur_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Ajout colonne instructions à livraisons (si pas déjà présente)
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'livraisons' AND column_name = 'instructions'
  ) THEN
    ALTER TABLE public.livraisons ADD COLUMN instructions text;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Fonction helper — vérifier si un utilisateur est bloqué
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.est_bloque(
  p_bloqueur_id uuid,
  p_bloque_id   uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocages
    WHERE (bloqueur_id = p_bloqueur_id AND bloque_id = p_bloque_id)
       OR (bloqueur_id = p_bloque_id   AND bloque_id = p_bloqueur_id)
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Commentaires
-- ═══════════════════════════════════════════════════════════════════
COMMENT ON TABLE  public.blocages IS 'Blocages entre utilisateurs (client ↔ coursier)';
COMMENT ON COLUMN public.blocages.bloqueur_id IS 'Utilisateur qui bloque';
COMMENT ON COLUMN public.blocages.bloque_id   IS 'Utilisateur bloqué';

-- ═══════════════════════════════════════════════════════════════════
-- NOTE : Buckets Supabase Storage à créer manuellement via dashboard ou CLI
-- ═══════════════════════════════════════════════════════════════════
-- npx supabase storage create photos-colis  --public
-- npx supabase storage create chat-photos   --public
-- npx supabase storage create avatars       --public  (si pas déjà créé)
-- ═══════════════════════════════════════════════════════════════════