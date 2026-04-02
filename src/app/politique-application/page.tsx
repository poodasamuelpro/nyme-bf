import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Conditions d'Utilisation — NYME",
  description: "Conditions générales d'utilisation de l'application NYME. Règles et responsabilités des utilisateurs, clients et coursiers.",
  robots: 'index, follow',
}

const sections = [
  {
    id: 'objet', title: "1. Objet et acceptation",
    content: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application mobile NYME et du site web associé (ci-après "la Plateforme"), édités par NYME, société opérant au Burkina Faso.

En téléchargeant, installant ou utilisant l'application NYME, vous acceptez sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser la Plateforme.

NYME se réserve le droit de modifier ces CGU à tout moment. Les modifications prennent effet 15 jours après notification dans l'app.`
  },
  {
    id: 'services', title: "2. Description des services",
    content: `NYME est une plateforme de mise en relation entre :
• Des clients souhaitant envoyer ou recevoir des colis
• Des coursiers indépendants proposant des services de livraison

NYME met à disposition :
• Un système de commande de livraison avec géolocalisation
• Un mécanisme de négociation de prix entre clients et coursiers
• Un suivi GPS en temps réel des livraisons
• Une messagerie et des appels intégrés
• Un système de paiement mobile (Orange Money, Moov Money, Wave) et en espèces
• Un espace de gestion pour les clients (historique, adresses favorites) et les coursiers (gains, wallet)

NYME agit en tant qu'intermédiaire technique. NYME n'est pas un transporteur et ne garantit pas l'exécution physique de la livraison, qui relève de la seule responsabilité du coursier.`
  },
  {
    id: 'inscription', title: "3. Inscription et conditions d'accès",
    content: `**3.1 Conditions générales**
• Avoir au moins 18 ans
• Disposer d'un numéro de téléphone valide au Burkina Faso ou en Afrique de l'Ouest
• Fournir des informations exactes et à jour

**3.2 Pour les coursiers uniquement**
• Posséder un véhicule (moto, vélo, voiture ou camionnette) en état de marche
• Avoir un permis de conduire valide correspondant au type de véhicule
• Fournir une pièce d'identité valide (CNI ou passeport)
• Fournir la carte grise du véhicule
• Être validé par l'équipe NYME avant toute course

**3.3 Compte personnel**
Votre compte est personnel et non cessible. Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte vous est attribuée. En cas de compromission de votre compte, informez-nous immédiatement.`
  },
  {
    id: 'obligations', title: "4. Obligations des utilisateurs",
    content: `**4.1 Obligations communes (clients et coursiers)**

Vous vous engagez à :
• Fournir des informations véridiques lors de l'inscription et des commandes
• Ne pas utiliser la Plateforme à des fins illicites ou frauduleuses
• Respecter les autres utilisateurs avec courtoisie et respect
• Ne pas harceler, menacer ou insulter les autres utilisateurs
• Ne pas tenter de contourner les systèmes de sécurité de la Plateforme
• Ne pas créer de faux comptes ou usurper l'identité d'un tiers

**4.2 Obligations spécifiques aux clients**

• Ne pas envoyer de colis illégaux (drogues, armes, objets de contrebande, espèces en grande quantité sans déclaration)
• Être disponible ou assurer que le destinataire est disponible à l'adresse de livraison
• Décrire fidèlement le contenu, le poids et la fragilité du colis
• Payer le montant convenu selon le mode de paiement choisi

**4.3 Obligations spécifiques aux coursiers**

• Se comporter de manière professionnelle en tout temps
• Maintenir l'ensemble de leurs documents de conduite et de véhicule en cours de validité
• Ne pas sous-traiter les livraisons à un tiers non enregistré sur NYME
• Assurer la sécurité et l'intégrité des colis durant la livraison
• Mettre à jour leur statut (en ligne, hors ligne, occupé) en temps réel
• Ne pas accepter une commande sans avoir l'intention de la réaliser`
  },
  {
    id: 'prix', title: "5. Prix, paiements et commissions",
    content: `**5.1 Calcul du prix**
Le prix est calculé automatiquement selon : la distance en km × le tarif kilométrique, la durée estimée × le tarif à la minute, et les frais de service NYME. Le client peut proposer un prix différent, soumis à l'acceptation du coursier.

**5.2 Commission NYME**
NYME prélève une commission de 10% à 20% sur le prix final de chaque livraison acceptée. Cette commission est automatiquement déduite du revenu du coursier. Le taux exact est affiché dans les paramètres de l'app.

**5.3 Paiement**
Les modes de paiement acceptés sont : espèces à la livraison, Orange Money, Moov Money et Wave. Les paiements en ligne sont traités par CinetPay ou Flutterwave. Les reçus sont envoyés par notification et email.

**5.4 Remboursements**
En cas de livraison non effectuée suite à une faute du coursier, NYME examinera la demande de remboursement sous 48h. Les décisions de remboursement sont définitives et relèvent de l'appréciation de NYME.`
  },
  {
    id: 'responsabilite', title: "6. Responsabilités et limitations",
    content: `**6.1 Responsabilité de NYME**
NYME est un intermédiaire de mise en relation. NYME ne saurait être tenu responsable :
• Des dommages subis par les colis pendant le transport
• Du comportement des coursiers ou des clients
• Des retards de livraison dus à des conditions externes (trafic, météo, force majeure)
• Des pertes ou vols de colis
• De l'indisponibilité temporaire de la Plateforme pour maintenance ou incident technique

**6.2 Responsabilité du coursier**
Le coursier est un prestataire indépendant. Il est seul responsable de la bonne exécution de la livraison, de la sécurité de sa conduite et du respect du code de la route burkinabè.

**6.3 Limitation de responsabilité**
La responsabilité de NYME, dans les cas où elle serait engagée, est limitée au montant de la commission perçue sur la livraison concernée.`
  },
  {
    id: 'resiliation', title: "7. Suspension et résiliation de compte",
    content: `NYME se réserve le droit de suspendre ou supprimer tout compte, sans préavis, en cas de :
• Violation des présentes CGU
• Comportement frauduleux ou abusif
• Fausse déclaration lors de l'inscription
• Signalements répétés d'autres utilisateurs
• Inactivité prolongée (plus de 12 mois sans connexion)

L'utilisateur peut supprimer son compte à tout moment depuis les paramètres de l'app. La suppression entraîne la perte définitive de l'historique et du solde wallet non retiré. Les données sont supprimées conformément à notre politique de confidentialité.`
  },
  {
    id: 'propriete', title: "8. Propriété intellectuelle",
    content: `L'ensemble des éléments de la Plateforme NYME (logo, marque, design, code source, contenus) sont la propriété exclusive de NYME et sont protégés par le droit applicable.

Toute reproduction, représentation, modification ou exploitation non autorisée est strictement interdite. L'utilisation de la Plateforme ne vous confère aucun droit de propriété intellectuelle.`
  },
  {
    id: 'droit', title: "9. Droit applicable et litiges",
    content: `Les présentes CGU sont soumises au droit burkinabè. En cas de litige, les parties s'engagent à rechercher une solution amiable dans un délai de 30 jours avant tout recours judiciaire.

À défaut d'accord amiable, tout litige sera soumis à la compétence exclusive des tribunaux de Ouagadougou, Burkina Faso.`
  },
  {
    id: 'mentions', title: "10. Mentions légales",
    content: `**Éditeur de la Plateforme**
Dénomination : NYME
Activité : Plateforme de livraison à la demande
Siège social : Ouagadougou, Burkina Faso
Contact : nyme.contact@gmail.com

**Hébergement**
Site web : Vercel Inc. / Cloudflare Inc.
Application mobile : Stores Google Play et Apple App Store

**Directeur de la publication** : Équipe NYME

Pour toute question relative aux présentes CGU : nyme.contact@gmail.com`
  },
]

function renderContent(content: string) {
  return content.split('\n\n').map((para, i) => (
    <p key={i} className={`${para.startsWith('•') ? 'ml-2' : ''}`}>
      {para.split('**').map((part, j) =>
        j % 2 === 1
          ? <strong key={j} className="text-white font-bold">{part}</strong>
          : part
      )}
    </p>
  ))
}

export default function PolitiqueApplication() {
  return (
    <div className="min-h-screen bg-nyme-dark pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-nyme-orange/25 mb-6">
            <span className="text-nyme-orange text-sm font-semibold font-body">📋 Règles d'utilisation</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-white/60 font-body text-base">
            Dernière mise à jour : Mars 2025 · Version 1.0
          </p>
          <p className="text-white/45 font-body text-sm mt-2">
            Contact : <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">nyme.contact@gmail.com</a>
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id} id={section.id} className="glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-white/20 transition-colors duration-300">
              <h2 className="font-heading text-lg sm:text-xl font-bold text-white mb-4 pb-3 border-b border-nyme-orange/20">
                {section.title}
              </h2>
              <div className="text-white/75 font-body text-sm leading-relaxed space-y-3 whitespace-pre-line">
                {renderContent(section.content)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
