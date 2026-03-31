'use client'

import { useEffect, useRef, useState } from 'react'

// Coursier SVG animé qui pédale/roule
function CoursierSVG() {
  return (
    <div className="relative w-full flex items-center justify-center py-6">
      <svg viewBox="0 0 200 100" className="w-48 sm:w-64 h-auto" fill="none">
        {/* Route */}
        <line x1="0" y1="80" x2="200" y2="80" stroke="#1A6EBF" strokeWidth="2" opacity="0.3"/>
        <line x1="0" y1="80" x2="200" y2="80" stroke="#F97316" strokeWidth="1" strokeDasharray="8,6" opacity="0.4"/>
        {/* Moto */}
        {/* Roue arrière */}
        <circle cx="45" cy="75" r="14" stroke="#F97316" strokeWidth="2.5" fill="none">
          <animateTransform attributeName="transform" type="rotate" from="0 45 75" to="360 45 75" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="45" cy="75" r="4" fill="#F97316" opacity="0.5"/>
        {/* Roue avant */}
        <circle cx="155" cy="75" r="14" stroke="#F97316" strokeWidth="2.5" fill="none">
          <animateTransform attributeName="transform" type="rotate" from="0 155 75" to="360 155 75" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="155" cy="75" r="4" fill="#F97316" opacity="0.5"/>
        {/* Corps moto */}
        <path d="M52 62 L85 48 L130 48 L155 62 L153 75 L47 75 Z" fill="#0F3460" stroke="#1A6EBF" strokeWidth="1.5"/>
        {/* Guidon */}
        <path d="M130 48 L148 42 L152 52" stroke="#9CA3AF" strokeWidth="2"/>
        {/* Siège */}
        <path d="M72 48 L118 48 L115 40 L75 40 Z" fill="#1A6EBF"/>
        {/* Colis */}
        <rect x="55" y="42" width="16" height="12" rx="2" fill="#F97316" stroke="#FB923C" strokeWidth="1"/>
        <line x1="63" y1="42" x2="63" y2="54" stroke="#FB923C" strokeWidth="1"/>
        <line x1="55" y1="48" x2="71" y2="48" stroke="#FB923C" strokeWidth="1"/>
        {/* Coursier */}
        <ellipse cx="110" cy="36" rx="8" ry="12" fill="#F97316"/>
        <circle cx="110" cy="22" r="8" fill="#FBBF24"/>
        {/* Casque */}
        <path d="M102 20 Q110 13 118 20 Q119 27 110 28 Q101 27 102 20Z" fill="#0F3460"/>
        <rect x="104" y="23" width="12" height="4" rx="1" fill="#1A6EBF" opacity="0.6"/>
        {/* Bras guidon */}
        <path d="M116 28 L148 44" stroke="#F97316" strokeWidth="3" strokeLinecap="round"/>
        {/* Jambes */}
        <path d="M106 46 L95 62" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M114 46 L120 60" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Lignes de vitesse */}
        <line x1="0" y1="68" x2="25" y2="68" stroke="#F97316" strokeWidth="2" opacity="0.5" strokeDasharray="4,3"/>
        <line x1="0" y1="62" x2="18" y2="62" stroke="#F97316" strokeWidth="1.5" opacity="0.3" strokeDasharray="4,3"/>
        <line x1="0" y1="74" x2="20" y2="74" stroke="#F97316" strokeWidth="1" opacity="0.2" strokeDasharray="4,3"/>
      </svg>
      {/* Badge livraison */}
      <div className="absolute top-2 right-4 sm:right-8 glass border border-green-400/30 rounded-xl px-3 py-1.5 animate-bounce">
        <span className="text-green-400 text-xs font-semibold">✓ Livré !</span>
      </div>
    </div>
  )
}

const deliveries = [
  { route: 'Ouaga 2000 → Hamdallaye', price: '3 500 FCFA', time: '25 min', gain: '+2 975 FCFA' },
  { route: 'Tampouy → Patte d\'Oie', price: '2 800 FCFA', time: '18 min', gain: '+2 380 FCFA' },
  { route: 'Ouaga Inter → Gounghin', price: '4 200 FCFA', time: '32 min', gain: '+3 570 FCFA' },
  { route: 'Zone du Bois → Dapoya', price: '1 900 FCFA', time: '12 min', gain: '+1 615 FCFA' },
]

export default function ForCouriersSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [activeDelivery, setActiveDelivery] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setActiveDelivery(d => (d + 1) % deliveries.length), 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <section id="devenir-coursier" className="py-16 sm:py-24 bg-nyme-dark relative overflow-hidden" ref={ref}>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_left,rgba(15,52,96,0.5)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Contenu */}
          <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-blue-light/30 mb-5 sm:mb-6">
              <span className="text-nyme-blue-light text-xs sm:text-sm">🛵 Pour les coursiers</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 sm:mb-6">
              Gagnez de l'argent avec votre
              <span className="text-gradient"> moto ou vélo</span>
            </h2>
            <p className="text-white/60 font-body text-base sm:text-lg leading-relaxed mb-6 sm:mb-8">
              Rejoignez la communauté NYME et transformez vos déplacements en revenus. Vous choisissez vos horaires, vos zones, vos tarifs.
            </p>

            {/* Illustration coursier */}
            <div className="glass rounded-2xl border border-nyme-blue-light/20 mb-6 overflow-hidden">
              <CoursierSVG />
            </div>

            <div className="space-y-3 mb-6 sm:mb-8">
              {[
                { emoji: '💰', title: 'Revenus directs', desc: 'Recevez vos gains après chaque livraison dans votre wallet NYME' },
                { emoji: '🗓️', title: 'Flexibilité totale', desc: 'Travaillez quand vous voulez. Vous contrôlez votre statut' },
                { emoji: '⭐', title: 'Badge "Favori"', desc: 'Construisez votre réputation et soyez demandé en priorité' },
                { emoji: '📱', title: 'App simple & intuitive', desc: 'Interface conçue pour une utilisation rapide même en mouvement' },
              ].map((item, i) => (
                <div key={item.title} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl nyme-card transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                  style={{ transitionDelay: `${i * 100 + 300}ms` }}>
                  <span className="text-xl sm:text-2xl shrink-0">{item.emoji}</span>
                  <div>
                    <h4 className="text-white font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">{item.title}</h4>
                    <p className="text-white/50 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <a href="#telecharger" className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-nyme-blue to-nyme-blue-light text-white font-semibold text-sm sm:text-base hover:shadow-xl hover:shadow-nyme-blue-light/30 transition-all duration-300 hover:-translate-y-1">
              📥 S'inscrire comme coursier
            </a>
          </div>

          {/* Gains mockup */}
          <div className={`transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="glass rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-nyme-blue-light/20">
              <h3 className="font-heading text-white text-lg sm:text-xl font-bold mb-4 sm:mb-6">💼 Exemple de gains quotidiens</h3>

              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                {deliveries.map((d, i) => (
                  <div key={i}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-300 ${activeDelivery === i ? 'bg-nyme-orange/10 border-nyme-orange/30' : 'bg-white/5 border-white/10'}`}>
                    <div>
                      <div className="text-white text-xs font-medium">{d.route}</div>
                      <div className="text-white/40 text-[10px]">{d.time}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-nyme-orange font-bold text-xs sm:text-sm">{d.price}</div>
                      <div className="text-green-400 text-[10px]">{d.gain}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-nyme-orange/20 to-nyme-orange/5 border border-nyme-orange/20">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white/70 text-xs sm:text-sm">Total journée (4 courses)</div>
                    <div className="text-white/40 text-[10px]">après commission NYME (15%)</div>
                  </div>
                  <div>
                    <div className="text-nyme-orange font-heading text-xl sm:text-2xl font-bold">12 400</div>
                    <div className="text-nyme-orange/60 text-[10px] text-right">FCFA</div>
                  </div>
                </div>
              </div>

              {/* Badge en développement */}
              <div className="mt-4 p-3 rounded-xl bg-nyme-blue/20 border border-nyme-blue-light/20 text-center">
                <p className="text-white/50 text-xs">🚧 Application en cours de développement</p>
                <p className="text-nyme-blue-light text-xs mt-1">Inscrivez-vous pour être notifié au lancement</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}p