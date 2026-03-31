import Link from 'next/link'
import { Zap, MapPin, Phone, Mail, Facebook, Instagram, Twitter } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="relative bg-nyme-blue-mid border-t border-nyme-orange/10 overflow-hidden">
      <div className="absolute top-0 left-1/4 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-nyme-orange/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-48 sm:w-64 h-48 sm:h-64 rounded-full bg-nyme-blue-light/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">

          {/* Brand — pleine largeur sur mobile */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-nyme-orange to-nyme-red flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tracking-wider">NYME</span>
            </Link>
            <p className="text-white/50 text-xs sm:text-sm font-body leading-relaxed mb-4 sm:mb-6 max-w-xs">
              La plateforme de livraison intelligente conçue pour l'Afrique de l'Ouest. Rapide, sécurisée, transparente.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/50 text-xs sm:text-sm">
                <MapPin size={13} className="text-nyme-orange shrink-0" />
                <span>Ouagadougou, Burkina Faso</span>
              </div>
              <a href="tel:+22600000000" className="flex items-center gap-2 text-white/50 text-xs sm:text-sm hover:text-nyme-orange transition-colors">
                <Phone size={13} className="text-nyme-orange shrink-0" />
                <span>+226 00 00 00 00</span>
              </a>
              <a href="mailto:contact@nyme.app" className="flex items-center gap-2 text-white/50 text-xs sm:text-sm hover:text-nyme-orange transition-colors">
                <Mail size={13} className="text-nyme-orange shrink-0" />
                <span>contact@nyme.app</span>
              </a>
            </div>
          </div>

          {/* Application */}
          <div>
            <h4 className="font-heading text-white font-semibold mb-3 sm:mb-4 text-xs uppercase tracking-widest">Application</h4>
            <ul className="space-y-2 sm:space-y-3">
              {[
                ['/#clients', 'Pour les clients'],
                ['/#coursiers', 'Pour les coursiers'],
                ['/#comment-ca-marche', 'Comment ça marche'],
                ['/#telecharger', 'Télécharger'],
                ['/#tarifs', 'Tarifs'],
              ].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-white/50 text-xs sm:text-sm hover:text-nyme-orange transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading text-white font-semibold mb-3 sm:mb-4 text-xs uppercase tracking-widest">Support</h4>
            <ul className="space-y-2 sm:space-y-3">
              {[
                ['/service-client', 'Service client'],
                ['/service-client#faq', 'FAQ'],
                ['/contact', 'Signaler un problème'],
                ['/#devenir-coursier', 'Devenir coursier'],
                ['/contact#partenaires', 'Partenaires'],
              ].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-white/50 text-xs sm:text-sm hover:text-nyme-orange transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Légal + Réseaux */}
          <div>
            <h4 className="font-heading text-white font-semibold mb-3 sm:mb-4 text-xs uppercase tracking-widest">Légal</h4>
            <ul className="space-y-2 sm:space-y-3 mb-5 sm:mb-6">
              {[
                ['/politique-confidentialite', 'Confidentialité'],
                ['/politique-application', 'Conditions d\'utilisation'],
                ['/politique-confidentialite#cookies', 'Cookies'],
                ['/politique-application#mentions', 'Mentions légales'],
              ].map(([href, label]) => (
                <li key={href}><Link href={href} className="text-white/50 text-xs sm:text-sm hover:text-nyme-orange transition-colors">{label}</Link></li>
              ))}
            </ul>
            <h4 className="font-heading text-white font-semibold mb-3 text-xs uppercase tracking-widest">Suivez-nous</h4>
            <div className="flex gap-2 sm:gap-3">
              {[
                { Icon: Facebook, href: 'https://facebook.com/nyme.app' },
                { Icon: Instagram, href: 'https://instagram.com/nyme.app' },
                { Icon: Twitter, href: 'https://twitter.com/nyme_app' },
              ].map(({ Icon, href }) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-nyme-orange hover:border-nyme-orange/40 transition-all duration-200">
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-white/30 text-[10px] sm:text-xs font-body text-center sm:text-left">
            © {new Date().getFullYear()} NYME. Tous droits réservés. Ouagadougou, Burkina Faso.
          </p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/30 text-[10px] sm:text-xs">Application en développement</span>
          </div>
        </div>
      </div>
    </footer>
  )
}