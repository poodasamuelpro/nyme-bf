'use client'
import { useState } from 'react'
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, ChevronRight } from 'lucide-react'

const WHATSAPP = '22677980264'

export default function ContactClient() {
  const [form,    setForm]    = useState({ nom: '', email: '', sujet: '', message: '' })
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue. Réessayez ou contactez-nous directement.')
    } finally { setLoading(false) }
  }

  const cards = [
    { icon: Phone,  title: 'Téléphone',   content: '+226 77 98 02 64',   sub: 'Lun–Sam, 7h–21h',    href: 'tel:+22677980264',           accent: 'border-l-nyme-orange' },
    { icon: Mail,   title: 'Email',        content: 'nyme.contact@gmail.com', sub: 'Réponse sous 24h',   href: 'mailto:nyme.contact@gmail.com', accent: 'border-l-nyme-blue-light' },
    { icon: MapPin, title: 'Localisation', content: 'Ouagadougou, BF',        sub: "Afrique de l'Ouest", href: '#',                             accent: 'border-l-green-400' },
    { icon: Clock,  title: 'Horaires',     content: 'Lun–Sam : 7h–21h',      sub: 'Dimanche : 8h–18h',  href: '/service-client',               accent: 'border-l-purple-400' },
  ]

  return (
    <div className="min-h-screen bg-nyme-dark pt-20 sm:pt-28 pb-16">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden py-12 sm:py-16 mb-10 sm:mb-14 bg-nyme-dark">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,79,191,0.25)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(232,119,34,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-white/25 text-white text-xs sm:text-sm font-semibold mb-5 font-body">
            <MessageSquare size={13} /> Contactez-nous
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-3">
            On est là pour vous
          </h1>
          <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto font-body leading-relaxed">
            Une question, un problème, un partenariat ? L'équipe NYME répond sous 24h à{' '}
            <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange font-semibold hover:underline">
              nyme.contact@gmail.com
            </a>
          </p>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Bonjour NYME, j'ai une question...")}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl bg-green-500/20 border border-green-500/50 text-green-400 font-semibold text-sm hover:bg-green-500 hover:text-white transition-all duration-300 font-body"
          >
            💬 Écrire sur WhatsApp
          </a>
        </div>
      </div>

      {/* ── Contenu principal ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Cards mobiles 2×2 ── */}
        <div className="grid grid-cols-2 gap-3 mb-6 lg:hidden">
          {cards.map(({ icon: Icon, title, content, sub, href, accent }) => (
            <a key={title} href={href} className={`glass border border-white/10 border-l-4 ${accent} rounded-2xl p-3 sm:p-4 flex items-start gap-2.5 hover:scale-[1.02] transition-transform`}>
              <Icon size={15} className="text-nyme-orange shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[9px] sm:text-xs uppercase tracking-wider mb-0.5 font-body font-semibold text-white/55">{title}</div>
                <div className="font-bold text-[11px] sm:text-xs truncate font-body text-white">{content}</div>
                <div className="text-[9px] sm:text-xs font-body text-white/45">{sub}</div>
              </div>
            </a>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-7 lg:gap-10">

          {/* ── Sidebar desktop ── */}
          <div className="hidden lg:block lg:col-span-1 space-y-3">
            {cards.map(({ icon: Icon, title, content, sub, href, accent }) => (
              <a key={title} href={href} className={`glass border border-white/10 border-l-4 ${accent} rounded-2xl p-5 flex items-start gap-4 hover:scale-[1.02] hover:border-nyme-orange/25 transition-all`}>
                <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-nyme-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider mb-0.5 font-body font-semibold text-white/55">{title}</div>
                  <div className="font-bold text-sm font-body text-white">{content}</div>
                  <div className="text-xs font-body text-white/45">{sub}</div>
                </div>
                <ChevronRight size={14} className="ml-auto mt-1 shrink-0 text-white/30" />
              </a>
            ))}

            <div id="partenaires" className="glass border border-white/10 border-t-4 border-t-nyme-orange rounded-2xl p-5">
              <h3 className="font-heading font-bold mb-2 text-base text-white">⭐ Partenariats professionnels</h3>
              <p className="text-sm leading-relaxed mb-3 font-body text-white/55">
                Vous êtes une boutique ou une entreprise à Ouagadougou ? Découvrez nos abonnements mensuels avec livreur dédié.
              </p>
              <a href="/partenaires" className="text-nyme-orange text-sm font-bold hover:underline font-body">
                Voir l'espace partenaires →
              </a>
            </div>
          </div>

          {/* ── Formulaire ── */}
          <div className="lg:col-span-2">
            <div className="glass border border-white/10 rounded-2xl p-5 sm:p-8">
              {sent ? (
                <div className="text-center py-10 sm:py-14">
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="font-heading text-xl sm:text-2xl font-bold text-white mb-2">Message envoyé !</h2>
                  <p className="text-sm font-body text-white/70">
                    Merci. L'équipe NYME vous répondra sous 24h à{' '}
                    <strong className="text-nyme-orange">nyme.contact@gmail.com</strong>.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                    <button
                      onClick={() => { setSent(false); setForm({ nom:'', email:'', sujet:'', message:'' }) }}
                      className="glass border border-white/20 text-white font-semibold text-sm py-2.5 px-5 rounded-xl hover:border-nyme-orange/45 transition-all font-body"
                    >
                      Envoyer un autre message
                    </button>
                    <a
                      href={`https://wa.me/${WHATSAPP}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-sm font-bold hover:bg-green-500 hover:text-white transition-all font-body"
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-heading text-xl sm:text-2xl font-black text-white mb-1">Envoyer un message</h2>
                  <p className="text-sm mb-5 sm:mb-6 font-body text-white/55">
                    Ou écrivez directement à{' '}
                    <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange font-semibold hover:underline">
                      nyme.contact@gmail.com
                    </a>
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Nom complet *</label>
                        <input type="text" required value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Votre nom" className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Email *</label>
                        <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="votre@email.com" className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Sujet *</label>
                      <select required value={form.sujet} onChange={e => setForm({...form, sujet: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white focus:outline-none focus:border-nyme-orange/55 font-body text-sm">
                        <option value="">Choisir un sujet</option>
                        <option value="support">Support technique</option>
                        <option value="livraison">Problème de livraison</option>
                        <option value="coursier">Devenir coursier</option>
                        <option value="partenariat">Partenariat entreprise</option>
                        <option value="paiement">Problème de paiement</option>
                        <option value="compte">Question sur mon compte</option>
                        <option value="autre">Autre demande</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold mb-1.5 font-body text-white/55">Message *</label>
                      <textarea required rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                        placeholder="Décrivez votre demande en détail. Nous vous répondons sous 24 heures." className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/55 font-body text-sm resize-none" />
                    </div>
                    {error && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-body">⚠️ {error}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm hover:shadow-lg hover:shadow-nyme-orange/35 transition-all disabled:opacity-70 font-body">
                        {loading
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Envoi...</>
                          : <><Send size={15} />Envoyer</>}
                      </button>
                      <a
                        href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Bonjour NYME, je vous contacte via le site.\n\nNom: ${form.nom}\nSujet: ${form.sujet}\n\n${form.message}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 font-bold text-sm hover:bg-green-500 hover:text-white transition-all font-body"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}