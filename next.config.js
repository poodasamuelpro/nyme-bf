// next.config.js
// CORRECTIONS AUDIT :
//   1. images.domains vide → ajout des domaines utilisés (Supabase, Google, GitHub)
//   2. Ajout Content Security Policy (CSP) pour limiter les vecteurs XSS
//   3. Passage à remotePatterns (API moderne Next.js 14) en plus de domains
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Images distantes autorisées ──────────────────────────────────
  // CORRECTION AUDIT : domains: [] vide → ajout des domaines nécessaires
  images: {
    // remotePatterns est la méthode recommandée Next.js 14+
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
    ],
    // domains maintenu pour compatibilité (déprécié Next.js 14 mais fonctionnel)
    domains: [
      'supabase.co',
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
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
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=(self)' },
          // HSTS — HTTPS forcé 1 an
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // ── CONTENT SECURITY POLICY ──────────────────────────────
          // CORRECTION AUDIT : ajout CSP pour limiter les vecteurs XSS
          {
            key: 'Content-Security-Policy',
            value: [
              // Scripts : self + CDN Tailwind + identifiants inline Next.js
              "default-src 'self'",
              // Scripts autorisés : self + inline Next.js hydration + CDN
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://maps.googleapis.com https://api.mapbox.com",
              // Styles : self + inline + CDN
              "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://api.mapbox.com",
              // Images : self + data URIs + Supabase + Google + CDN
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.googleapis.com https://*.openstreetmap.org https://tiles.mapbox.com https://api.mapbox.com https://cdn.jsdelivr.net",
              // Fonts : self + Google + CDN
              "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
              // Connexions API : self + Supabase + providers paiement + maps
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.duniapay.net https://api.flutterwave.com https://api.orange.com https://api.brevo.com https://api.resend.com https://maps.googleapis.com https://api.mapbox.com https://router.project-osrm.org",
              // Frames : none (sécurité anti-clickjacking)
              "frame-src 'none'",
              // Workers (Next.js service worker)
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

module.exports = nextConfig