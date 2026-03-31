'use client'

import { useEffect, useRef, useState } from 'react'

const steps = [
  { step: '01', emoji: '📍', title: 'Saisissez départ & arrivée', desc: 'Indiquez d\'où part votre colis et où il doit aller. L\'app calcule le prix automatiquement en secondes.' },
  { step: '02', emoji: '💬', title: 'Négociez votre prix', desc: 'Acceptez le prix calculé ou proposez le vôtre. Les coursiers proches répondent avec leurs offres en temps réel.' },
  { step: '03', emoji: '🛵', title: 'Choisissez votre coursier', desc: 'Sélectionnez l\'offre qui vous convient. Tous les coursiers sont vérifiés, notés et identifiés.' },
  { step: '04', emoji: '📦', title: 'Suivez en direct', desc: 'Votre coursier est sur la carte en temps réel. Notifications à chaque étape. Livraison confirmée avec photo.' },
]

export default function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  // Animation auto des étapes
  useEffect(() => {
    if (!visible) return
    const t = setInterval(() => setActiveStep(s => (s + 1) % steps.length), 2000)
    return () => clearInterval(t)
  }, [visible])

  return (
    <section id="comment-ca-marche" className="py-16 sm:py-24 bg-nyme-blue-mid relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.08)_0%,transparent_70%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-blue-light/30 mb-4">
            <span className="text-nyme-blue-light text-xs sm:text-sm">✦ Processus</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 sm:mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-white/50 font-body text-base sm:text-lg max-w-xl mx-auto px-4">
            En 4 étapes simples, envoyez votre colis n'importe où à Ouagadougou.
          </p>
        </div>

        {/* Steps — vertical sur mobile, horizontal sur desktop */}
        <div className="relative">
          {/* Ligne de connexion desktop */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-transparent via-nyme-orange/30 to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {steps.map((step, i) => (
              <div
                key={step.step}
                className={`relative text-center group cursor-pointer transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 150}ms` }}
                onClick={() => setActiveStep(i)}
              >
                {/* Connecteur vertical mobile */}
                {i < steps.length - 1 && (
                  <div className="sm:hidden absolute left-1/2 bottom-0 translate-x-[-50%] translate-y-full w-0.5 h-6 bg-gradient-to-b from-nyme-orange/40 to-transparent" />
                )}

                <div className="relative inline-flex mb-4 sm:mb-6">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all duration-500 ${
                    activeStep === i
                      ? 'bg-gradient-to-br from-nyme-orange to-nyme-red shadow-nyme-orange/30 scale-110'
                      : 'bg-gradient-to-br from-nyme-blue to-nyme-blue-mid border border-nyme-orange/20'
                  }`}>
                    {step.emoji}
                  </div>
                  <div className={`absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    activeStep === i ? 'bg-nyme-orange border-nyme-orange' : 'bg-nyme-dark border-nyme-orange'
                  }`}>
                    <span className={`text-xs font-heading font-bold ${activeStep === i ? 'text-white' : 'text-nyme-orange'}`}>{i + 1}</span>
                  </div>
                </div>

                <h3 className={`font-heading text-base sm:text-lg font-bold mb-2 sm:mb-3 transition-colors duration-300 ${activeStep === i ? 'text-nyme-orange' : 'text-white'}`}>
                  {step.title}
                </h3>
                <p className="text-white/50 font-body text-xs sm:text-sm leading-relaxed px-2">{step.desc}</p>

                {/* Indicateur actif */}
                <div className={`mt-3 mx-auto h-0.5 rounded-full bg-nyme-orange transition-all duration-500 ${activeStep === i ? 'w-8' : 'w-0'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs dots mobile */}
        <div className="flex justify-center gap-2 mt-8 sm:hidden">
          {steps.map((_, i) => (
            <button key={i} onClick={() => setActiveStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${activeStep === i ? 'w-6 bg-nyme-orange' : 'w-1.5 bg-white/20'}`} />
          ))}
        </div>
      </div>
    </section>
  )
}