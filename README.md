# NYME — Livraison Rapide & Intelligente 🛵

> Plateforme full-stack de livraison de colis à la demande pour l'Afrique de l'Ouest (Burkina Faso)

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-cyan)](https://tailwindcss.com)

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Stack technique](#stack-technique)
3. [Architecture](#architecture)
4. [Fonctionnalités implémentées](#fonctionnalités-implémentées)
5. [Base de données (27 tables)](#base-de-données)
6. [Routes API](#routes-api)
7. [Pages frontend](#pages-frontend)
8. [Cloudflare TURN Server](#cloudflare-turn-server)
9. [Variables d'environnement](#variables-denvironnement)
10. [Installation & développement](#installation--développement)
11. [Déploiement](#déploiement)
12. [Sécurité](#sécurité)
13. [Migrations SQL](#migrations-sql)

---

## Vue d'ensemble

NYME est une application web de livraison à la demande conçue pour les marchés africains.
Elle permet à des **clients** de créer des demandes de livraison, à des **coursiers** de les accepter
et à des **partenaires commerciaux** (entreprises) de gérer leurs livraisons en volume.

**Trois types d'utilisateurs :**
- 👤 **Client** — crée des demandes, paie, suit en temps réel, évalue
- 🛵 **Coursier** — reçoit des missions, navigue, encaisse via wallet
- 🏢 **Partenaire** — gère un portefeuille de livraisons (API B2B)

**Un admin dashboard** (URL secrète) pour superviser l'ensemble.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript 5 |
| Styling | Tailwind CSS 3.4 |
| Animations | Framer Motion |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Temps réel | Supabase Realtime (Postgres Changes) |
| Cartes | Leaflet + react-leaflet |
| Routage GPS | Mapbox → Google Maps → OSRM (fallback) |
| Géocodage | Mapbox → Google → Nominatim (OSM, gratuit) |
| Paiement | DuniaPay → Flutterwave → Orange Money |
| Push notif. | Firebase Cloud Messaging (FCM) |
| Email | Resend |
| Appels audio | WebRTC + Supabase Realtime (signalisation) |
| TURN Server | **Cloudflare Calls TURN** (credentials dynamiques) |
| Météo | OpenWeatherMap |
| Tâches planifiées | pg_cron (Supabase) |
| Déploiement | Vercel |

---

## Architecture

```
nyme-bf/
├── src/
│   ├── app/
│   │   ├── (pages publiques)         # Landing, contact, partenaires
│   │   ├── admin-x9k2m/              # Dashboard admin (URL secrète)
│   │   ├── client/                   # Espace client authentifié
│   │   ├── coursier/                 # Espace coursier authentifié
│   │   ├── partenaires/              # Espace partenaire
│   │   └── api/                      # Routes API (server-side)
│   │       ├── admin/                # API admin (verifyAdminRole)
│   │       ├── calls/                # WebRTC + TURN credentials
│   │       ├── client/               # API client
│   │       ├── coursier/             # API coursier
│   │       ├── partenaires/          # API partenaires
│   │       └── payment/              # Paiement multi-provider
│   ├── components/
│   │   ├── calls/                    # Système d'appels WebRTC
│   │   ├── home/                     # Sections landing page
│   │   ├── notifications/            # Panel notifications
│   │   └── shared/                   # Composants partagés
│   ├── lib/
│   │   ├── auth-middleware.ts        # verifyAdminRole / verifyAuthUser
│   │   ├── supabase.ts               # Client Supabase + types (27 tables)
│   │   ├── supabase-admin.ts         # Client service_role (server-side)
│   │   └── tarifs.ts                 # Calcul prix (source unique)
│   └── services/
│       ├── communication-service.ts
│       ├── firebase-notification-service.ts
│       ├── geocoding-service.ts      # Mapbox → Google → Nominatim
│       ├── map-service.ts            # Routage GPS + quotas persistés
│       ├── payment-service.ts        # DuniaPay → Flutterwave → Orange
│       ├── price-negotiation-service.ts
│       ├── wallet-service.ts
│       └── webrtc-call-service.ts    # WebRTC + Cloudflare TURN
├── supabase/
│   └── migrations/                   # 17 migrations SQL
└── public/
```

---

## Fonctionnalités implémentées

### ✅ Client
- [x] Inscription / connexion (Supabase Auth)
- [x] Création de livraison (immédiate, urgente, programmée)
- [x] Calcul de prix dynamique (barèmes Supabase + météo)
- [x] Suivi GPS en temps réel (Leaflet + Supabase Realtime)
- [x] Suivi partagé par lien tokenisé (sans auth)
- [x] Paiement : wallet, mobile money, carte, cash
- [x] Recharge wallet (DuniaPay / Flutterwave / Orange)
- [x] Négociation de prix avec le coursier
- [x] Annulation de livraison
- [x] Évaluation du coursier (note 1-5)
- [x] Signalement de coursier
- [x] Messagerie avec le coursier (chat temps réel)
- [x] Appels audio WebRTC avec TURN Cloudflare
- [x] Contacts favoris
- [x] Adresses favorites
- [x] Historique des livraisons
- [x] Notifications in-app (Supabase Realtime)
- [x] Notifications push (Firebase FCM)

### ✅ Coursier
- [x] Inscription / login dédié
- [x] Upload de documents (CNI, permis, carte grise)
- [x] Validation par l'admin
- [x] Dashboard missions disponibles
- [x] Acceptation / contre-proposition prix
- [x] Mise à jour statut livraison (8 étapes)
- [x] Photo preuve de livraison (Supabase Storage)
- [x] Navigation GPS (Leaflet)
- [x] Wallet coursier (gains automatiques)
- [x] Messagerie avec le client
- [x] Appels audio WebRTC
- [x] Mise à jour position GPS

### ✅ Partenaire B2B
- [x] Inscription entreprise
- [x] Dashboard livraisons en volume
- [x] 3 plans tarifaires (Starter 25k / Business 65k / Enterprise devis)
- [x] Commission dégressive (8% à 12%)

### ✅ Admin
- [x] Dashboard KPIs (CA, livraisons, taux succès)
- [x] Liste clients
- [x] Validation/rejet des coursiers
- [x] Paiement direct des coursiers
- [x] Gestion des tarifs (barèmes)
- [x] Gestion des wallets
- [x] Gestion signalements
- [x] Création admin / partenaire

### ✅ Infrastructure
- [x] WebRTC appels audio (Cloudflare TURN Server)
- [x] Rate limiting API (migration 017)
- [x] RLS Supabase complet (27 tables)
- [x] pg_cron : courses programmées (migration 016)
- [x] pg_cron : nettoyage ICE candidates (migration 017)
- [x] Trigger note_moyenne automatique (migration 015)
- [x] Calcul prix route réelle (MapService, pas euclidien)
- [x] Multi-provider paiement avec fallback
- [x] Quotas API persistés en BDD

---

## Base de données

**27 tables PostgreSQL** gérées via Supabase :

| # | Table | Description |
|---|-------|-------------|
| 1 | `utilisateurs` | Profils (client, coursier, admin, partenaire) |
| 2 | `coursiers` | Profil étendu coursier (statut, position, gains) |
| 3 | `livraisons` | Commandes de livraison (états + paiement) |
| 4 | `livraisons_partenaire` | Livraisons B2B partenaires |
| 5 | `partenaires` | Entreprises abonnées |
| 6 | `wallets` | Portefeuilles utilisateurs |
| 7 | `transactions_wallet` | Historique mouvements wallet |
| 8 | `notifications` | Notifications in-app |
| 9 | `messages` | Chat client ↔ coursier |
| 10 | `evaluations` | Notes et commentaires |
| 11 | `propositions_prix` | Négociation de prix |
| 12 | `paiements` | Transactions paiement multi-provider |
| 13 | `signalements` | Signalements utilisateurs |
| 14 | `statuts_livraison` | Historique des changements de statut |
| 15 | `vehicules` | Véhicules des coursiers |
| 16 | `courier_documents` | Documents de vérification |
| 17 | `localisation_coursier` | Historique positions GPS |
| 18 | `logs_appels` | Logs appels téléphoniques natifs |
| 19 | `contacts_favoris` | Contacts favoris client |
| 20 | `coursiers_favoris` | Coursiers favoris client |
| 21 | `adresses_favorites` | Adresses favorites |
| 22 | `config_tarifs` | Configuration tarifaire (admin) |
| 23 | `suivi_tokens` | Tokens de suivi partagé |
| 24 | `api_quota_tracking` | Quotas API Mapbox/Google |
| 25 | `blocages` | Blocages entre utilisateurs |
| 26 | `calls_webrtc` | Appels WebRTC (signalisation) |
| 27 | `webrtc_ice_candidates` | Candidats ICE WebRTC |
| + | `tarifs_baremes` | Barèmes de tarification (migration 007) |
| + | `rate_limit_api` | Rate limiting API (migration 017) |

**RPC fonctions SQL :**
- `process_wallet_transaction()` — transaction wallet atomique
- `check_and_increment_rate_limit()` — rate limiting atomique
- `notify_courses_24h_avant()` — notifications automatiques
- `assigner_coursier_courses_programmees()` — assignation automatique
- `update_note_moyenne_utilisateur()` — trigger note moyenne
- `cleanup_old_webrtc_ice_candidates()` — nettoyage ICE

---

## Routes API

### `/api/calls`
| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/calls` | Historique appels de l'utilisateur |
| POST | `/api/calls` | Créer un appel (signalisation) |
| PATCH | `/api/calls` | Mettre à jour statut/SDP |
| **GET** | **`/api/calls/turn-credentials`** | **Credentials TURN Cloudflare** ✨ |

### `/api/client`
| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | `/api/client/livraisons/create` | Créer une livraison |
| POST | `/api/client/livraisons/annuler` | Annuler une livraison |
| POST | `/api/client/livraisons/payer-wallet` | Payer via wallet |
| POST | `/api/client/livraisons/partager-suivi` | Générer lien suivi |
| GET/POST | `/api/client/adresses` | Adresses favorites |
| GET | `/api/client/notifications` | Notifications |
| POST | `/api/client/wallet/recharger` | Recharge wallet |

### `/api/coursier`
| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | `/api/coursier/livraisons/accepter` | Accepter / contre-proposer |
| POST | `/api/coursier/livraisons/statut` | Mettre à jour statut + photo preuve |
| POST | `/api/coursier/position` | MAJ position GPS |

### `/api/payment`
| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | `/api/payment/initiate` | Initier paiement (multi-provider) |
| POST | `/api/payment/verify` | Vérifier statut paiement |
| POST | `/api/payment/duniapay/callback` | Webhook DuniaPay |
| POST | `/api/payment/flutterwave/callback` | Webhook Flutterwave |
| POST | `/api/payment/orange/callback` | Webhook Orange Money |
| POST | `/api/payment/wallet-recharge/callback` | Webhook recharge wallet |

### `/api/admin`
| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/admin/stats` | KPIs dashboard |
| GET | `/api/admin/clients` | Liste clients |
| POST | `/api/admin/valider-coursier` | Valider/rejeter coursier |
| POST | `/api/admin/payer-coursier` | Payer un coursier |
| GET/POST | `/api/admin/tarifs` | Gestion barèmes |
| GET | `/api/admin/wallets` | Gestion wallets |
| GET/PATCH | `/api/admin/signalements` | Gestion signalements |
| POST | `/api/admin/create-admin` | Créer admin |
| POST | `/api/admin/create-partenaire` | Créer partenaire |
| POST | `/api/admin/update-partenaire-statut` | Statut partenaire |

---

## Cloudflare TURN Server

NYME utilise le service **Cloudflare Calls TURN** pour les appels audio WebRTC.

### Configuration

| Paramètre | Valeur |
|-----------|--------|
| App Name | `nyme` |
| Turn Token ID | `77f00ae2cb584d4141b0efb842de5425` |
| API Token | `CLOUDFLARE_TURN_API_TOKEN` (secret Vercel) |

### Fonctionnement

```
Client NYME                Backend (Next.js)          Cloudflare TURN API
    │                            │                            │
    │── GET /api/calls/turn-credentials ──▶│                  │
    │                            │── POST rtc.live.cloudflare.com ──▶│
    │                            │◀── { iceServers: [...] } ─────────│
    │◀── { iceServers: [...] } ──│
    │                            │
    │── new RTCPeerConnection({ iceServers }) ──▶ (appel P2P)
```

**Serveurs ICE Cloudflare retournés :**
```json
{
  "iceServers": [{
    "urls": [
      "stun:stun.cloudflare.com:3478",
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turn:turn.cloudflare.com:3478?transport=tcp",
      "turns:turn.cloudflare.com:5349?transport=tcp"
    ],
    "username": "<dynamique>",
    "credential": "<dynamique>"
  }]
}
```

**Sécurité :**
- Les credentials sont générés **côté serveur** (jamais exposés dans le code client)
- TTL des credentials : **24 heures**
- Rate limit : **20 appels / 10 minutes** par utilisateur (migration 017)
- Cache côté client : **23 heures** (évite les appels répétés)
- Authentification requise pour accéder à `/api/calls/turn-credentials`

**Fallback :** Si Cloudflare est indisponible → STUN Google (dégradé, NAT symétrique non supporté)

### Variables à configurer

```env
# Cloudflare TURN (REQUIS pour les appels audio)
CLOUDFLARE_TURN_KEY_ID=
CLOUDFLARE_TURN_API_TOKEN=
```

> ⚠️ `CLOUDFLARE_TURN_API_TOKEN` est un **secret** — ne jamais le committer dans le dépôt.
> À configurer dans Vercel Dashboard > Settings > Environment Variables.

---

## Variables d'environnement

Voir `.env.example` pour la liste complète. Variables **obligatoires** :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # SERVER ONLY

# Site
NEXT_PUBLIC_SITE_URL=https://nyme.bf

# Cloudflare TURN
CLOUDFLARE_TURN_KEY_ID=7
CLOUDFLARE_TURN_API_TOKEN=<secret>

# Paiement (au moins un provider)
DUNIAPAY_API_KEY=...
FLUTTERWAVE_SECRET_KEY=...
```

---

## Installation & développement

```bash
# 1. Cloner le dépôt
git clone https://github.com/poodasamuelpro/nyme-bf.git
cd nyme-bf

# 2. Installer les dépendances
npm install

# 3. Copier et configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs dans .env.local

# 4. Appliquer les migrations Supabase (dans l'éditeur SQL Supabase)
# Exécuter dans l'ordre : 001 → 017

# 5. Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Déploiement

### Vercel (recommandé)

1. Connecter le dépôt GitHub à Vercel
2. Configurer les variables d'environnement dans Vercel Dashboard
3. Chaque push sur `main` déclenche un déploiement automatique

```bash
# Build local (vérification)
npm run build --no-lint
```

### Variables Vercel à configurer

Toutes les variables listées dans `.env.example` marquées `# SECRET`.

---

## Sécurité

### Authentification
- Supabase Auth (JWT) pour tous les utilisateurs
- Middleware Next.js pour rafraîchissement des tokens
- `verifyAdminRole()` centralisé pour toutes les routes admin
- `verifyAuthUser()` pour les routes client/coursier

### RLS (Row Level Security)
- **Activé sur toutes les tables** (27 tables + tables de migration)
- Chaque utilisateur ne voit que ses propres données
- Accès admin via `service_role` uniquement côté serveur

### Rate Limiting
- Table `rate_limit_api` + RPC `check_and_increment_rate_limit()`
- `/api/calls/turn-credentials` : 20 req / 10 min par utilisateur
- Nettoyage automatique via pg_cron (toutes les heures)

### Secrets
- Clés API jamais exposées côté client
- `SUPABASE_SERVICE_ROLE_KEY` uniquement server-side
- `CLOUDFLARE_TURN_API_TOKEN` uniquement server-side
- Credentials TURN générés dynamiquement, pas hardcodés

---

## Migrations SQL

| # | Fichier | Description |
|---|---------|-------------|
| 001 | `001_schema_complet.sql` | Schéma initial (27 tables) |
| 002 | `002_rls_policies.sql` | Politiques RLS complètes |
| 003 | `003_wallet_transactions.sql` | Wallet + RPC transactions |
| 004 | `004_partenaires.sql` | Module partenaires B2B |
| 005 | `005_corrections_email_confirm.sql` | Corrections email |
| 006 | `006_auth_partenaire_admin.sql` | Auth partenaire + admin |
| 007 | `Migration 007 : Barèmes de tarification` | Barèmes tarifaires |
| 008 | `008_payments_multiprovider.sql` | Paiement multi-provider |
| 009 | `009_suivi_tokens.sql` | Tokens suivi + quotas API |
| 010 | `010_corrections_finales.sql` | Corrections diverses |
| 011 | `011_evaluations_index_rls.sql` | Index + RLS évaluations |
| 012 | `012_blocages_photos_colis.sql` | Blocages + photos colis |
| 013 | `013_webrtc_calls.sql` | Tables WebRTC |
| 014 | `014_api_quota_rpc.sql` | Quotas API RPC |
| 015 | `015_corrections_audit.sql` | Trigger note_moyenne + preuve livraison |
| 016 | `016_courses_programmees_cron.sql` | pg_cron courses programmées |
| **017** | **`017_securite_api_rate_limit.sql`** | **Rate limiting + RLS WebRTC + index** ✨ |

---

## Couleurs de la marque NYME

| Couleur | Hex | Usage |
|---------|-----|-------|
| Bleu foncé | `#0F3460` | Fond principal |
| Bleu moyen | `#16213E` | Sections secondaires |
| Bleu clair | `#1A6EBF` | Accents, liens |
| Orange | `#F97316` | CTA principal |
| Rouge | `#DC2626` | Urgence, gradient |

---

## Contact

- Site : [nyme.bf](https://nyme.bf)
- Email : nyme.contact@gmail.com
- Pays : Ouagadougou, Burkina Faso 🇧🇫

---

© 2025-2026 NYME · Tous droits réservés