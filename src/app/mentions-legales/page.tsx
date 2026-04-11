import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions Légales — NYME',
  description: 'Mentions légales de NYME. Informations sur l\'éditeur de la plateforme, l\'hébergement, la propriété intellectuelle et les responsabilités.',
  robots: 'index, follow',
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-nyme-dark pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-nyme-blue-light/25 mb-6">
            <span className="text-nyme-blue-light text-sm font-semibold font-body">⚖️ Informations légales</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Mentions Légales
          </h1>
          <p className="text-white/60 font-body text-base">
            Dernière mise à jour : Avril 2025
          </p>
        </div>

        <div className="space-y-6">

          {/* 1. Éditeur */}
          <div id="editeur" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              1. Éditeur de la plateforme
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                La plateforme NYME (site web et application mobile) est éditée par :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {[
                  { label: 'Dénomination', value: 'NYME' },
                  { label: 'Activité', value: 'Plateforme numérique de livraison à la demande' },
                  { label: 'Siège social', value: 'Ouagadougou, Burkina Faso' },
                  { label: 'Email', value: 'nyme.contact@gmail.com' },
                  { label: 'Téléphone', value: '+226 77 98 02 64' },
                  { label: 'Directeur de publication', value: 'Équipe NYME' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-white/45 text-xs uppercase tracking-wider font-body mb-1">{label}</div>
                    <div className="text-white font-semibold text-sm font-body">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Hébergement */}
          <div id="hebergement" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              2. Hébergement et infrastructure
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                Le site web et la plateforme NYME sont hébergés sur une infrastructure cloud sécurisée, certifiée et conforme aux standards internationaux de sécurité informatique. Les serveurs sont situés dans des centres de données bénéficiant d'une disponibilité et d'une résilience élevées.
              </p>
              <p>
                L'application mobile NYME est distribuée via :
              </p>
              <ul className="space-y-1 ml-2">
                <li>• <strong className="text-white">Google Play Store</strong> (Android) — Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis</li>
                <li>• <strong className="text-white">Apple App Store</strong> (iOS) — Apple Inc., One Apple Park Way, Cupertino, CA 95014, États-Unis</li>
              </ul>
              <p className="text-white/55 text-xs mt-2">
                Pour des raisons de sécurité, NYME ne communique pas publiquement les détails précis de son infrastructure technique.
              </p>
            </div>
          </div>

          {/* 3. Propriété intellectuelle */}
          <div id="propriete" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              3. Propriété intellectuelle
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                L'ensemble des éléments constituant la plateforme NYME sont la propriété exclusive de NYME et sont protégés par les droits de propriété intellectuelle applicables :
              </p>
              <ul className="space-y-1.5 ml-2">
                <li>• La marque et le nom commercial <strong className="text-white">NYME</strong></li>
                <li>• Le logo, la charte graphique et le design de l'interface</li>
                <li>• Le code source du site web et de l'application mobile</li>
                <li>• Les algorithmes de calcul de prix et de géolocalisation</li>
                <li>• L'ensemble des textes, contenus rédactionnels et visuels</li>
              </ul>
              <p>
                Toute reproduction, représentation, modification, adaptation ou exploitation non expressément autorisée par NYME est strictement interdite et pourra faire l'objet de poursuites judiciaires.
              </p>
              <p>
                L'utilisation de la plateforme NYME n'emporte aucune cession ni licence de droits de propriété intellectuelle au profit de l'utilisateur.
              </p>
            </div>
          </div>

          {/* 4. Responsabilité éditoriale */}
          <div id="responsabilite" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              4. Responsabilité éditoriale et limitation
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                NYME met tout en œuvre pour assurer l'exactitude et la mise à jour des informations publiées sur la plateforme. Cependant, NYME ne saurait être tenu responsable :
              </p>
              <ul className="space-y-1.5 ml-2">
                <li>• Des erreurs ou omissions dans les contenus informatifs publiés</li>
                <li>• De l'indisponibilité temporaire de la plateforme pour maintenance ou raisons techniques</li>
                <li>• Des dommages résultant de l'utilisation d'informations publiées sur le site</li>
                <li>• Des contenus de sites tiers accessibles via des liens hypertextes présents sur la plateforme</li>
              </ul>
              <p>
                Les informations tarifaires publiées sur le site ont une valeur indicative. Les prix exacts sont calculés en temps réel lors de la création d'une commande dans l'application.
              </p>
            </div>
          </div>

          {/* 5. Protection des données */}
          <div id="donnees" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              5. Protection des données personnelles
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                NYME traite des données personnelles dans le cadre de la fourniture de ses services. En tant que responsable du traitement, NYME s'engage à respecter la législation applicable en matière de protection des données personnelles au Burkina Faso.
              </p>
              <p>
                Le traitement détaillé de vos données personnelles, vos droits et les modalités pour les exercer sont décrits dans notre{' '}
                <a href="/politique-confidentialite" className="text-nyme-orange hover:underline font-semibold">
                  Politique de Confidentialité
                </a>.
              </p>
              <p>
                Pour toute question relative à vos données personnelles :{' '}
                <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">
                  nyme.contact@gmail.com
                </a>
              </p>
            </div>
          </div>

          {/* 6. Cookies */}
          <div id="cookies" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              6. Cookies et traceurs
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                Le site web NYME utilise des cookies techniques strictement nécessaires au fonctionnement du site (gestion de session, authentification, préférences). Ces cookies ne collectent pas de données personnelles à des fins publicitaires ou de profilage commercial.
              </p>
              <p>
                Des cookies d'analyse anonymisée peuvent être utilisés pour améliorer les performances du site. Ces analyses ne permettent pas d'identifier les utilisateurs individuellement.
              </p>
              <p>
                Conformément à la réglementation applicable, vous pouvez configurer votre navigateur pour désactiver les cookies non essentiels.
              </p>
            </div>
          </div>

          {/* 7. Liens hypertextes */}
          <div id="liens" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              7. Liens hypertextes
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                La plateforme NYME peut contenir des liens vers des sites tiers. NYME n'exerce aucun contrôle sur le contenu de ces sites externes et décline toute responsabilité quant aux informations, produits ou services qu'ils proposent.
              </p>
              <p>
                La création de liens hypertextes vers la plateforme NYME est soumise à l'accord préalable et écrit de NYME. Pour toute demande : nyme.contact@gmail.com.
              </p>
            </div>
          </div>

          {/* 8. Droit applicable */}
          <div id="droit" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              8. Droit applicable
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>
                Les présentes mentions légales sont soumises au droit en vigueur au Burkina Faso. Tout litige relatif à leur interprétation ou à leur application relève de la compétence exclusive des tribunaux de Ouagadougou, Burkina Faso.
              </p>
            </div>
          </div>

          {/* 9. Contact */}
          <div id="contact-legal" className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
              9. Contact
            </h2>
            <div className="text-white/75 font-body text-sm leading-relaxed space-y-3">
              <p>Pour toute question d'ordre juridique ou relative à ces mentions légales :</p>
              <div className="space-y-2 mt-3">
                <p>📧 <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">nyme.contact@gmail.com</a></p>
                <p>📞 <a href="tel:+22622677980264" className="text-nyme-orange hover:underline font-semibold">+226 77 98 02 64</a></p>
                <p>📍 Ouagadougou, Burkina Faso</p>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 p-5 rounded-2xl glass border border-nyme-orange/20 text-center">
          <p className="text-white/55 font-body text-sm">
            Ces mentions légales font partie intégrante des{' '}
            <a href="/cgv" className="text-nyme-orange hover:underline font-semibold">Conditions Générales de Vente</a>
            {' '}et de la{' '}
            <a href="/politique-confidentialite" className="text-nyme-orange hover:underline font-semibold">Politique de Confidentialité</a>.
          </p>
        </div>
      </div>
    </div>
  )
}