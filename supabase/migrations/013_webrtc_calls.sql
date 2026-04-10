-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 013 — APPELS WEBRTC via Supabase Realtime
-- Table : calls_webrtc  (signalisation WebRTC entre client et coursier)
-- Route d'enregistrement : supabase/migrations/013_webrtc_calls.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Table principale des appels
CREATE TABLE IF NOT EXISTS public.calls_webrtc (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  livraison_id     UUID        REFERENCES public.livraisons(id) ON DELETE SET NULL,
  appelant_id      UUID        NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  appelant_role    TEXT        NOT NULL CHECK (appelant_role IN ('client', 'coursier', 'admin')),
  destinataire_id  UUID        NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  statut           TEXT        NOT NULL DEFAULT 'en_attente'
                               CHECK (statut IN ('en_attente','en_cours','termine','refuse','manque','annule')),
  offer_sdp        TEXT,        -- SDP de l'offre WebRTC (appelant)
  answer_sdp       TEXT,        -- SDP de la réponse WebRTC (destinataire)
  ice_candidates   JSONB       DEFAULT '[]'::JSONB,  -- candidats ICE agrégés
  duree_secondes   INTEGER,    -- durée totale de l'appel en secondes
  debut_at         TIMESTAMPTZ,
  fin_at           TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table des candidats ICE (séparée pour mises à jour rapides Realtime)
CREATE TABLE IF NOT EXISTS public.webrtc_ice_candidates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id    UUID        NOT NULL REFERENCES public.calls_webrtc(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  candidate  TEXT        NOT NULL,  -- JSON stringifié du RTCIceCandidate
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index de performance
CREATE INDEX IF NOT EXISTS idx_calls_webrtc_destinataire
  ON public.calls_webrtc(destinataire_id, statut);

CREATE INDEX IF NOT EXISTS idx_calls_webrtc_appelant
  ON public.calls_webrtc(appelant_id);

CREATE INDEX IF NOT EXISTS idx_calls_webrtc_livraison
  ON public.calls_webrtc(livraison_id);

CREATE INDEX IF NOT EXISTS idx_calls_webrtc_created_at
  ON public.calls_webrtc(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ice_candidates_call
  ON public.webrtc_ice_candidates(call_id, user_id);

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_calls_webrtc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calls_webrtc_updated_at ON public.calls_webrtc;
CREATE TRIGGER trg_calls_webrtc_updated_at
  BEFORE UPDATE ON public.calls_webrtc
  FOR EACH ROW EXECUTE FUNCTION public.update_calls_webrtc_updated_at();

-- 5. Trigger : enregistrer durée automatiquement quand fin_at est renseigné
CREATE OR REPLACE FUNCTION public.calc_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fin_at IS NOT NULL AND NEW.debut_at IS NOT NULL THEN
    NEW.duree_secondes := EXTRACT(EPOCH FROM (NEW.fin_at - NEW.debut_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_call_duration ON public.calls_webrtc;
CREATE TRIGGER trg_calc_call_duration
  BEFORE UPDATE OF fin_at ON public.calls_webrtc
  FOR EACH ROW EXECUTE FUNCTION public.calc_call_duration();

-- 6. Trigger : insérer log dans logs_appels à la fin de chaque appel WebRTC
CREATE OR REPLACE FUNCTION public.log_webrtc_call_on_finish()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut IN ('termine', 'manque', 'refuse', 'annule')
     AND (OLD.statut = 'en_attente' OR OLD.statut = 'en_cours')
  THEN
    INSERT INTO public.logs_appels (
      appelant_id, appelant_role, destinataire_id,
      livraison_id, type, numero, created_at
    )
    VALUES (
      NEW.appelant_id, NEW.appelant_role, NEW.destinataire_id,
      NEW.livraison_id, 'voip',
      NEW.destinataire_id::TEXT,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_webrtc_call ON public.calls_webrtc;
CREATE TRIGGER trg_log_webrtc_call
  AFTER UPDATE OF statut ON public.calls_webrtc
  FOR EACH ROW EXECUTE FUNCTION public.log_webrtc_call_on_finish();

-- 7. RLS — Row Level Security
ALTER TABLE public.calls_webrtc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_ice_candidates ENABLE ROW LEVEL SECURITY;

-- Lecture : appelant ou destinataire uniquement
CREATE POLICY "calls_webrtc_select" ON public.calls_webrtc
  FOR SELECT USING (
    auth.uid() = appelant_id OR auth.uid() = destinataire_id
  );

-- Insert : seulement l'appelant authentifié
CREATE POLICY "calls_webrtc_insert" ON public.calls_webrtc
  FOR INSERT WITH CHECK (auth.uid() = appelant_id);

-- Update : appelant ou destinataire uniquement
CREATE POLICY "calls_webrtc_update" ON public.calls_webrtc
  FOR UPDATE USING (
    auth.uid() = appelant_id OR auth.uid() = destinataire_id
  );

-- ICE candidates : lecture par participants de l'appel
CREATE POLICY "ice_candidates_select" ON public.webrtc_ice_candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.calls_webrtc c
      WHERE c.id = call_id
        AND (c.appelant_id = auth.uid() OR c.destinataire_id = auth.uid())
    )
  );

-- ICE candidates : insert uniquement par participants
CREATE POLICY "ice_candidates_insert" ON public.webrtc_ice_candidates
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.calls_webrtc c
      WHERE c.id = call_id
        AND (c.appelant_id = auth.uid() OR c.destinataire_id = auth.uid())
    )
  );

-- 8. Activer Realtime sur les deux tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls_webrtc;
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_ice_candidates;

-- 9. Vue pratique : appels avec noms des participants
CREATE OR REPLACE VIEW public.v_calls_webrtc AS
SELECT
  c.*,
  ua.nom AS appelant_nom,
  ua.avatar_url AS appelant_avatar,
  ud.nom AS destinataire_nom,
  ud.avatar_url AS destinataire_avatar
FROM public.calls_webrtc c
LEFT JOIN public.utilisateurs ua ON ua.id = c.appelant_id
LEFT JOIN public.utilisateurs ud ON ud.id = c.destinataire_id;

-- 10. Commentaires
COMMENT ON TABLE public.calls_webrtc IS
  'Table de signalisation WebRTC pour appels audio entre client et coursier via Supabase Realtime. 
   Chaque ligne représente un appel (offre + réponse SDP + candidats ICE).';
COMMENT ON TABLE public.webrtc_ice_candidates IS
  'Candidats ICE WebRTC envoyés par chaque participant pendant la négociation de connexion.';