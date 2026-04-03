# 📖 Documentation Supabase — NYME
## Configuration complète pour une application Flutter mobile

---

## 1. Créer le projet Supabase

1. Aller sur [https://supabase.com](https://supabase.com)
2. Cliquer **New project**
3. Remplir :
   - **Name** : `nyme-app`
   - **Database Password** : choisir un mot de passe fort (le noter !)
   - **Region** : choisir la plus proche (ex: Frankfurt pour l'Afrique de l'Ouest)
4. Attendre la création (~2 minutes)

---

## 2. Récupérer les clés API

Dans le dashboard Supabase :  
**Settings → API**

| Clé | Où l'utiliser |
|-----|--------------|
| `Project URL` | `SupabaseConfig.url` dans Flutter |
| `anon public key` | `SupabaseConfig.anonKey` dans Flutter |
| `service_role key` | **Uniquement** dans les Edge Functions (JAMAIS dans l'app) |

Mettre dans `lib/config/supabase_config.dart` :
```dart
static const String url = 'https://VOTRE_PROJECT_ID.supabase.co';
static const String anonKey = 'eyJhbGc...VOTRE_ANON_KEY';
```

> ⚠️ **Ne jamais mettre la `service_role key` dans l'app Flutter.** Elle donne accès total à la base de données.

---

## 3. Exécuter les migrations SQL

Dans le dashboard Supabase :  
**SQL Editor → New query**

Exécuter dans cet ordre :
1. Coller le contenu de `supabase/migrations/001_schema_complet.sql` → **Run**
2. Coller le contenu de `supabase/migrations/002_rls_policies.sql` → **Run**

Vérifier dans **Table Editor** que toutes les tables sont créées.

---

## 4. Configurer l'Authentification

### 4.1 Auth général
**Authentication → Settings**

| Paramètre | Valeur |
|-----------|--------|
| Site URL | `com.nyme.app://` |
| Redirect URLs | `com.nyme.app://login-callback/` |
| Enable email confirmations | **OFF** (on utilise OTP SMS) |
| JWT expiry | `3600` (1h) |
| Refresh token expiry | `604800` (7 jours) |

### 4.2 Activer SMS OTP (Twilio ou Africa's Talking)

**Authentication → Providers → Phone**

**Option recommandée pour Burkina Faso : Africa's Talking**

1. Créer compte sur [https://africastalking.com](https://africastalking.com)
2. Récupérer les credentials SMS
3. Dans Supabase → Phone Provider → choisir **Twilio** ou entrer credentials manuellement

Paramètres :
```
Provider : Twilio (ou custom)
Account SID : VOTRE_SID
Auth Token : VOTRE_TOKEN
Message Service SID : VOTRE_SERVICE_SID
```

### 4.3 Activer Google OAuth (optionnel)

**Authentication → Providers → Google**

1. Aller sur [https://console.cloud.google.com](https://console.cloud.google.com)
2. Créer un projet → APIs & Services → Credentials
3. Créer OAuth 2.0 Client ID (Android + iOS)
4. Copier **Client ID** et **Client Secret** dans Supabase
5. Dans Flutter, ajouter dans `android/app/build.gradle` le SHA1 de votre keystore

---

## 5. Configurer le Storage

**Storage → New bucket**

Créer 3 buckets :

| Bucket | Accès | Usage |
|--------|-------|-------|
| `avatars` | Public | Photos de profil |
| `photos-colis` | Public | Photos des colis |
| `identites-coursiers` | **Privé** | CNI, permis, carte grise |

### Policies Storage

**Storage → Policies**

Pour `avatars` (public) :
```sql
-- Lecture publique
CREATE POLICY "Lecture publique avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Upload par l'utilisateur connecté
CREATE POLICY "Upload avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

Pour `identites-coursiers` (privé) :
```sql
-- Seul l'admin peut voir les identités
CREATE POLICY "Admin voit identites" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'identites-coursiers'
    AND EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'admin')
  );

-- Coursier upload ses propres documents
CREATE POLICY "Coursier upload identite" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'identites-coursiers'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );
```

---

## 6. Activer Realtime

**Database → Replication**

Activer pour ces tables :
- ✅ `localisation_coursier`
- ✅ `messages`
- ✅ `livraisons`
- ✅ `notifications`
- ✅ `propositions_prix`

---

## 7. Edge Functions (notifications push)

Les Edge Functions sont des fonctions serverless côté Supabase.  
Créer `supabase/functions/envoyer-notification/index.ts` :

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FCM_URL = "https://fcm.googleapis.com/fcm/send";
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

serve(async (req) => {
  const { destinataire_id, titre, corps, data } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Récupérer le FCM token
  const { data: user } = await supabase
    .from("utilisateurs")
    .select("fcm_token")
    .eq("id", destinataire_id)
    .single();

  if (!user?.fcm_token) return new Response("No token", { status: 400 });

  // Envoyer via FCM
  const response = await fetch(FCM_URL, {
    method: "POST",
    headers: {
      "Authorization": `key=${FCM_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: user.fcm_token,
      notification: { title: titre, body: corps },
      data: data || {},
    }),
  });

  return new Response(await response.text(), { status: response.status });
});
```

Déployer :
```bash
supabase functions deploy envoyer-notification
supabase secrets set FCM_SERVER_KEY=VOTRE_CLE_FCM
```

---

## 8. Configuration Flutter (Android)

### android/app/build.gradle
```gradle
android {
    defaultConfig {
        minSdkVersion 21  // minimum pour Supabase
        targetSdkVersion 34
        multiDexEnabled true
    }
}
```

### android/app/src/main/AndroidManifest.xml
Ajouter les permissions :
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.CALL_PHONE"/>
```

Deep link pour OAuth (dans `<activity>`) :
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="com.nyme.app" android:host="login-callback"/>
</intent-filter>
```

---

## 9. Configuration Flutter (iOS)

### ios/Runner/Info.plist
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>NYME utilise votre position pour le suivi des livraisons</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>NYME utilise votre position pour le tracking en arrière-plan (coursiers)</string>
<key>NSCameraUsageDescription</key>
<string>NYME utilise la caméra pour photographier les colis et documents</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>NYME accède à vos photos pour les colis</string>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.nyme.app</string>
    </array>
  </dict>
</array>
```

---

## 10. Variables d'environnement à configurer

| Variable | Où | Valeur |
|----------|----|--------|
| `SUPABASE_URL` | `supabase_config.dart` | Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | `supabase_config.dart` | Dashboard → Settings → API |
| `MAPBOX_TOKEN` | `map_service.dart` | dashboard.mapbox.com → Access tokens |
| `GOOGLE_MAPS_KEY` | `map_service.dart` | console.cloud.google.com |
| `FCM_SERVER_KEY` | Supabase Secrets | Firebase Console → Project settings |
| `CINETPAY_API_KEY` | `payment_service.dart` | dashboard.cinetpay.com |
| `CINETPAY_SITE_ID` | `payment_service.dart` | dashboard.cinetpay.com |

---

## 11. Créer un compte Admin

Après le déploiement, créer le premier admin directement en SQL :

```sql
-- 1. Créer l'utilisateur dans auth.users via l'interface Authentication
-- 2. Puis mettre à jour son rôle :
UPDATE utilisateurs SET role = 'admin', est_verifie = TRUE
WHERE email = 'admin@nyme.app';
```

---

## 12. Tester la configuration

Dans l'app Flutter, vérifier :

```dart
// Test de connexion Supabase
final client = Supabase.instance.client;
print('Connecté : ${client.auth.currentSession != null}');

// Test requête
final result = await client.from('utilisateurs').select('id').limit(1);
print('DB OK : $result');
```

---

## 13. Checklist avant lancement

- [ ] Migrations SQL exécutées (001 et 002)
- [ ] Buckets Storage créés avec les bonnes policies
- [ ] Realtime activé sur les 5 tables
- [ ] Auth SMS configuré
- [ ] FCM Edge Function déployée
- [ ] Variables dans `supabase_config.dart` remplies
- [ ] `google-services.json` ajouté dans `android/app/`
- [ ] `GoogleService-Info.plist` ajouté dans `ios/Runner/`
- [ ] Permissions Android/iOS configurées
- [ ] Compte admin créé

---

## 14. Monitoring en production

**Dashboard Supabase → Logs** pour surveiller :
- Erreurs d'authentification
- Requêtes lentes (> 200ms)
- Erreurs RLS
- Usage Storage

**Seuils gratuits Supabase (Free tier) :**
| Ressource | Limite |
|-----------|--------|
| Base de données | 500 MB |
| Storage | 1 GB |
| Bandwidth | 5 GB/mois |
| Edge Functions | 500k invocations/mois |
| Realtime | 200 connexions simultanées |

Passer au **Pro plan ($25/mois)** quand vous atteignez 70% des limites.
