'use client'

import { useState } from 'react'
import { CheckCircle, ArrowRight, Shield, Clock, Zap, Send, Package, TrendingUp, Users } from 'lucide-react'

const WHATSAPP_NUMBER = '22600000000'

const plans = [
  {
    name: 'Starter', price: '25 000', period: 'FCFA / mois',
    desc: 'Pour les particuliers actifs et petites boutiques',
    color: 'border-nyme-primary', badge: '', badgeColor: '',
    features: ["Jusqu'à 30 livraisons / mois", 'Livreur dédié assigné', 'Livraison sous 45 min', 'Suivi GPS en temps réel', 'Tableau de bord simple', 'Support par email'],
    cta: 'Choisir Starter', ctaStyle: 'btn-secondary',
  },
  {
    name: 'Business', price: '65 000', period: 'FCFA / mois',
    desc: 'Pour les boutiques et PME à Ouagadougou',
    color: 'border-nyme-orange', badge: '⭐ Populaire', badgeColor: 'bg-nyme-orange text-white',
    highlight: true,
    features: ["Jusqu'à 100 livraisons / mois", 'Livreur dédié quotidien', 'Livraison express sous 30 min', 'Suivi GPS en temps réel', 'Dashboard avancé + rapports', 'Traçabilité complète (photos)', 'Intégration WhatsApp Business', 'Support prioritaire 7j/7'],
    cta: 'Choisir Business', ctaStyle: 'btn-primary',
  },
  {
    name: 'Enterprise', price: 'Sur devis', period: '',
    desc: 'Pour les grandes entreprises et e-commerces',
    color: 'border-nyme-violet', badge: '🏢 Premium', badgeColor: 'bg-nyme-violet text-white',
    features: ['Livraisons illimitées', 'Équipe de livreurs dédiés', 'Livraison express garantie', "API d'intégration sur mesure", 'Dashboard multi-utilisateurs', 'Rapports analytiques détaillés', 'Gestionnaire de compte dédié', 'SLA garanti & support 24h/24'],
    cta: 'Nous contacter', ctaStyle: 'btn-secondary',
  },
]

const avantages = [
  { icon: Package,    title: 'Livreur dédié',          desc: 'Un coursier assigné uniquement à votre compte. Il connaît vos habitudes et vos adresses fréquentes.',     color: 'text-nyme-primary', bg: 'bg-nyme-primary/10' },
  { icon: Zap,        title: 'Livraison express',       desc: "Priorité absolue dans la file d'attente. Vos colis partent en premier, toujours.",                         color: 'text-nyme-orange',  bg: 'bg-nyme-orange/10'  },
  { icon: Shield,     title: 'Traçabilité totale',      desc: 'Photo à la récupération, photo à la livraison, signature digitale, historique complet.',                   color: 'text-nyme-green',   bg: 'bg-nyme-green/10'   },
  { icon: TrendingUp, title: 'Dashboard privé',         desc: 'Tableau de bord dédié avec statistiques, historique, dépenses et rapports exportables.',                  color: 'text-nyme-violet',  bg: 'bg-nyme-violet/10'  },
  { icon: Users,      title: 'Multi-utilisateurs',      desc: 'Plusieurs employés peuvent commander des livraisons depuis le même compte entreprise.',                    color: 'text-nyme-amber',   bg: 'bg-nyme-amber/10'   },
  { icon: Clock,      title: 'Disponibilité garantie',  desc: "Votre livreur est disponible pendant vos horaires d'activité définis à l'avance.",                        color: 'text-nyme-primary', bg: 'bg-nyme-primary/10' },
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
      setError(err.message || 'Erreur. Réessayez.')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-nyme-bg min-h-screen">

      {/* ── HERO ── */}
      <section className="section-hero relative overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-20">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nyme-orange/20 border border-nyme-orange/35 text-nyme-orange text-sm font-bold mb-6 font-body">
            ⭐ Espace Partenaires & Entreprises
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 leading-[1.05]">
            Un livreur dédié,<br />
            <span className="text-nyme-orange">chaque jour</span>
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-8 font-body">
            Vous avez des colis à envoyer régulièrement ? Abonnez-vous à NYME Partenaires. Un livreur vous est assigné, disponible tous les jours, pour livrer en express avec traçabilité complète.
          </p>
          <p className="text-white/55 text-sm font-body mb-6">
            Contact : <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">nyme.contact@gmail.com</a>
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <a href="#abonnements" className="btn-primary inline-flex items-center justify-center gap-2">
              Voir les abonnements <ArrowRight size={16} />
            </a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/12 border border-white/25 text-white font-bold hover:bg-white hover:text-nyme-primary transition-all duration-300 font-body">
              💬 WhatsApp direct
            </a>
          </div>
        </div>
      </section>

      {/* ── AVANTAGES ── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="badge mb-4">✦ Pourquoi choisir NYME Partenaires ?</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-nyme-text mb-3">
              Tout ce qu'il vous faut pour livrer sans effort
            </h2>
            <p className="text-nyme-text-muted text-base sm:text-lg max-w-xl mx-auto font-body">
              Une logistique clé en main, pensée pour les professionnels de Ouagadougou.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {avantages.map((a) => {
              const Icon = a.icon
              return (
                <div key={a.title} className="card p-5 sm:p-6">
                  <div className={`w-11 h-11 rounded-xl ${a.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={a.color} />
                  </div>
                  <h3 className="font-heading text-base font-bold text-nyme-text mb-2">{a.title}</h3>
                  <p className="text-nyme-text-muted text-sm leading-relaxed font-body">{a.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── ABONNEMENTS ── */}
      <section id="abonnements" className="py-16 sm:py-20 section-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <div className="badge badge-orange mb-4">💳 Abonnements mensuels</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-nyme-text mb-3">Choisissez votre formule</h2>
            <p className="text-nyme-text-muted text-base sm:text-lg max-w-xl mx-auto font-body">
              Engagement mensuel sans surprise. Résiliez à tout moment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`relative bg-white rounded-2xl sm:rounded-3xl border-2 ${plan.color} p-6 sm:p-7 flex flex-col shadow-card ${plan.highlight ? 'shadow-nyme-lg scale-[1.02] md:scale-105' : ''} transition-all duration-300 hover:shadow-card-hover`}>
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${plan.badgeColor} shadow-sm font-body`}>
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="font-heading text-xl font-black text-nyme-text mb-1">{plan.name}</h3>
                  <p className="text-nyme-text-muted text-sm mb-3 font-body">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`font-heading text-3xl sm:text-4xl font-black ${plan.highlight ? 'text-nyme-orange' : 'text-nyme-primary'}`}>{plan.price}</span>
                    {plan.period && <span className="text-nyme-text-muted text-sm font-body">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={15} className="text-nyme-green shrink-0 mt-0.5" />
                      <span className="text-nyme-text text-sm font-body">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <a href="#contact"
                    className={`flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${plan.ctaStyle}`}>
                    {plan.cta} <ArrowRight size={15} />
                  </a>
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Bonjour NYME, je souhaite m'abonner au plan ${plan.name} (${plan.price} ${plan.period}).`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-nyme-border text-nyme-text-muted text-xs font-semibold hover:border-nyme-green hover:text-nyme-green transition-all duration-200 font-body">
                    💬 Discuter sur WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="livreur-dedié" className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <div className="badge mb-4">✦ Processus</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-nyme-text mb-3">Comment ça fonctionne ?</h2>
            <p className="text-nyme-text-muted text-base sm:text-lg max-w-xl mx-auto font-body">
              En 4 étapes simples, votre logistique devient automatique.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {[
              { emoji:'📋', title:'Choisissez votre plan',      desc:'Sélectionnez la formule adaptée à votre volume mensuel de livraisons.' },
              { emoji:'🤝', title:'On vous assigne un livreur', desc:'Un coursier vérifié est dédié à votre compte dès le début du mois.' },
              { emoji:'📦', title:'Commandez à tout moment',    desc:"Via l'app, WhatsApp ou votre dashboard privé. Le livreur arrive en express." },
              { emoji:'📊', title:'Suivez tout en temps réel',  desc:'Photos, suivi GPS, historique complet et rapports mensuels téléchargeables.' },
            ].map((s, i) => (
              <div key={s.emoji} className="card p-4 sm:p-5 text-center">
                <div className="relative inline-flex mb-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-nyme-bg-input flex items-center justify-center text-xl sm:text-2xl">
                    {s.emoji}
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-nyme-primary text-white text-[10px] font-bold flex items-center justify-center font-body">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-heading text-sm font-bold text-nyme-text mb-1.5">{s.title}</h3>
                <p className="text-nyme-text-muted text-xs leading-relaxed font-body">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULAIRE ── */}
      <section id="contact" className="py-16 sm:py-20 section-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="badge mb-4">✉️ Devenir partenaire</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-nyme-text mb-3">Démarrons ensemble</h2>
            <p className="text-nyme-text-muted text-base sm:text-lg max-w-xl mx-auto font-body">
              Remplissez ce formulaire ou contactez-nous directement. On vous répond sous 4h.
            </p>
            <a href="mailto:nyme.contact@gmail.com" className="inline-block mt-2 text-nyme-orange font-bold text-sm hover:underline font-body">
              nyme.contact@gmail.com
            </a>
          </div>

          <div className="grid lg:grid-cols-5 gap-6 sm:gap-8">
            {/* Infos */}
            <div className="lg:col-span-2 space-y-4">
              {[
                { emoji:'⚡', title:'Réponse rapide',  sub:'Sous 4h en semaine' },
                { emoji:'🤝', title:'Sans engagement', sub:'Résiliez à tout moment' },
                { emoji:'🎯', title:'Sur mesure',      sub:'On adapte à vos besoins' },
              ].map((item) => (
                <div key={item.title} className="card p-4 flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <div className="font-bold text-nyme-text text-sm font-body">{item.title}</div>
                    <div className="text-nyme-text-muted text-xs font-body">{item.sub}</div>
                  </div>
                </div>
              ))}
              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-nyme-green text-white font-bold hover:bg-nyme-green/90 transition-all duration-300 shadow-md hover:shadow-lg font-body">
                <span className="text-xl">💬</span>
                <div className="text-left">
                  <div className="text-sm font-bold">WhatsApp direct</div>
                  <div className="text-xs text-white/70">Réponse instantanée</div>
                </div>
              </a>
            </div>

            {/* Formulaire */}
            <div className="lg:col-span-3">
              <div className="card p-5 sm:p-7">
                {sent ? (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="font-heading text-xl font-bold text-nyme-text mb-2">Demande envoyée !</h3>
                    <p className="text-nyme-text-muted text-sm mb-4 font-body">Nous vous recontacterons dans les 4 heures à <strong className="text-nyme-primary">nyme.contact@gmail.com</strong>.</p>
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 btn-primary text-sm">
                      💬 Suivre sur WhatsApp
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-nyme-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Entreprise / Nom *</label>
                        <input type="text" required value={form.entreprise} onChange={e => setForm({...form, entreprise: e.target.value})} placeholder="Ma Boutique SARL" className="input-nyme" />
                      </div>
                      <div>
                        <label className="block text-nyme-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Votre nom *</label>
                        <input type="text" required value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Prénom Nom" className="input-nyme" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-nyme-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Email *</label>
                        <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="vous@entreprise.com" className="input-nyme" />
                      </div>
                      <div>
                        <label className="block text-nyme-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Téléphone / WhatsApp *</label>
                        <input type="tel" required value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} placeholder="+226 XX XX XX XX" className="input-nyme" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-nyme-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Plan souhaité</label>
                      <select value={form.plan} onChange={e => setForm({...form, plan: e.target.value})} className="input-nyme">
                        <option value="">Choisir un plan</option>
                        <option value="Starter">Starter — 25 000 FCFA/mois</option>
                        <option value="Business">Business — 65 000 FCFA/mois</option>
                        <option value="Enterprise">Enterprise — Sur devis</option>
                        <option value="À discuter">Je veux en savoir plus</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-nyme-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Volume mensuel & besoins</label>
                      <textarea rows={4} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                        placeholder="Ex: J'envoie environ 50 colis/mois depuis ma boutique à Ouaga 2000..." className="input-nyme resize-none" />
                    </div>
                    {error && <div className="p-3 rounded-xl bg-nyme-red/10 border border-nyme-red/25 text-nyme-red text-sm font-body">⚠️ {error}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 py-3.5 disabled:opacity-70">
                        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi...</> : <><Send size={15} />Envoyer la demande</>}
                      </button>
                      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-nyme-green/10 border border-nyme-green/25 text-nyme-green font-bold text-sm hover:bg-nyme-green hover:text-white transition-all font-body">
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
