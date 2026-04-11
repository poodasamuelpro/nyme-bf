'use client'

import { useState } from 'react'
import { CheckCircle, ArrowRight, Shield, Clock, Zap, Send, Package, TrendingUp, Users } from 'lucide-react'

const WHATSAPP_NUMBER = '2260077980264'

const plans = [
  {
    name: 'Starter', price: '45 000', period: 'FCFA / mois',
    desc: 'Pour les particuliers actifs et petites boutiques',
    color: 'border-nyme-primary', badge: '', badgeColor: '',
    features: [
      "Jusqu'à 40 livraisons / mois",
      'Livreur dédié assigné',
      'Livraison sous 45 min',
      'Suivi GPS en temps réel',
      'Tableau de bord simple',
      'Support par email',
    ],
    cta: 'Choisir Starter', ctaStyle: 'btn-secondary',
  },
  {
    name: 'Business', price: '90 000', period: 'FCFA / mois',
    desc: 'Pour les boutiques et PME à Ouagadougou',
    color: 'border-nyme-orange', badge: '⭐ Populaire', badgeColor: 'bg-nyme-orange text-white',
    highlight: true,
    features: [
      "Jusqu'à 100 livraisons / mois",
      'Livreur dédié quotidien',
      'Livraison express sous 30 min',
      'Suivi GPS en temps réel',
      'Dashboard avancé + rapports',
      'Traçabilité complète (photos)',
      'Communication WhatsApp Business',
      'Support prioritaire 7j/7',
    ],
    cta: 'Choisir Business', ctaStyle: 'btn-primary',
  },
  {
    name: 'Enterprise', price: 'Sur devis', period: '',
    desc: 'Pour les grandes entreprises et e-commerces',
    color: 'border-nyme-violet', badge: '🏢 Premium', badgeColor: 'bg-nyme-violet text-white',
    features: [
      'Volume illimité de livraisons',
      'Équipe de livreurs dédiés',
      'Livraison express garantie',
      'Dashboard multi-utilisateurs',
      'Rapports analytiques détaillés',
      'Gestionnaire de compte dédié',
      'Niveau de service garanti',
      'Support 24h/24, 7j/7',
    ],
    cta: 'Nous contacter', ctaStyle: 'btn-secondary',
  },
]

const avantages = [
  { icon: Package,    title: 'Livreur dédié',         desc: 'Un coursier assigné exclusivement à votre compte. Il connaît vos adresses fréquentes et s'adapte à vos horaires.',          color: 'text-nyme-primary', bg: 'bg-nyme-primary/10' },
  { icon: Zap,        title: 'Livraison express',      desc: "Priorité absolue dans l'attribution des courses. Vos commandes partent en premier, systématiquement.",                     color: 'text-nyme-orange',  bg: 'bg-nyme-orange/10'  },
  { icon: Shield,     title: 'Traçabilité complète',   desc: 'Photo à la récupération, photo à la livraison, confirmation de réception, historique complet exportable.',               color: 'text-nyme-green',   bg: 'bg-nyme-green/10'   },
  { icon: TrendingUp, title: 'Tableau de bord dédié',  desc: 'Espace privé avec statistiques, historique des livraisons, suivi des dépenses et rapports mensuels téléchargeables.',    color: 'text-nyme-violet',  bg: 'bg-nyme-violet/10'  },
  { icon: Users,      title: 'Multi-utilisateurs',     desc: 'Plusieurs collaborateurs peuvent commander des livraisons depuis le même compte entreprise, avec des rôles définis.',     color: 'text-nyme-amber',   bg: 'bg-nyme-amber/10'   },
  { icon: Clock,      title: 'Disponibilité planifiée', desc: "Votre livreur est disponible pendant vos horaires d'activité définis à l'avance. Zéro improvisation.",                color: 'text-nyme-primary', bg: 'bg-nyme-primary/10' },
]

export default function PartenairesClient() {
  const [form,    setForm]    = useState({ entreprise: '', nom: '', email: '', telephone: '', plan: '', message: '' })
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const whatsappMsg = encodeURIComponent(
    `Bonjour NYME 👋\n\nJe suis intéressé par l'Espace Partenaires.\n\nEntreprise: ${form.entreprise || '...'}\nNom: ${form.nom || '...'}\nPlan souhaité: ${form.plan || 'À définir'}\n\nMerci de me recontacter.`
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: `${form.nom} (${form.entreprise})`, email: form.email, sujet: `Partenariat ${form.plan}`, message: `Téléphone: ${form.telephone}\n\n${form.message}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Erreur. Veuillez réessayer.')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-nyme-dark min-h-screen">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-20 bg-nyme-dark">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,79,191,0.25)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(232,119,34,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(232,119,34,0.8) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nyme-orange/20 border border-nyme-orange/35 text-nyme-orange text-sm font-bold mb-6 font-body">
            ⭐ Espace Partenaires & Entreprises
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 leading-[1.05]">
            Un livreur dédié,<br />
            <span className="text-nyme-orange">chaque jour</span>
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-8 font-body">
            Vous avez des colis à envoyer régulièrement ? L'offre NYME Partenaires est faite pour vous. Un coursier vérifié vous est assigné, disponible tous les jours, pour livrer en express avec traçabilité complète — à un tarif mensuel maîtrisé.
          </p>
          <p className="text-white/55 text-sm font-body mb-6">
            Contact direct :{' '}
            <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">nyme.contact@gmail.com</a>
            {' '}· <a href="tel:+22677980264" className="text-nyme-orange hover:underline font-semibold">+226 77 98 02 64</a>
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <a href="#abonnements" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold hover:shadow-xl hover:shadow-nyme-orange/35 transition-all duration-300 hover:-translate-y-1 font-body">
              Voir les abonnements <ArrowRight size={16} />
            </a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl glass border border-white/25 text-white font-bold hover:bg-white hover:text-nyme-primary transition-all duration-300 font-body">
              💬 WhatsApp direct
            </a>
          </div>
        </div>
      </section>

      {/* ── AVANTAGES ── */}
      <section className="py-16 sm:py-20 bg-nyme-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-orange/25 mb-4">
              <span className="text-nyme-orange text-xs sm:text-sm font-semibold font-body">✦ Pourquoi choisir NYME Partenaires ?</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white mb-3">
              Une logistique clé en main
            </h2>
            <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto font-body">
              Pensée pour les professionnels actifs de Ouagadougou qui ont besoin de fiabilité au quotidien.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {avantages.map((a) => {
              const Icon = a.icon
              return (
                <div key={a.title} className="glass border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-nyme-orange/25 transition-all duration-300">
                  <div className={`w-11 h-11 rounded-xl ${a.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={a.color} />
                  </div>
                  <h3 className="font-heading text-base font-bold text-white mb-2">{a.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed font-body">{a.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── ABONNEMENTS ── */}
      <section id="abonnements" className="py-16 sm:py-20 bg-nyme-blue-mid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-orange/25 mb-4">
              <span className="text-nyme-orange text-xs sm:text-sm font-semibold font-body">💳 Abonnements mensuels</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white mb-3">Choisissez votre formule</h2>
            <p className="text-white/70 text-base sm:text-lg max-w-xl mx-auto font-body">
              Engagement mensuel, sans mauvaise surprise. Résiliez à tout moment, sans frais.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`relative glass border-2 ${plan.color} rounded-2xl sm:rounded-3xl p-6 sm:p-7 flex flex-col ${plan.highlight ? 'border-nyme-orange shadow-xl shadow-nyme-orange/15 scale-[1.02] md:scale-105' : ''} transition-all duration-300 hover:scale-[1.03]`}>
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${plan.badgeColor} shadow-sm font-body`}>
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="font-heading text-xl font-black text-white mb-1">{plan.name}</h3>
                  <p className="text-sm mb-3 font-body text-white/55">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`font-heading text-3xl sm:text-4xl font-black ${plan.highlight ? 'text-nyme-orange' : 'text-white'}`}>{plan.price}</span>
                    {plan.period && <span className="text-sm font-body text-white/55">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={15} className="text-nyme-orange shrink-0 mt-0.5" />
                      <span className="text-sm font-body text-white/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <a href="#contact"
                    className={`flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white hover:shadow-lg hover:shadow-nyme-orange/35'
                        : 'glass border border-white/25 text-white hover:border-nyme-orange/50 hover:bg-nyme-orange/10'
                    }`}>
                    {plan.cta} <ArrowRight size={15} />
                  </a>
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Bonjour NYME, je souhaite m'abonner au plan ${plan.name} (${plan.price} ${plan.period}).`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/15 text-xs font-semibold hover:border-green-400/50 hover:text-green-400 transition-all duration-200 font-body text-white/55">
                    💬 Discuter sur WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça fonctionne ── */}
      <section id="livreur-dedie" className="py-16 sm:py-20 bg-nyme-dark">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-blue-light/35 mb-4">
              <span className="text-nyme-blue-light text-xs sm:text-sm font-semibold font-body">✦ Processus</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white mb-3">Comment ça fonctionne ?</h2>
            <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto font-body">
              En 4 étapes simples, votre logistique quotidienne devient entièrement automatisée.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {[
              { emoji:'📋', title:'Choisissez votre formule',    desc:'Sélectionnez le plan adapté à votre volume mensuel de livraisons et contactez-nous pour démarrer.' },
              { emoji:'🤝', title:'Un livreur vous est assigné', desc:'Un coursier vérifié et dédié est attribué à votre compte dès le premier jour du mois.' },
              { emoji:'📦', title:'Commandez quand vous voulez', desc:"Via l'application web, WhatsApp ou votre tableau de bord. Votre livreur est prêt, sans délai." },
              { emoji:'📊', title:'Pilotez tout en temps réel',  desc:'Photos de confirmation, suivi GPS, historique complet et rapports mensuels exportables en quelques clics.' },
            ].map((s, i) => (
              <div key={s.emoji} className="glass border border-white/10 rounded-2xl p-4 sm:p-5 text-center hover:border-nyme-orange/25 transition-all duration-300">
                <div className="relative inline-flex mb-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/10 flex items-center justify-center text-xl sm:text-2xl">
                    {s.emoji}
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-nyme-orange text-white text-[10px] font-bold flex items-center justify-center font-body">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-heading text-sm font-bold text-white mb-1.5">{s.title}</h3>
                <p className="text-white/55 text-xs leading-relaxed font-body">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULAIRE CONTACT ── */}
      <section id="contact" className="py-16 sm:py-20 bg-nyme-blue-mid">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-nyme-orange/25 mb-4">
              <span className="text-nyme-orange text-xs sm:text-sm font-semibold font-body">✉️ Devenir partenaire</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-white mb-3">Démarrons ensemble</h2>
            <p className="text-white/70 text-base sm:text-lg max-w-xl mx-auto font-body">
              Remplissez ce formulaire ou contactez-nous directement. Notre équipe vous répond sous 4 heures.
            </p>
            <a href="mailto:nyme.contact@gmail.com" className="inline-block mt-2 text-nyme-orange font-bold text-sm hover:underline font-body">
              nyme.contact@gmail.com
            </a>
          </div>

          <div className="grid lg:grid-cols-5 gap-6 sm:gap-8">
            {/* Infos rapides */}
            <div className="lg:col-span-2 space-y-4">
              {[
                { emoji:'⚡', title:'Réponse rapide',   sub:'Sous 4h en jours ouvrés' },
                { emoji:'🤝', title:'Sans engagement',  sub:'Résiliez à tout moment' },
                { emoji:'🎯', title:'Sur mesure',       sub:'Nous adaptons la solution à vos besoins' },
              ].map((item) => (
                <div key={item.title} className="glass border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <div className="font-bold text-sm font-body text-white">{item.title}</div>
                    <div className="text-xs font-body text-white/55">{item.sub}</div>
                  </div>
                </div>
              ))}
              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-green-500/20 border border-green-500/35 text-green-400 font-bold hover:bg-green-500 hover:text-white transition-all duration-300 shadow-md hover:shadow-lg font-body">
                <span className="text-xl">💬</span>
                <div className="text-left">
                  <div className="text-sm font-bold">WhatsApp direct</div>
                  <div className="text-xs text-green-300/70">Réponse instantanée</div>
                </div>
              </a>
            </div>

            {/* Formulaire */}
            <div className="lg:col-span-3">
              <div className="glass border border-white/10 rounded-2xl p-5 sm:p-7">
                {sent ? (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="font-heading text-xl font-bold text-white mb-2">Demande envoyée !</h3>
                    <p className="text-sm mb-4 font-body text-white/70">
                      Notre équipe vous recontactera dans les 4 heures à{' '}
                      <strong className="text-nyme-orange">nyme.contact@gmail.com</strong>.
                    </p>
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm hover:shadow-lg hover:shadow-nyme-orange/35 transition-all font-body">
                      💬 Suivre sur WhatsApp
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Entreprise / Activité *</label>
                        <input type="text" required value={form.entreprise} onChange={e => setForm({...form, entreprise: e.target.value})} placeholder="Ma Boutique / Nom" className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Votre nom *</label>
                        <input type="text" required value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Prénom Nom" className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Email *</label>
                        <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="vous@exemple.com" className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Téléphone / WhatsApp *</label>
                        <input type="tel" required value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="+226 XX XX XX XX" className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Formule souhaitée</label>
                      <select value={form.plan} onChange={e => setForm({...form, plan: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white focus:outline-none focus:border-nyme-orange/55 font-body text-sm">
                        <option value="">Choisir une formule</option>
                        <option value="Starter">Starter — 45 000 FCFA/mois</option>
                        <option value="Business">Business — 90 000 FCFA/mois</option>
                        <option value="Enterprise">Enterprise — Sur devis</option>
                        <option value="À discuter">Je veux en savoir plus d'abord</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Volume mensuel & besoins spécifiques</label>
                      <textarea rows={4} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                        placeholder="Ex : J'envoie environ 40 colis/mois depuis ma boutique à Ouaga 2000, zone Dassasgho..." className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm resize-none" />
                    </div>
                    {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-body">⚠️ {error}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm hover:shadow-lg hover:shadow-nyme-orange/35 transition-all disabled:opacity-70 font-body">
                        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi...</> : <><Send size={15} />Envoyer la demande</>}
                      </button>
                      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 font-bold text-sm hover:bg-green-500 hover:text-white transition-all font-body">
                        💬 WhatsApp
                      </a>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
