import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — NYME",
  description: "Conditions générales d'utilisation de la plateforme NYME. Règles, droits et responsabilités des clients, coursiers et partenaires.",
  robots: 'index, follow',
}

const sections = [
  {
    id: 'objet', title: "1. Objet et acceptation des CGU",
    content: `Les présentes Conditions Générales d'Utilisation (CGU) définissent les règles d'accès et d'utilisation de la plateforme NYME, comprenant le site web et l'application mobile (Android & iOS), édités par NYME, société de droit burkinabè dont le siège est à Ouagadougou, Burkina Faso.

En créant un compte ou en accédant à la plateforme NYME, vous déclarez avoir lu, compris et accepté sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser la plateforme.

NYME se réserve le droit de modifier les présentes CGU à tout moment. En cas de modifications substantielles, vous en serez informé par notification dans l'application et/ou par email, avec un préavis de 15 jours. La poursuite de l'utilisation de la plateforme après ce délai vaut acceptation des nouvelles CGU.`
  },
  {
    id: 'services', title: "2. Description de la plateforme et des services",
    content: `NYME est une plateforme numérique de mise en relation qui connecte :
• Des **clients** souhaitant envoyer ou recevoir des colis à Ouagadougou et dans les villes d'Afrique de l'Ouest desservies
• Des **coursiers indépendants** proposant des services de livraison à moto ou à vélo
• Des **partenaires professionnels** (entreprises, boutiques) ayant des besoins réguliers de livraison

**Services proposés aux clients :**
• Commande de livraison à la demande (immédiate, urgente ou programmée)
• Système de négociation de prix entre clients et coursiers disponibles
• Suivi GPS en temps réel de la livraison en cours
• Messagerie et appels intégrés avec le coursier assigné
• Partage de lien de suivi avec le destinataire du colis
• Gestion des adresses favorites
• Historique complet des livraisons
• Wallet rechargeable pour paiements simplifiés

**Services proposés aux coursiers :**
• Tableau de bord de gestion des missions reçues
• Réception et acceptation des demandes de livraison en temps réel
• Géolocalisation et guidage pour l'exécution des missions
• Wallet de gestion des gains et demandes de retrait
• Messagerie avec les clients
• Système de notation et de réputation

**Services proposés aux partenaires :**
• Espace de gestion dédié avec tableau de bord analytique
• Livreur(s) assigné(s) en exclusivité
• Rapports de livraison et statistiques exportables
• Traçabilité complète (photos à la récupération et à la livraison)

NYME agit exclusivement en tant qu'intermédiaire de mise en relation. NYME n'est pas un transporteur et ne garantit pas personnellement l'exécution physique de la livraison.`
  },
  {
    id: 'inscription', title: "3. Inscription, création de compte et conditions d'accès",
    content: `**3.1 Conditions communes à tous les utilisateurs**

Pour créer un compte NYME, vous devez :
• Être une personne physique âgée d'au moins 18 ans, ou une personne morale dûment représentée
• Disposer d'une adresse email valide ou d'un numéro de téléphone actif
• Fournir des informations exactes, complètes et à jour lors de l'inscription
• Ne pas déjà posséder de compte NYME actif avec les mêmes coordonnées

**3.2 Conditions spécifiques aux coursiers**

Pour être activé comme coursier sur NYME, vous devez en plus satisfaire à un processus de vérification obligatoire :
• Posséder un véhicule en état de marche (moto, vélo ou voiture)
• Détenir un permis de conduire valide et adapté au type de véhicule utilisé
• Fournir une pièce d'identité valide (Carte Nationale d'Identité ou passeport)
• Fournir la carte grise du véhicule
• Soumettre une photo récente du véhicule

Votre dossier est examiné manuellement par l'équipe NYME. Aucune mission ne peut être acceptée avant que votre dossier ait été validé et votre compte activé. NYME se réserve le droit de refuser une candidature sans avoir à en justifier le motif.

**3.3 Sécurité du compte**

Votre compte est strictement personnel et non cessible. Vous êtes seul responsable de la confidentialité de vos identifiants (email/numéro de téléphone et mot de passe). Toute activité réalisée depuis votre compte vous est attribuée. En cas de compromission ou d'utilisation frauduleuse de votre compte, informez-nous immédiatement à nyme.contact@gmail.com.`
  },
  {
    id: 'obligations', title: "4. Obligations et comportements des utilisateurs",
    content: `**4.1 Obligations communes à tous les utilisateurs**

Tout utilisateur de la plateforme NYME s'engage à :
• Fournir des informations véridiques et à les maintenir à jour
• Utiliser la plateforme uniquement à des fins légales et conformes aux présentes CGU
• Respecter tous les autres utilisateurs de la plateforme avec courtoisie et respect
• Ne pas harceler, menacer, insulter ou discriminer d'autres utilisateurs
• Ne pas tenter de contourner, désactiver ou pirater les systèmes de sécurité de la plateforme
• Ne pas créer de faux comptes ni usurper l'identité d'un tiers
• Ne pas utiliser de robots, scripts ou moyens automatisés pour accéder à la plateforme
• Signaler tout comportement inapproprié à l'équipe NYME

**4.2 Obligations spécifiques aux clients**

• Fournir des adresses de départ et d'arrivée exactes et accessibles
• Décrire fidèlement le contenu, le poids estimé et la fragilité du colis
• Ne pas confier au coursier de colis contenant des substances illicites, des armes, des objets de contrebande ou tout bien dont le transport est prohibé par la loi
• Être disponible, ou s'assurer que le destinataire est disponible, à l'adresse de livraison au moment convenu
• Honorer le paiement du montant convenu selon le mode choisi

**4.3 Obligations spécifiques aux coursiers**

• Adopter un comportement professionnel et courtois avec les clients et destinataires
• Maintenir l'ensemble de leurs documents (permis de conduire, carte grise) en cours de validité
• Mettre à jour en temps réel leur statut de disponibilité (disponible, occupé, hors ligne)
• Ne pas sous-traiter une mission à un coursier non enregistré sur NYME
• Garantir l'intégrité et la sécurité des colis confiés pendant toute la durée du transport
• Ne pas accepter une mission sans avoir l'intention ferme et la capacité de l'exécuter
• Respecter le Code de la Route et les règles de sécurité routière`
  },
  {
    id: 'prix', title: "5. Tarification, paiements et commissions",
    content: `**5.1 Calcul automatique du prix**

Le prix de chaque livraison est calculé automatiquement par le système NYME, sur la base d'un algorithme transparent prenant en compte :
• La distance réelle entre l'adresse de départ et l'adresse d'arrivée
• Un barème kilométrique dégressif (le coût au kilomètre diminue avec la distance)
• Des frais fixes selon le type de course (immédiate, urgente ou programmée)
• Des modificateurs tarifaires le cas échéant (conditions météorologiques exceptionnelles)

Le Client peut proposer un prix différent du prix calculé ; cette proposition doit rester dans la fourchette acceptée par la plateforme et dépasser le prix minimum fixé par NYME.

**5.2 Commission NYME**

Sur chaque livraison réalisée, NYME prélève une commission fixe selon le type de course. Cette commission est déduite du revenu du coursier — elle ne constitue pas un surcoût pour le client. Le taux de commission exact est consultable dans les paramètres de l'application.

**5.3 Modes de paiement**

Les paiements peuvent être effectués via :
• Espèces directement au coursier à la livraison
• Orange Money (réseau Orange Burkina Faso)
• Moov Money (réseau Moov Burkina Faso)
• Wave (application de paiement mobile)
• Wallet NYME (solde rechargeable dans l'application)

**5.4 Wallet NYME**

Chaque utilisateur dispose d'un wallet numérique intégré. Le wallet peut être rechargé via les opérateurs Mobile Money. Pour les coursiers, les gains sont directement crédités sur le wallet après chaque livraison. Les retraits sont disponibles dans les paramètres de l'application.

**5.5 Tarification des abonnements partenaires**

Les abonnements partenaires sont facturés mensuellement. Les tarifs détaillés sont disponibles sur la page Partenaires du site. NYME se réserve le droit de modifier ses tarifs avec un préavis de 15 jours.`
  },
  {
    id: 'responsabilite', title: "6. Responsabilités et limitations de responsabilité",
    content: `**6.1 Rôle d'intermédiaire de NYME**

NYME est une plateforme d'intermédiation technologique. En tant que tel, NYME ne saurait être tenu responsable :
• Des dommages physiques, matériels ou immatériels causés aux colis pendant le transport
• Des retards de livraison dus à des causes extérieures (trafic, intempéries, manifestations, force majeure)
• Du comportement individuel des coursiers en dehors de l'utilisation de la plateforme
• Des pertes ou vols de colis non déclarés dans les délais requis
• Des interruptions temporaires du service pour maintenance ou incident technique imprévisible

**6.2 Responsabilité des coursiers**

Chaque coursier est un prestataire indépendant, entièrement responsable de :
• La bonne exécution de chaque livraison qu'il accepte
• Sa sécurité et celle des autres usagers de la route
• La préservation des colis confiés durant le transport
• Ses obligations légales, fiscales et sociales propres

**6.3 Limitation du montant de responsabilité**

Dans les situations où la responsabilité de NYME serait engagée, elle est limitée au montant de la commission perçue sur la livraison concernée, sauf disposition légale impérative contraire.`
  },
  {
    id: 'suspensions', title: "7. Suspension, blocage et résiliation de compte",
    content: `**7.1 Pouvoirs de NYME**

NYME se réserve le droit de suspendre temporairement ou de supprimer définitivement tout compte, avec ou sans préavis, dans les cas suivants :
• Violation des présentes CGU
• Comportement frauduleux, abusif ou portant préjudice à d'autres utilisateurs
• Fourniture de faux documents ou d'informations mensongères à l'inscription
• Signalements répétés et documentés par d'autres utilisateurs
• Non-respect des obligations tarifaires ou de paiement
• Inactivité prolongée (absence de connexion pendant plus de 18 mois consécutifs)
• Toute activité portant atteinte à la réputation ou aux intérêts de NYME

**7.2 Résiliation par l'utilisateur**

Tout utilisateur peut supprimer son compte à tout moment depuis les paramètres de l'application. La demande de suppression est traitée sous 30 jours. La suppression entraîne :
• La perte définitive de l'accès à l'historique des livraisons
• La perte du solde Wallet non retiré préalablement
• La suppression des données conformément à notre Politique de Confidentialité

**7.3 Contestation**

Toute décision de suspension ou suppression de compte peut être contestée dans les 15 jours suivant la notification, en adressant une demande motivée à nyme.contact@gmail.com. NYME s'engage à examiner chaque contestation de bonne foi.`
  },
  {
    id: 'propriete', title: "8. Propriété intellectuelle",
    content: `L'ensemble des éléments de la plateforme NYME — marque, logo, design, interface, code source, algorithmes, contenus textuels et visuels — est la propriété exclusive de NYME et protégé par les droits de propriété intellectuelle applicables.

L'utilisation de la plateforme ne confère à l'utilisateur aucun droit de propriété sur ces éléments. Toute reproduction, représentation, modification ou exploitation non autorisée est strictement interdite et peut faire l'objet de poursuites judiciaires.

En publiant ou soumettant du contenu sur la plateforme (avis, évaluations, photos), vous accordez à NYME une licence non exclusive, mondiale et gratuite pour utiliser ces contenus dans le cadre de l'exploitation de la plateforme.`
  },
  {
    id: 'droit', title: "9. Droit applicable et règlement des litiges",
    content: `Les présentes CGU sont soumises au droit en vigueur au Burkina Faso et rédigées en langue française.

En cas de litige relatif à l'utilisation de la plateforme NYME, les parties s'engagent à tenter de résoudre leur différend à l'amiable dans un délai de 30 jours. Pour toute réclamation : nyme.contact@gmail.com ou +226 22 67 79 80 264.

À défaut de résolution amiable, et si la médiation échoue, tout litige sera soumis à la compétence exclusive des tribunaux compétents de Ouagadougou, Burkina Faso.`
  },
  {
    id: 'contact', title: "10. Contact et service client",
    content: `Pour toute question relative aux présentes CGU, à l'utilisation de la plateforme ou en cas de problème :

📧 Email : nyme.contact@gmail.com
📞 Téléphone / WhatsApp : +226 77 98 02 64
🌐 Centre d'aide : disponible sur le site web à la rubrique "Support"
📍 Adresse : Ouagadougou, Burkina Faso

Notre équipe est disponible du lundi au samedi de 7h à 21h et le dimanche de 8h à 18h.`
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
            Dernière mise à jour : Avril 2025 · Version 1.1
          </p>
          <p className="text-white/45 font-body text-sm mt-2">
            Contact : <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">nyme.contact@gmail.com</a>
          </p>
        </div>

        {/* Table des matières */}
        <div className="glass rounded-2xl p-5 sm:p-6 border border-white/10 mb-8">
          <h2 className="font-heading text-base font-bold text-white mb-4">📋 Sommaire</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                className="text-white/60 hover:text-nyme-orange text-sm font-body transition-colors hover:translate-x-1 inline-block">
                → {s.title}
              </a>
            ))}
          </div>
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

        <div className="mt-10 p-5 rounded-2xl glass border border-nyme-orange/20 text-center">
          <p className="text-white/55 font-body text-sm">
            Ces CGU sont complétées par nos{' '}
            <a href="/cgv" className="text-nyme-orange hover:underline font-semibold">Conditions Générales de Vente</a>
            {' '}et notre{' '}
            <a href="/politique-confidentialite" className="text-nyme-orange hover:underline font-semibold">Politique de Confidentialité</a>.
          </p>
        </div>
      </div>
    </div>
  )
}