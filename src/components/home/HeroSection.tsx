'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Star, Shield, MapPin, Clock } from 'lucide-react'

function MotoAnimee({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="44" r="12" stroke="#E87722" strokeWidth="3" fill="none"/>
      <circle cx="22" cy="44" r="5" fill="#E87722" opacity="0.4"/>
      <circle cx="90" cy="44" r="12" stroke="#E87722" strokeWidth="3" fill="none"/>
      <circle cx="90" cy="44" r="5" fill="#E87722" opacity="0.4"/>
      <path d="M28 32 L50 20 L75 20 L90 32 L88 44 L24 44 Z" fill="#0A2E8A" stroke="#1A4FBF" strokeWidth="1.5"/>
      <path d="M50 20 L65 14 L80 20" stroke="#E87722" strokeWidth="2" fill="none"/>
      <path d="M80 20 L90 16 L92 22" stroke="#9CA3AF" strokeWidth="2"/>
      <path d="M42 20 L68 20 L65 14 L45 14 Z" fill="#1A4FBF"/>
      <ellipse cx="58" cy="12" rx="7" ry="9" fill="#E87722"/>
      <circle cx="58" cy="4" r="6" fill="#FBBF24"/>
      <path d="M52 3 Q58 -3 64 3 Q65 8 58 9 Q51 8 52 3Z" fill="#0A2E8A"/>
      <path d="M62 10 L78 18" stroke="#E87722" strokeWidth="3" strokeLinecap="round"/>
      <rect x="28" y="22" width="14" height="10" rx="2" fill="#E87722" stroke="#F59E0B" strokeWidth="1"/>
      <line x1="35" y1="22" x2="35" y2="32" stroke="#F59E0B" strokeWidth="1"/>
      <line x1="28" y1="27" x2="42" y2="27" stroke="#F59E0B" strokeWidth="1"/>
      <line x1="0" y1="40" x2="12" y2="40" stroke="#E87722" strokeWidth="2" strokeDasharray="3,2" opacity="0.6"/>
      <line x1="0" y1="35" x2="8" y2="35" stroke="#E87722" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.4"/>
      <line x1="0" y1="45" x2="10" y2="45" stroke="#E87722" strokeWidth="1" strokeDasharray="3,2" opacity="0.3"/>
    </svg>
  )
}

const statuts = [
  { text: 'En attente...',        color: 'text-yellow-400',      dot: 'bg-yellow-400'      },
  { text: 'Coursier trouvé !',    color: 'text-nyme-orange',     dot: 'bg-nyme-orange'     },
  { text: 'En route vers vous',   color: 'text-nyme-blue-light', dot: 'bg-nyme-blue-light' },
  { text: 'Colis récupéré ✓',    color: 'text-green-400',       dot: 'bg-green-400'       },
  { text: 'Livraison en cours',   color: 'text-nyme-orange',     dot: 'bg-nyme-orange'     },
]

export default function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [statutIdx, setStatutIdx] = useState(0)
  const [motoPos,   setMotoPos]   = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(24px)'
    setTimeout(() => {
      el.style.transition = 'all 0.8s ease-out'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }, 150)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setStatutIdx(i => (i + 1) % statuts.length), 2500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let frame: number
    let pos = 0
    const animate = () => {
      pos = (pos + 0.3) % 100
      setMotoPos(pos)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const statut = statuts[statutIdx]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-nyme-dark">
      {/* Fond animé */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-16 left-4 sm:left-10 w-48 sm:w-72 h-48 sm:h-72 rounded-full bg-nyme-primary/40 blur-3xl animate-pulse-slow" />
        <div className="absolute top-32 right-4 sm:right-16 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-nyme-orange/10 blur-3xl animate-float" style={{ animationDelay: '-2s' }} />
        <div className="absolute bottom-16 left-1/3 w-56 sm:w-80 h-56 sm:h-80 rounded-full bg-nyme-blue-light/15 blur-3xl animate-pulse-slow" style={{ animationDelay: '-4s' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(232,119,34,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(232,119,34,0.8) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Orbes */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-nyme-orange/20 animate-float"
            style={{ width: `${6 + i * 3}px`, height: `${6 + i * 3}px`, top: `${20 + i * 14}%`, left: `${3 + i * 18}%`, animationDelay: `${-i * 1.1}s`, animationDuration: `${5 + i}s` }} />
        ))}
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* ── GAUCHE ── */}
          <div ref={ref} className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-orange/35 mb-5 sm:mb-6">
              <div className="w-2 h-2 rounded-full bg-nyme-orange animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm text-nyme-orange font-body font-semibold">🇧🇫 Bientôt à Ouagadougou</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.05] mb-5 sm:mb-6">
              <span className="text-white">Livraison</span><br />
              <span className="text-gradient">Rapide &</span><br />
              <span className="text-white">Intelligente</span>
            </h1>

            <p className="text-white/70 text-base sm:text-lg font-body leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
              Envoyez vos colis en quelques secondes. Négociez votre prix, suivez votre coursier en temps réel, payez avec Orange Money, Moov Money ou Wave.
            </p>

            <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-3 mb-6 sm:mb-8">
              {[
                { icon: Shield, text: 'Coursiers vérifiés' },
                { icon: MapPin, text: 'Suivi GPS live' },
                { icon: Clock,  text: '30 min' },
                { icon: Star,   text: '4.8★' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/6 border border-white/12">
                  <Icon size={12} className="text-nyme-orange shrink-0" />
                  <span className="text-white/80 text-xs font-body font-medium">{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4 mb-8 sm:mb-10">
              <a href="#telecharger" className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm sm:text-base hover:shadow-xl hover:shadow-nyme-orange/35 transition-all duration-300 hover:-translate-y-1 font-body">
                Commander maintenant <ArrowRight size={16} />
              </a>
              <a href="/#devenir-coursier" className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 rounded-2xl glass border border-white/22 text-white font-semibold text-sm sm:text-base hover:border-nyme-orange/45 transition-all duration-300 font-body">
                Devenir coursier
              </a>
            </div>

            {/* Preuve sociale */}
            <div className="flex items-center justify-center lg:justify-start gap-3 sm:gap-4">
              <div className="flex -space-x-2">
                {[['bg-nyme-orange','A'],['bg-nyme-blue-light','M'],['bg-nyme-red','S'],['bg-green-500','F']].map(([c, l]) => (
                  <div key={l} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${c} border-2 border-nyme-dark flex items-center justify-center text-xs font-bold text-white font-body`}>{l}</div>
                ))}
              </div>
              <div>
                <div className="text-white font-bold text-xs sm:text-sm font-body">+2 000 utilisateurs</div>
                <div className="text-white/45 text-xs font-body">nous font déjà confiance</div>
              </div>
            </div>
          </div>

          {/* ── DROITE ── */}
          <div className="relative flex flex-col items-center justify-center gap-6 mt-4 lg:mt-0">

            {/* Route animée */}
            <div className="relative w-full max-w-xs sm:max-w-sm mx-auto">
              <div className="relative w-full h-32 sm:h-36 rounded-2xl overflow-hidden bg-gradient-to-br from-nyme-blue-mid to-nyme-primary border border-nyme-orange/22">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(232,119,34,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(232,119,34,0.6) 1px,transparent 1px)', backgroundSize: '18px 18px' }} />
                <div className="absolute bottom-8 left-0 right-0 h-6 bg-white/5 border-t border-b border-white/10">
                  <div className="absolute inset-y-0 left-1/4 right-1/4 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-white/20" />
                  </div>
                </div>
                <div className="absolute bottom-5" style={{ left: `${motoPos}%`, transform: 'translateX(-50%)', transition: 'none' }}>
                  <MotoAnimee className="w-16 sm:w-20 h-auto" />
                </div>
                <div className="absolute top-3 left-4 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white animate-pulse" />
                  <span className="text-white/70 text-[10px] font-body">Hamdallaye</span>
                </div>
                <div className="absolute top-3 right-4 flex items-center gap-1.5">
                  <span className="text-white/70 text-[10px] font-body">Ouaga 2000</span>
                  <div className="w-3 h-3 rounded-full bg-nyme-orange border-2 border-white" />
                </div>
                <div className="absolute bottom-2 right-3 bg-white/12 backdrop-blur rounded-lg px-2 py-0.5">
                  <span className="text-white text-[10px] font-semibold font-body">~8 min</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl glass border border-white/12">
                <div className={`w-2 h-2 rounded-full ${statut.dot} animate-pulse shrink-0`} />
                <span className={`text-xs font-body font-semibold transition-all duration-500 ${statut.color}`}>{statut.text}</span>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="relative hidden xs:flex sm:flex items-center justify-center">
              <div className="relative animate-float w-52 sm:w-64 md:w-72">
                <div className="w-full aspect-[9/18] rounded-[2.5rem] bg-gradient-to-br from-nyme-primary to-nyme-dark border-2 border-nyme-orange/22 shadow-2xl shadow-nyme-orange/12 overflow-hidden">
                  <div className="h-8 bg-nyme-blue-mid/80 flex items-center justify-between px-5 pt-1">
                    <span className="text-white/65 text-[10px] font-body">09:41</span>
                    <div className="flex gap-0.5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-2 w-0.5 rounded-sm ${i < 3 ? 'bg-white/65' : 'bg-white/22'}`} />
                      ))}
                    </div>
                  </div>
                  {/* Map */}
                  <div className="mx-2.5 mt-2 h-32 sm:h-36 rounded-xl overflow-hidden relative bg-gradient-to-br from-nyme-blue-mid to-nyme-primary">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(232,119,34,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(232,119,34,0.6) 1px,transparent 1px)', backgroundSize: '16px 16px' }} />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 240 150">
                      <path d="M40,120 Q80,60 140,45 Q180,35 210,30" stroke="#E87722" strokeWidth="2.5" fill="none" strokeDasharray="6,3">
                        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="3s" repeatCount="indefinite" />
                      </path>
                      <circle cx="40" cy="120" r="6" fill="#10B981" />
                      <circle cx="210" cy="30" r="6" fill="#E87722" />
                      <g style={{ animation: 'moveMoto 4s linear infinite' }}>
                        <ellipse cx="120" cy="75" rx="14" ry="7" fill="#0A2E8A" stroke="#1A4FBF" strokeWidth="1"/>
                        <circle cx="108" cy="79" r="5" stroke="#E87722" strokeWidth="1.5" fill="none"/>
                        <circle cx="132" cy="79" r="5" stroke="#E87722" strokeWidth="1.5" fill="none"/>
                        <circle cx="120" cy="68" r="4" fill="#FBBF24"/>
                        <rect x="113" y="68" width="8" height="6" rx="1" fill="#E87722"/>
                      </g>
                      <circle cx="120" cy="75" r="14" fill="#E87722" opacity="0.15">
                        <animate attributeName="r" from="10" to="20" dur="2s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                    <div className="absolute bottom-1.5 right-2 bg-white/12 backdrop-blur rounded-md px-1.5 py-0.5">
                      <span className="text-white text-[9px] font-semibold font-body">~12 min</span>
                    </div>
                  </div>
                  {/* Carte coursier */}
                  <div className="mx-2.5 mt-2 p-3 rounded-xl bg-gradient-to-br from-nyme-orange/22 to-nyme-orange/5 border border-nyme-orange/22">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold text-[11px] font-body">Course en cours</span>
                      <span className="text-nyme-orange text-[9px] px-1.5 py-0.5 rounded-full bg-nyme-orange/12 font-body">En route</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-nyme-orange flex items-center justify-center text-white font-bold text-xs shrink-0 font-body">M</div>
                      <div>
                        <div className="text-white text-[11px] font-semibold font-body">Moussa K.</div>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => <Star key={i} size={8} className="fill-nyme-orange text-nyme-orange" />)}
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-nyme-orange font-bold text-sm font-heading">3 500</div>
                        <div className="text-white/45 text-[9px] font-body">FCFA</div>
                      </div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="mx-2.5 mt-2 grid grid-cols-3 gap-1.5">
                    {['📞 Appeler', '💬 Chat', '📤 Partager'].map((a) => (
                      <div key={a} className="py-1.5 rounded-lg bg-white/6 border border-white/10 text-center text-[9px] text-white/65 font-body">{a}</div>
                    ))}
                  </div>
                </div>

                {/* Notification flottante */}
                <div className="absolute -top-4 -right-4 sm:-right-10 glass border border-nyme-orange/35 rounded-xl px-3 py-2 shadow-xl animate-float" style={{ animationDelay: '-3s' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <div>
                      <div className="text-white text-[10px] font-bold whitespace-nowrap font-body">Colis récupéré !</div>
                      <div className="text-white/45 text-[9px] font-body">il y a 2 min</div>
                    </div>
                  </div>
                </div>

                {/* Prix chip */}
                <div className="absolute -bottom-3 -left-4 sm:-left-8 glass border border-nyme-blue-light/35 rounded-xl px-3 py-1.5 shadow-xl animate-float" style={{ animationDelay: '-1.5s' }}>
                  <div className="text-white/55 text-[9px] font-body">Prix négocié</div>
                  <div className="text-nyme-orange font-heading font-bold text-sm">3 500 FCFA</div>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 rounded-full border border-nyme-orange/10 animate-ping" style={{ animationDuration: '3s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 animate-bounce">
        <span className="text-white/35 text-[10px] tracking-widest uppercase font-body">Défiler</span>
        <div className="w-5 h-7 rounded-full border border-white/22 flex justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-nyme-orange animate-bounce" />
        </div>
      </div>

      <style jsx>{`
        @keyframes moveMoto {
          0%   { transform: translateX(-60px); }
          100% { transform: translateX(60px); }
        }
      `}</style>
    </section>
  )
}
