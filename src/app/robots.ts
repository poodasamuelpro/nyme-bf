// src/app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/partenaires/dashboard', '/partenaires/login'],
      },
    ],
    sitemap: 'https://nyme.app/sitemap.xml',
  }
}
