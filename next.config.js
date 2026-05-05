// next.config.js 
// CORRECTIONS AUDIT :
//   [FIX-A] remotePatterns étendu — unpkg.com ajouté (icônes Leaflet)
//   [FIX-B] CSP img-src — *.tile.openstreetmap.org + unpkg.com ajoutés (tuiles + icônes Leaflet)
//   [FIX-C] CSP script-src — unpkg.com ajouté (Leaflet depuis unpkg)
//   [FIX-D] CSP font-src — data: ajouté (Leaflet inline fonts)
//   [FIX-E] CSP connect-src — nominatim.openstreetmap.org ajouté (géocodage fallback)
//   [FIX-F] domains maintenu pour rétrocompat mais remotePatterns reste la source de vérité
//   [SENTRY] withSentryConfig ajouté pour monitoring

const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Images distantes autorisées ──────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      // [FIX-A] unpkg.com — icônes Leaflet (marker-icon.png, marker-shadow.png)
      {
        protocol: 'https',
        hostname: 'unpkg.com',
      },
    ],
    // Maintenu pour compatibilité (déprécié Next.js 14 mais fonctionnel)
    domains: [
      'supabase.co',
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
      'unpkg.com',
    ],
  },

  // ── En-têtes HTTP de sécurité ─────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Anti-clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêche le sniffing MIME
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Politique Referer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions des API navigateur
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(self), microphone=(self)',
          },
          // HSTS — HTTPS forcé 1 an
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },

          // ── CONTENT SECURITY POLICY ──────────────────────────────
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",

              // Scripts : self + inline Next.js hydration + CDN + Leaflet (unpkg)
              [
                "script-src",
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://cdn.tailwindcss.com",
                "https://cdn.jsdelivr.net",
                "https://maps.googleapis.com",
                "https://api.mapbox.com",
                // [FIX-C] unpkg requis pour charger Leaflet si importé via CDN
                "https://unpkg.com",
              ].join(' '),

              // Styles
              [
                "style-src",
                "'self'",
                "'unsafe-inline'",
                "https://cdn.tailwindcss.com",
                "https://cdn.jsdelivr.net",
                "https://fonts.googleapis.com",
                "https://api.mapbox.com",
                "https://unpkg.com",
              ].join(' '),

              // Images : self + data + blob + fournisseurs + tuiles carto
              [
                "img-src",
                "'self'",
                "data:",
                "blob:",
                "https://*.supabase.co",
                "https://lh3.googleusercontent.com",
                "https://avatars.githubusercontent.com",
                "https://*.googleapis.com",
                // [FIX-B] Tuiles OpenStreetMap (Leaflet)
                "https://*.tile.openstreetmap.org",
                "https://*.openstreetmap.org",
                // [FIX-B] Icônes Leaflet via unpkg
                "https://unpkg.com",
                // Mapbox tiles
                "https://tiles.mapbox.com",
                "https://api.mapbox.com",
                "https://*.mapbox.com",
                "https://cdn.jsdelivr.net",
              ].join(' '),

              // Fonts
              [
                "font-src",
                "'self'",
                // [FIX-D] data: pour les fonts inline éventuelles
                "data:",
                "https://fonts.gstatic.com",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com",
              ].join(' '),

              // Connexions API : self + Supabase + paiement + maps + géocodage
              [
                "connect-src",
                "'self'",
                "https://*.supabase.co",
                "wss://*.supabase.co",
                // Paiement
                "https://api.duniapay.net",
                "https://api.flutterwave.com",
                "https://api.orange.com",
                // Emails
                "https://api.brevo.com",
                "https://api.resend.com",
                // Cartographie
                "https://maps.googleapis.com",
                "https://api.mapbox.com",
                "https://*.mapbox.com",
                // OSRM routing
                "https://router.project-osrm.org",
                // [FIX-E] Nominatim — géocodage OSM fallback
                "https://nominatim.openstreetmap.org",
                // Tuiles OSM (fetch depuis Leaflet)
                "https://*.tile.openstreetmap.org",
                // Sentry tunnel
                "https://*.sentry.io",
                "https://*.ingest.de.sentry.io",
              ].join(' '),

              // Frames : aucune (anti-clickjacking)
              "frame-src 'none'",

              // Workers (Next.js service worker + Leaflet web workers)
              "worker-src 'self' blob:",

              // Médias
              "media-src 'self' blob: https://*.supabase.co",

              // Manifeste PWA
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Organisation et projet Sentry
  org: "poodasamuelpro",
  project: "nyme-bf",

  // Pas d'upload de source maps (pas de auth-token ici, géré via env Vercel)
  silent: true,

  // Tunnel Sentry via le serveur Next.js (contourne les ad-blockers)
  tunnelRoute: "/monitoring",

  // Masque les source maps côté client
  hideSourceMaps: true,

  // Options webpack modernes (remplace les options dépréciées)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
