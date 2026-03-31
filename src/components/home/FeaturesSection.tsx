'use client'

import { useEffect, useRef, useState } from 'react'

const features = [
  { emoji: '💬', title: 'Négociation de prix', desc: 'Proposez votre prix, les coursiers contre-proposent. Vous choisissez l\'offre qui vous convient — comme InDrive mais pour les colis.', color: 'from-nyme-orange/20 to-nyme-orange/5', border: 'border-nyme-orange/30' },
  { emoji: '📍', title: 'Suivi GPS en temps réel', desc: 'Suivez votre coursier sur une carte interactive mise à jour toutes les 3 secondes. Partagez le lien de suivi avec le destinataire.', color: 'from-nyme-blue-light/20 to-nyme-blue-light/5', border: 'border-nyme-blue-light/30' },
  { emoji: '🛡️', title: 'Coursiers vérifiés', desc: 'CNI, permis de conduire, carte grise et photo de véhicule. Aucun coursier ne peut travailler sans validation admin complète.', color: 'from-green-500/20 to-green-500/5', border: 'border-green-500/30' },
  { emoji: '📦', title: 'Livraison pour un tiers', desc: 'Envoyez un colis à quelqu\'un d\'autre. Le destinataire reçoit un SMS avec lien de suivi et est notifié à chaque étape.', color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30' },
  { emoji: '⏰', title: 'Course programmée', desc: 'Planifiez vos livraisons jusqu\'à 15 jours à l\'avance. L\'app trouve automatiquement un coursier disponible 1h avant.', color: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/30' },
  { emoji: '📞', title: 'Chat & appels intégrés', desc: 'Communiquez directement avec votre coursier via le chat ou par téléphone, sans jamais quitter l\'application.', color: 'from-nyme-red/20 to-nyme-red/5', border: 'border-nyme-red/30' },
]

export default function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState<boolean[]>(Array(6).fill(false))

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-idx'))
            setTimeout(() => {
              setVisible(v => { const n = [...v]; n[idx] = true; return n })
            }, idx * 100)
          }
        })
      },
      { threshold: 0.1 }
    )
    ref.current?.querySelectorAll('[data-idx]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section id="fonctionnalites" className="py-16 sm:py-24 bg-nyme-dark relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-nyme-orange/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 sm:w-72 h-48 sm:h-72 rounded-full bg-nyme-blue/20 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-orange/20 mb-4">
            <span className="text-nyme-orange text-xs sm:text-sm">✦ Fonctionnalités</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 sm:mb-4">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-white/50 font-body text-base sm:text-lg max-w-2xl mx-auto px-4">
            NYME repense la livraison pour l'Afrique de l'Ouest. Conçu pour Ouagadougou, adapté à vos réalités.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" ref={ref}>
          {features.map((feature, i) => (
            <div key={feature.title} data-idx={i}
              className={`p-5 sm:p-6 rounded-2xl bg-gradient-to-br ${feature.color} border ${feature.border} hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-default
                ${visible[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transition: 'opacity 0.5s ease, transform 0.5s ease' }}
            >
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">{feature.emoji}</div>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">{feature.title}</h3>
              <p className="text-white/60 font-body text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}