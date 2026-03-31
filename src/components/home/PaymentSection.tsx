'use client'

import { useEffect, useRef, useState } from 'react'

const methods = [
  { emoji: '💵', name: 'Cash', desc: 'Payez à la livraison', color: 'from-green-500/20 to-green-500/5', border: 'border-green-500/30', glow: 'shadow-green-500/20' },
  { emoji: '🟠', name: 'Orange Money', desc: 'Paiement Orange', color: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  { emoji: '🔵', name: 'Moov Money', desc: 'Transfert Moov', color: 'from-nyme-blue-light/20 to-nyme-blue-light/5', border: 'border-nyme-blue-light/30', glow: 'shadow-nyme-blue-light/20' },
  { emoji: '💜', name: 'Wave', desc: 'Paiement Wave', color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
]

const rows = [
  { label: 'Tarif par km (500 FCFA × 5)', value: '2 500 FCFA' },
  { label: 'Tarif par minute (50 FCFA × 15 min)', value: '750 FCFA' },
  { label: 'Frais de service NYME', value: '500 FCFA' },
]

export default function PaymentSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [activeMethod, setActiveMethod] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setActiveMethod(m => (m + 1) % methods.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <section id="tarifs" className="py-16 sm:py-24 bg-nyme-blue-mid relative overflow-hidden" ref={ref}>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-orange/20 mb-4">
            <span className="text-nyme-orange text-xs sm:text-sm">💳 Paiement</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 sm:mb-4">
            Payez comme vous voulez
          </h2>
          <p className="text-white/50 font-body text-base sm:text-lg max-w-xl mx-auto px-4">
            Cash à la livraison ou paiement mobile — 100% adapté au marché burkinabè.
          </p>
        </div>

        {/* Méthodes de paiement */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-10 sm:mb-16">
          {methods.map((m, i) => (
            <div key={m.name} onClick={() => setActiveMethod(i)}
              className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br ${m.color} border ${m.border} text-center cursor-pointer transition-all duration-300
                ${activeMethod === i ? `scale-105 shadow-lg ${m.glow} -translate-y-1` : 'hover:scale-102 hover:-translate-y-0.5'}
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="text-2xl sm:text-4xl mb-2 sm:mb-3">{m.emoji}</div>
              <h3 className="font-heading text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2 leading-tight">{m.name}</h3>
              <p className="text-white/50 text-[10px] sm:text-xs font-body hidden sm:block">{m.desc}</p>
              {activeMethod === i && <div className="mt-2 w-4 h-0.5 bg-nyme-orange rounded-full mx-auto" />}
            </div>
          ))}
        </div>

        {/* Calculateur de prix */}
        <div className={`max-w-2xl mx-auto glass rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-nyme-orange/20 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2 text-center">Exemple de tarification</h3>
          <p className="text-white/40 text-xs sm:text-sm text-center mb-5 sm:mb-6 font-body">Pour une livraison de 5 km à Ouagadougou</p>

          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/10 gap-4">
                <span className="text-white/60 text-xs sm:text-sm">{row.label}</span>
                <span className="text-white text-xs sm:text-sm font-medium shrink-0">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center p-3 sm:p-4 rounded-xl bg-nyme-orange/10 border border-nyme-orange/20">
            <span className="text-white font-semibold text-sm sm:text-base">Total client</span>
            <span className="text-nyme-orange font-heading text-xl sm:text-2xl font-bold">3 750 FCFA</span>
          </div>

          <p className="text-center text-white/30 text-[10px] sm:text-xs mt-3 sm:mt-4 font-body">
            * Le client peut négocier ce prix à la hausse ou à la baisse
          </p>
        </div>
      </div>
    </section>
  )
}