-- ═══════════════════════════════════════════════════════════════════
-- NYME - Migration SQL Supabase complète
-- Exécuter dans l'ordre dans l'éditeur SQL du dashboard Supabase
-- ═══════════════════════════════════════════════════════════════════

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- Pour les calculs GPS

-- ═══════════════════════════════════════════════════════════════════
-- 1. TABLE UTILISATEURS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  telephone TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'coursier', 'admin')),
  avatar_url TEXT,
  whatsapp TEXT,
  est_verifie BOOLEAN DEFAULT FALSE,
  note_moyenne NUMERIC(3,2) DEFAULT 0.0,
  est_actif BOOLEAN DEFAULT TRUE,
  fcm_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER utilisateurs_updated_at BEFORE UPDATE ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 2. TABLE COURSIERS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE coursiers (
  id UUID PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  statut TEXT DEFAULT 'hors_ligne' CHECK (statut IN ('hors_ligne', 'disponible', 'occupe')),
  statut_verification TEXT DEFAULT 'en_attente' CHECK (statut_verification IN ('en_attente', 'verifie', 'rejete')),
  cni_recto_url TEXT,
  cni_verso_url TEXT,
  permis_url TEXT,
  total_courses INTEGER DEFAULT 0,
  total_gains NUMERIC(12,2) DEFAULT 0.0,
  lat_actuelle DOUBLE PRECISION,
  lng_actuelle DOUBLE PRECISION,
  derniere_activite TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. TABLE VEHICULES
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE vehicules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coursier_id UUID NOT NULL REFERENCES coursiers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('moto', 'velo', 'voiture', 'camionnette')),
  marque TEXT NOT NULL,
  modele TEXT NOT NULL,
  couleur TEXT NOT NULL,
  plaque TEXT NOT NULL UNIQUE,
  carte_grise_url TEXT,
  est_verifie BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. TABLE ADRESSES FAVORITES
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE adresses_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  adresse TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  est_defaut BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte : 1 seule adresse par défaut par utilisateur
CREATE UNIQUE INDEX adresses_defaut_unique ON adresses_favorites(user_id) WHERE est_defaut = TRUE;

-- ═══════════════════════════════════════════════════════════════════
-- 5. TABLE CONTACTS FAVORIS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE contacts_favoris (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, telephone)
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. TABLE COURSIERS FAVORIS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE coursiers_favoris (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  coursier_id UUID NOT NULL REFERENCES coursiers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, coursier_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- 7. TABLE LIVRAISONS (table centrale)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE livraisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES utilisateurs(id),
  coursier_id UUID REFERENCES coursiers(id),
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente', 'acceptee', 'en_rout_depart', 'colis_recupere',
    'en_route_arrivee', 'livree', 'annulee'
  )),
  type TEXT DEFAULT 'immediate' CHECK (type IN ('immediate', 'urgente', 'programmee')),
  pour_tiers BOOLEAN DEFAULT FALSE,

  -- Points géographiques
  depart_adresse TEXT NOT NULL,
  depart_lat DOUBLE PRECISION NOT NULL,
  depart_lng DOUBLE PRECISION NOT NULL,
  arrivee_adresse TEXT NOT NULL,
  arrivee_lat DOUBLE PRECISION NOT NULL,
  arrivee_lng DOUBLE PRECISION NOT NULL,

  -- Destinataire
  destinataire_nom TEXT NOT NULL,
  destinataire_tel TEXT NOT NULL,
  destinataire_whatsapp TEXT,
  destinataire_email TEXT,
  instructions TEXT,

  -- Colis
  photos_colis TEXT[] DEFAULT '{}',

  -- Prix
  prix_calcule NUMERIC(10,2) NOT NULL,
  prix_final NUMERIC(10,2),
  commission_nyme NUMERIC(10,2),
  distance_km NUMERIC(8,2),
  duree_estimee INTEGER, -- en minutes

  -- Paiement
  statut_paiement TEXT DEFAULT 'en_attente' CHECK (statut_paiement IN ('en_attente', 'paye', 'rembourse')),
  mode_paiement TEXT CHECK (mode_paiement IN ('cash', 'mobile_money', 'carte')),

  -- Timing
  programme_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acceptee_at TIMESTAMPTZ,
  recupere_at TIMESTAMPTZ,
  livree_at TIMESTAMPTZ,
  annulee_at TIMESTAMPTZ,
  annulee_par TEXT CHECK (annulee_par IN ('client', 'coursier', 'admin'))
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_livraisons_client ON livraisons(client_id);
CREATE INDEX idx_livraisons_coursier ON livraisons(coursier_id);
CREATE INDEX idx_livraisons_statut ON livraisons(statut);
CREATE INDEX idx_livraisons_created ON livraisons(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 8. TABLE STATUTS LIVRAISON (historique)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE statuts_livraison (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
  statut TEXT NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_statuts_livraison ON statuts_livraison(livraison_id);

-- ═══════════════════════════════════════════════════════════════════
-- 9. TABLE PROPOSITIONS DE PRIX
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE propositions_prix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
  auteur_id UUID NOT NULL REFERENCES utilisateurs(id),
  role_auteur TEXT NOT NULL CHECK (role_auteur IN ('client', 'coursier')),
  montant NUMERIC(10,2) NOT NULL,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'accepte', 'refuse')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_propositions_livraison ON propositions_prix(livraison_id);

-- ═══════════════════════════════════════════════════════════════════
-- 10. TABLE LOCALISATION COURSIER (temps réel)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE localisation_coursier (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coursier_id UUID NOT NULL REFERENCES coursiers(id) ON DELETE CASCADE,
  livraison_id UUID REFERENCES livraisons(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  vitesse NUMERIC(5,2),
  direction NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_localisation_coursier ON localisation_coursier(coursier_id, created_at DESC);

-- Suppression automatique des anciennes positions (garder 1h)
CREATE OR REPLACE FUNCTION nettoyer_localisations() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM localisation_coursier
  WHERE coursier_id = NEW.coursier_id
    AND created_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nettoyer_apres_insert
  AFTER INSERT ON localisation_coursier
  FOR EACH ROW EXECUTE FUNCTION nettoyer_localisations();

-- ═══════════════════════════════════════════════════════════════════
-- 11. TABLE MESSAGES
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livraison_id UUID REFERENCES livraisons(id) ON DELETE SET NULL,
  expediteur_id UUID NOT NULL REFERENCES utilisateurs(id),
  destinataire_id UUID NOT NULL REFERENCES utilisateurs(id),
  contenu TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  lu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(expediteur_id, destinataire_id, created_at DESC);
CREATE INDEX idx_messages_destinataire ON messages(destinataire_id, lu);

-- ═══════════════════════════════════════════════════════════════════
-- 12. TABLE PAIEMENTS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livraison_id UUID NOT NULL REFERENCES livraisons(id),
  montant NUMERIC(10,2) NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cash', 'mobile_money', 'carte')),
  reference TEXT UNIQUE,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'succes', 'echec', 'rembourse')),
  metadata JSONB,
  paye_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 13. TABLE WALLETS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  solde NUMERIC(12,2) DEFAULT 0.0 CHECK (solde >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 14. TABLE TRANSACTIONS WALLET
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE transactions_wallet (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id),
  type TEXT NOT NULL CHECK (type IN ('gain', 'retrait', 'commission', 'bonus', 'remboursement')),
  montant NUMERIC(10,2) NOT NULL,
  solde_avant NUMERIC(12,2) NOT NULL,
  solde_apres NUMERIC(12,2) NOT NULL,
  livraison_id UUID REFERENCES livraisons(id),
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transactions_user ON transactions_wallet(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 15. TABLE EVALUATIONS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livraison_id UUID NOT NULL REFERENCES livraisons(id) ON DELETE CASCADE,
  evaluateur_id UUID NOT NULL REFERENCES utilisateurs(id),
  evalue_id UUID NOT NULL REFERENCES utilisateurs(id),
  note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (livraison_id, evaluateur_id)
);

-- Trigger pour mettre à jour note_moyenne dans utilisateurs
CREATE OR REPLACE FUNCTION maj_note_moyenne() RETURNS TRIGGER AS $$
BEGIN
  UPDATE utilisateurs SET note_moyenne = (
    SELECT ROUND(AVG(note)::NUMERIC, 2) FROM evaluations WHERE evalue_id = NEW.evalue_id
  ) WHERE id = NEW.evalue_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maj_note_apres_eval
  AFTER INSERT ON evaluations
  FOR EACH ROW EXECUTE FUNCTION maj_note_moyenne();

-- ═══════════════════════════════════════════════════════════════════
-- 16. TABLE NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  lu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, lu, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 17. TABLE SIGNALEMENTS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE signalements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signalant_id UUID NOT NULL REFERENCES utilisateurs(id),
  signale_id UUID NOT NULL REFERENCES utilisateurs(id),
  livraison_id UUID REFERENCES livraisons(id),
  motif TEXT NOT NULL,
  description TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'traite', 'rejete')),
  traite_par UUID REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- 18. TABLE LOGS APPELS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE logs_appels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appelant_id UUID NOT NULL REFERENCES utilisateurs(id),
  appelant_role TEXT NOT NULL,
  destinataire_id UUID NOT NULL REFERENCES utilisateurs(id),
  livraison_id UUID REFERENCES livraisons(id),
  type TEXT NOT NULL CHECK (type IN ('telephoneNatif', 'whatsapp', 'voip')),
  numero TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_logs_appels_livraison ON logs_appels(livraison_id);

-- ═══════════════════════════════════════════════════════════════════
-- 19. TABLE CONFIG TARIFS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE config_tarifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarif_km NUMERIC(8,2) DEFAULT 500.0,
  tarif_minute NUMERIC(8,2) DEFAULT 50.0,
  frais_fixe NUMERIC(8,2) DEFAULT 500.0,
  commission_pct NUMERIC(5,2) DEFAULT 15.0,
  multiplicateur_urgent NUMERIC(4,2) DEFAULT 1.30,
  actif BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer la config par défaut
INSERT INTO config_tarifs (tarif_km, tarif_minute, frais_fixe, commission_pct, multiplicateur_urgent)
VALUES (500, 50, 500, 15, 1.30);

-- ═══════════════════════════════════════════════════════════════════
-- FONCTIONS SUPABASE (logique métier côté BDD)
-- ═══════════════════════════════════════════════════════════════════

-- Trouver les coursiers disponibles proches (en km)
CREATE OR REPLACE FUNCTION coursiers_proches(lat_client FLOAT, lng_client FLOAT, rayon_km FLOAT DEFAULT 5.0)
RETURNS TABLE (
  coursier_id UUID, nom TEXT, avatar_url TEXT, telephone TEXT,
  whatsapp TEXT, note_moyenne NUMERIC, total_courses INTEGER,
  distance_km FLOAT, statut_verification TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    u.nom,
    u.avatar_url,
    u.telephone,
    u.whatsapp,
    u.note_moyenne,
    c.total_courses,
    ROUND(CAST(
      6371 * ACOS(
        LEAST(1.0, COS(RADIANS(lat_client)) * COS(RADIANS(c.lat_actuelle))
        * COS(RADIANS(c.lng_actuelle) - RADIANS(lng_client))
        + SIN(RADIANS(lat_client)) * SIN(RADIANS(c.lat_actuelle)))
      ) AS NUMERIC
    ), 2) AS distance_km,
    c.statut_verification
  FROM coursiers c
  JOIN utilisateurs u ON u.id = c.id
  WHERE
    c.statut = 'disponible'
    AND c.statut_verification = 'verifie'
    AND c.lat_actuelle IS NOT NULL
    AND 6371 * ACOS(
      LEAST(1.0, COS(RADIANS(lat_client)) * COS(RADIANS(c.lat_actuelle))
      * COS(RADIANS(c.lng_actuelle) - RADIANS(lng_client))
      + SIN(RADIANS(lat_client)) * SIN(RADIANS(c.lat_actuelle)))
    ) <= rayon_km
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Livraisons disponibles proches pour un coursier
CREATE OR REPLACE FUNCTION livraisons_proches_disponibles(lat_coursier FLOAT, lng_coursier FLOAT, rayon_km FLOAT DEFAULT 10.0)
RETURNS SETOF livraisons AS $$
BEGIN
  RETURN QUERY
  SELECT l.*
  FROM livraisons l
  WHERE
    l.statut = 'en_attente'
    AND l.coursier_id IS NULL
    AND 6371 * ACOS(
      LEAST(1.0, COS(RADIANS(lat_coursier)) * COS(RADIANS(l.depart_lat))
      * COS(RADIANS(l.depart_lng) - RADIANS(lng_coursier))
      + SIN(RADIANS(lat_coursier)) * SIN(RADIANS(l.depart_lat)))
    ) <= rayon_km
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculer le prix d'une livraison
CREATE OR REPLACE FUNCTION calculer_prix(distance_km FLOAT, duree_minutes INT, est_urgent BOOLEAN DEFAULT FALSE)
RETURNS NUMERIC AS $$
DECLARE
  cfg config_tarifs%ROWTYPE;
  prix NUMERIC;
BEGIN
  SELECT * INTO cfg FROM config_tarifs WHERE actif = TRUE LIMIT 1;
  prix := (distance_km * cfg.tarif_km) + (duree_minutes * cfg.tarif_minute) + cfg.frais_fixe;
  IF est_urgent THEN prix := prix * cfg.multiplicateur_urgent; END IF;
  RETURN ROUND(prix, 0);
END;
$$ LANGUAGE plpgsql;

-- Valider une livraison et créditer le coursier
CREATE OR REPLACE FUNCTION valider_livraison(p_livraison_id UUID) RETURNS VOID AS $$
DECLARE
  liv livraisons%ROWTYPE;
  solde_actuel NUMERIC;
  commission NUMERIC;
  gain_coursier NUMERIC;
BEGIN
  SELECT * INTO liv FROM livraisons WHERE id = p_livraison_id;
  IF liv.statut != 'livree' THEN RAISE EXCEPTION 'La livraison n est pas livrée'; END IF;

  commission := liv.prix_final * 0.15;
  gain_coursier := liv.prix_final - commission;

  -- Mettre à jour le wallet du coursier
  SELECT solde INTO solde_actuel FROM wallets WHERE user_id = liv.coursier_id;
  UPDATE wallets SET solde = solde + gain_coursier WHERE user_id = liv.coursier_id;

  -- Enregistrer la transaction
  INSERT INTO transactions_wallet (user_id, type, montant, solde_avant, solde_apres, livraison_id)
  VALUES (liv.coursier_id, 'gain', gain_coursier, solde_actuel, solde_actuel + gain_coursier, p_livraison_id);

  -- Incrémenter total_courses
  UPDATE coursiers SET total_courses = total_courses + 1 WHERE id = liv.coursier_id;
  -- Remettre disponible
  UPDATE coursiers SET statut = 'disponible' WHERE id = liv.coursier_id;
END;
$$ LANGUAGE plpgsql;

-- Conversations d'un utilisateur
CREATE OR REPLACE FUNCTION get_conversations(user_id_param UUID)
RETURNS TABLE (
  user_id UUID, nom TEXT, avatar_url TEXT, livraison_id UUID,
  dernier_message TEXT, heure TEXT, non_lus BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH derniers AS (
    SELECT DISTINCT ON (
      LEAST(expediteur_id, destinataire_id),
      GREATEST(expediteur_id, destinataire_id)
    )
      CASE WHEN expediteur_id = user_id_param THEN destinataire_id ELSE expediteur_id END AS interlocuteur_id,
      livraison_id,
      contenu AS dernier_message,
      TO_CHAR(created_at, 'HH24:MI') AS heure
    FROM messages
    WHERE expediteur_id = user_id_param OR destinataire_id = user_id_param
    ORDER BY LEAST(expediteur_id, destinataire_id), GREATEST(expediteur_id, destinataire_id), created_at DESC
  )
  SELECT
    d.interlocuteur_id,
    u.nom,
    u.avatar_url,
    d.livraison_id,
    d.dernier_message,
    d.heure,
    COUNT(m.id) FILTER (WHERE m.lu = FALSE AND m.expediteur_id = d.interlocuteur_id) AS non_lus
  FROM derniers d
  JOIN utilisateurs u ON u.id = d.interlocuteur_id
  LEFT JOIN messages m ON (
    (m.expediteur_id = d.interlocuteur_id AND m.destinataire_id = user_id_param)
  )
  GROUP BY d.interlocuteur_id, u.nom, u.avatar_url, d.livraison_id, d.dernier_message, d.heure;
END;
$$ LANGUAGE plpgsql;
