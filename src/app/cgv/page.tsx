import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — NYME',
  description: 'Conditions Générales de Vente de NYME. Tarification, paiements, annulations, remboursements et responsabilités pour les services de livraison à la demande.',
  robots: 'index, follow',
}

const sections = [
  {
    id: 'objet', title: '1. Objet et champ d\'application',
    content: `Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des transactions commerciales conclues entre NYME (ci-après "NYME", "le Prestataire") et ses utilisateurs clients et partenaires (ci-après "le Client") dans le cadre de l'utilisation de la plateforme de livraison à la demande NYME, accessible via le site web et l'application mobile.

NYME est une plateforme numérique de mise en relation qui permet aux clients de commander des prestations de livraison réalisées par des coursiers indépendants. NYME n'est pas lui-même transporteur de marchandises.

Toute commande de livraison effectuée via la plateforme NYME implique l'acceptation sans réserve des présentes CGV dans leur version en vigueur au moment de la commande. Le Client reconnaît avoir pris connaissance des CGV avant toute transaction.

Les CGV s'appliquent :
• Aux livraisons à la demande (immédiates, urgentes ou programmées)
• Aux abonnements partenaires (Starter, Business, Enterprise)
• À toutes les transactions financières réalisées sur la plateforme (paiements, recharges wallet, retraits)

NYME se réserve le droit de modifier les présentes CGV à tout moment. La version applicable est celle en vigueur à la date de la commande.`
  },
  {
    id: 'services', title: '2. Description des prestations proposées',
    content: `**2.1 Livraison à la demande — Service à l'acte**

NYME permet aux clients de commander une livraison ponctuelle selon trois modalités :

• **Course immédiate** : prise en charge dans les meilleurs délais, sous réserve de disponibilité d'un coursier dans la zone. Délai indicatif d'arrivée du coursier : 20 à 40 minutes selon la distance et la disponibilité.

• **Course urgente** : priorité accordée dans la file d'attribution, tarif majoré. Délai indicatif d'arrivée du coursier : 10 à 25 minutes. Soumis à la disponibilité d'un coursier éligible.

• **Course programmée** : planification de la livraison jusqu'à 15 jours à l'avance. NYME recherche automatiquement un coursier disponible environ 1 heure avant l'heure choisie. La confirmation définitive de la course est envoyée lorsque le coursier accepte la mission.

**2.2 Abonnements Partenaires — Service mensuel**

NYME propose des formules d'abonnement mensuel destinées aux professionnels et entreprises ayant des besoins réguliers de livraison :

• **Formule Starter** : jusqu'à 30 livraisons par mois, livreur dédié assigné, délai de livraison sous 45 minutes, suivi GPS, tableau de bord simple, support par email.

• **Formule Business** : jusqu'à 100 livraisons par mois, livreur dédié quotidien, livraison express sous 30 minutes, suivi GPS, tableau de bord avancé avec rapports, traçabilité complète (photos à la récupération et à la livraison), communication WhatsApp Business, support prioritaire 7j/7.

• **Formule Enterprise** : volume illimité, équipe de livreurs dédiés, livraison express garantie, tableau de bord multi-utilisateurs, rapports analytiques détaillés, gestionnaire de compte dédié, niveau de service garanti et support 24h/24. Tarif sur devis personnalisé.

**2.3 Fonctionnalités incluses dans toutes les prestations**

• Suivi GPS en temps réel de la livraison
• Notification à chaque étape de la livraison (récupération, livraison, confirmation)
• Système de négociation de prix entre le client et les coursiers (pour les livraisons à l'acte)
• Messagerie intégrée pour communiquer avec le coursier
• Partage du lien de suivi avec le destinataire
• Historique complet des livraisons dans votre espace personnel`
  },
  {
    id: 'commande', title: '3. Processus de commande',
    content: `**3.1 Création de la commande**

Pour passer une commande de livraison, le Client doit :
1. Être inscrit et connecté à son compte NYME
2. Indiquer l'adresse de départ (lieu de récupération du colis)
3. Indiquer l'adresse d'arrivée (lieu de livraison)
4. Préciser la nature, le poids estimé et la fragilité du colis
5. Choisir le type de course (immédiate, urgente ou programmée)
6. Sélectionner ou négocier le prix proposé
7. Choisir le mode de paiement
8. Confirmer la commande

**3.2 Acceptation de la commande**

La commande est validée dès qu'un coursier disponible accepte la mission. Le Client reçoit une notification instantanée précisant le nom, la note et l'estimation d'arrivée du coursier.

Pour les courses programmées, la confirmation intervient lorsque le coursier accepte la mission, généralement 1 heure avant l'heure planifiée.

**3.3 Modifications et annulations avant prise en charge**

• Annulation gratuite tant que le coursier n'a pas encore récupéré le colis
• Modification de l'adresse d'arrivée possible avant la récupération, sous réserve d'un recalcul du prix
• Aucune modification possible une fois le colis pris en charge par le coursier

**3.4 Colis pour un tiers (livraison à destination)**

Le Client peut commander une livraison pour le compte d'un tiers. Dans ce cas :
• Le Client reste responsable du contenu et du paiement
• Le destinataire reçoit un lien de suivi sécurisé par SMS
• Le destinataire doit être disponible à l'adresse indiquée pour réceptionner le colis`
  },
  {
    id: 'tarifs', title: '4. Tarification et calcul du prix',
    content: `**4.1 Tarification des livraisons à l'acte**

Le prix d'une livraison est calculé automatiquement par la plateforme selon un algorithme prenant en compte :
• La distance en kilomètres entre l'adresse de départ et l'adresse d'arrivée
• Un barème kilométrique dégressif par tranche (le prix au kilomètre diminue avec la distance)
• Des frais fixes de service selon le type de course
• Un multiplicateur selon le type (immédiate, urgente ou programmée)
• Des conditions météorologiques exceptionnelles (pluie), lorsque applicable

**Fourchettes de prix indicatives (en FCFA) :**
• Livraison courte distance (0–3 km) : à partir de 800 FCFA
• Livraison moyenne distance (3–6 km) : entre 2 500 et 4 000 FCFA
• Livraison longue distance (6–12 km) : entre 4 000 et 7 000 FCFA
• Supplément course urgente : +20 à +25% sur le prix standard
• Remise course programmée : -10% sur le prix standard

Ces fourchettes sont indicatives. Le prix exact est calculé en temps réel selon la distance réelle et les paramètres en vigueur.

**4.2 Négociation du prix**

Le système NYME intègre un mécanisme de négociation de prix inspiré du modèle de mise en concurrence :
• Le Client peut accepter le prix suggéré ou proposer un montant différent
• Les coursiers disponibles dans la zone voient la demande et peuvent accepter ou formuler une contre-proposition
• Le Client choisit librement l'offre qui lui convient
• La proposition du Client doit rester dans une fourchette raisonnable (entre 50% et 200% du prix suggéré) et respecter un minimum absolu

**4.3 Commission NYME**

NYME perçoit une commission sur chaque livraison. Cette commission est déduite du revenu du coursier et n'est pas un surcoût pour le Client. Le prix payé par le Client est le prix convenu lors de la commande.

**4.4 Tarification des abonnements partenaires**

• **Starter** : 25 000 FCFA / mois (jusqu'à 30 livraisons)
• **Business** : 65 000 FCFA / mois (jusqu'à 100 livraisons)
• **Enterprise** : sur devis personnalisé (volume illimité)

Les abonnements sont facturés mensuellement, à date fixe. Les livraisons dépassant le quota mensuel inclus sont facturées à l'acte selon le tarif en vigueur.

**4.5 Grille tarifaire**

La grille tarifaire détaillée est consultable à tout moment depuis la section "Tarifs" du site web et dans l'espace partenaires. NYME se réserve le droit de modifier ses tarifs avec un préavis de 15 jours.`
  },
  {
    id: 'paiement', title: '5. Modalités de paiement',
    content: `**5.1 Modes de paiement acceptés**

NYME accepte les modes de paiement suivants :
• **Espèces** : paiement en cash directement au coursier à la livraison
• **Orange Money** : paiement mobile via le réseau Orange Burkina Faso
• **Moov Money** : paiement mobile via le réseau Moov Burkina Faso
• **Wave** : paiement mobile via l'application Wave
• **Wallet NYME** : solde rechargeable disponible dans votre espace client

**5.2 Paiement en ligne**

Les paiements Mobile Money effectués via l'application sont traités de manière sécurisée par nos partenaires de paiement certifiés. Le Client reçoit une confirmation de paiement par notification dans l'application.

**5.3 Wallet NYME**

Le Wallet NYME est un portefeuille électronique intégré à votre compte :
• Rechargeable via Orange Money, Moov Money ou Wave
• Utilisable pour régler vos livraisons directement depuis l'application
• Le solde n'est pas remboursable en espèces sauf fermeture du compte

**5.4 Paiement des abonnements partenaires**

Les abonnements sont réglés mensuellement. Le paiement intervient le premier jour de chaque période d'abonnement. En cas de non-paiement dans les 5 jours suivant l'échéance, l'accès aux fonctionnalités premium peut être suspendu.

**5.5 Sécurité des transactions**

Toutes les transactions financières sont sécurisées par protocole chiffré. NYME ne stocke jamais vos codes secrets Mobile Money ou identifiants bancaires. En cas de doute sur une transaction, contactez-nous immédiatement.`
  },
  {
    id: 'annulation', title: '6. Annulations et remboursements',
    content: `**6.1 Annulation par le Client**

• Avant qu'un coursier accepte la mission : annulation gratuite, sans frais
• Après acceptation par le coursier, avant récupération du colis : annulation possible, des frais d'annulation peuvent s'appliquer (selon la distance déjà parcourue par le coursier)
• Après récupération du colis par le coursier : annulation impossible — la livraison est considérée comme engagée

**6.2 Annulation par le coursier**

Si le coursier annule une mission après acceptation, NYME recherche immédiatement un nouveau coursier disponible. En cas d'échec de remplacement, la commande est annulée et le Client est intégralement remboursé si un paiement a été effectué.

**6.3 Remboursements**

Les demandes de remboursement sont traitées dans les cas suivants :
• Livraison non effectuée suite à une défaillance imputable au coursier
• Double facturation constatée
• Erreur de calcul de prix documentée

Toute demande de remboursement doit être soumise à nyme.contact@gmail.com dans un délai de 7 jours suivant la date de la livraison concernée, avec le numéro de commande et une description précise du problème.

NYME examine chaque demande et communique sa décision sous 48 heures ouvrables. Les remboursements approuvés sont effectués vers le mode de paiement initialement utilisé ou crédités sur le Wallet NYME.

**6.4 Résiliation des abonnements partenaires**

Les abonnements partenaires peuvent être résiliés à tout moment, avec effet à la fin de la période mensuelle en cours. Aucun remboursement partiel n'est accordé pour le mois en cours. La résiliation s'effectue depuis votre espace partenaire ou par email à nyme.contact@gmail.com.`
  },
  {
    id: 'obligations-client', title: '7. Obligations du Client',
    content: `**7.1 Conditions d'utilisation**

Le Client s'engage à :
• Utiliser la plateforme conformément aux présentes CGV et à la législation en vigueur
• Fournir des informations exactes lors de chaque commande (adresses, description du colis)
• Être disponible, ou s'assurer que le destinataire est disponible, à l'adresse de livraison indiquée
• Décrire avec précision la nature, le poids et la fragilité des colis confiés au coursier

**7.2 Contenus prohibés**

Il est strictement interdit de confier au coursier pour livraison :
• Substances illicites (drogues, stupéfiants) ou produits chimiques dangereux
• Armes, munitions ou objets à usage potentiellement offensif
• Espèces ou valeurs dépassant 50 000 FCFA sans déclaration préalable
• Marchandises de contrebande ou objets volés
• Animaux vivants
• Tout colis dont le transport nécessite une autorisation spéciale non obtenue

Le Client est seul responsable du contenu des colis. En cas de livraison de colis prohibé, NYME se réserve le droit de suspendre le compte, de signaler les faits aux autorités compétentes et de réclamer réparation pour tout préjudice subi.

**7.3 Responsabilité du Client**

Le Client est responsable des dommages causés par un colis inadéquatement emballé ou par des informations incorrectes fournies lors de la commande.`
  },
  {
    id: 'responsabilite', title: '8. Responsabilités et limitations',
    content: `**8.1 Rôle de NYME — Intermédiaire de mise en relation**

NYME agit exclusivement en tant que plateforme d'intermédiation technologique entre les Clients et les coursiers indépendants. NYME ne réalise pas lui-même les transports et n'est pas un transporteur au sens légal.

**8.2 Ce dont NYME ne peut être tenu responsable**

NYME ne saurait être tenu responsable :
• Des dommages ou pertes subis par les colis pendant le transport — ces risques sont à la charge du coursier prestataire
• Des retards de livraison causés par des circonstances extérieures (trafic, intempéries, travaux, événements de force majeure)
• Du comportement des coursiers en dehors de leur activité sur la plateforme
• De l'indisponibilité temporaire de la plateforme pour maintenance planifiée ou incident technique imprévisible
• Des erreurs résultant d'informations incorrectes fournies par le Client

**8.3 Responsabilité des coursiers**

Chaque coursier est un prestataire indépendant, seul responsable :
• De la bonne exécution de la livraison acceptée
• De la sécurité de sa conduite et du respect du Code de la route
• De l'intégrité physique des colis durant le transport
• De ses obligations fiscales et sociales personnelles

**8.4 Limitation du montant de responsabilité**

Dans les cas où la responsabilité de NYME serait retenue, elle est limitée au montant de la commission NYME perçue sur la livraison concernée, sauf disposition légale impérative contraire.

**8.5 Force majeure**

NYME ne peut être tenu responsable de l'inexécution de ses obligations contractuelles lorsque celle-ci résulte d'un cas de force majeure (catastrophe naturelle, conflit armé, coupure générale d'électricité ou de réseau internet, décision gouvernementale, pandémie).`
  },
  {
    id: 'propriete', title: '9. Propriété intellectuelle',
    content: `L'ensemble des éléments constituant la plateforme NYME — y compris, sans limitation, le nom commercial, la marque, le logo, le design, l'interface graphique, le code source, les algorithmes, les contenus textuels et visuels — sont la propriété exclusive de NYME et sont protégés par le droit applicable en matière de propriété intellectuelle.

L'utilisation de la plateforme n'emporte aucune cession ni concession de droits de propriété intellectuelle au profit du Client.

Toute reproduction, représentation, modification, adaptation, traduction, distribution ou exploitation non autorisée de tout ou partie des éléments de la plateforme est strictement interdite et passible de poursuites légales.`
  },
  {
    id: 'donnees', title: '10. Données personnelles',
    content: `Le traitement de vos données personnelles dans le cadre des présentes CGV est régi par notre Politique de Confidentialité, accessible à tout moment depuis notre site web à l'adresse /politique-confidentialite.

En acceptant les présentes CGV, vous reconnaissez avoir également pris connaissance de notre Politique de Confidentialité et en accepter les termes.`
  },
  {
    id: 'droit', title: '11. Droit applicable, médiation et litiges',
    content: `**11.1 Droit applicable**

Les présentes CGV sont soumises au droit en vigueur au Burkina Faso. Elles sont rédigées en langue française, qui prévaut en cas de traduction dans une autre langue.

**11.2 Résolution amiable**

En cas de litige relatif à l'interprétation ou à l'exécution des présentes CGV, les parties s'engagent à tenter de résoudre leur différend à l'amiable avant tout recours judiciaire. Le Client peut adresser sa réclamation à :

📧 nyme.contact@gmail.com
📞 +226 77 98 02 64

NYME s'engage à apporter une réponse motivée dans un délai de 15 jours ouvrables.

**11.3 Médiation**

À défaut de résolution amiable dans un délai de 30 jours, les parties peuvent recourir à un médiateur agréé. Les coordonnées du service de médiation compétent sont disponibles sur demande.

**11.4 Juridiction compétente**

À défaut de règlement amiable et si la médiation échoue, tout litige sera soumis à la compétence exclusive des tribunaux compétents de Ouagadougou, Burkina Faso.`
  },
  {
    id: 'divers', title: '12. Dispositions diverses',
    content: `**Intégralité de l'accord**
Les présentes CGV, conjointement avec la Politique de Confidentialité et les Conditions Générales d'Utilisation, constituent l'intégralité de l'accord entre NYME et le Client concernant l'utilisation du service.

**Divisibilité**
Si une clause des présentes CGV était déclarée nulle ou inapplicable par une juridiction compétente, les autres clauses demeureraient pleinement valables et applicables.

**Non-renonciation**
Le fait pour NYME de ne pas exercer un droit prévu par les présentes CGV ne constitue pas une renonciation à ce droit.

**Mises à jour des CGV**
Toute modification substantielle des CGV sera notifiée aux utilisateurs actifs par notification dans l'application et/ou par email, avec un préavis de 15 jours. La poursuite de l'utilisation du service après ce délai vaut acceptation de la nouvelle version.

**Contact pour questions commerciales**
Pour toute question relative aux présentes CGV ou à votre abonnement :
📧 nyme.contact@gmail.com
📞 +226 77 98 02 64
📍 Ouagadougou, Burkina Faso`
  },
]

function renderContent(content: string) {
  return content.split('\n\n').map((para, i) => (
    <p key={i} className={para.startsWith('•') ? 'ml-2' : ''}>
      {para.split('**').map((part, j) =>
        j % 2 === 1
          ? <strong key={j} className="text-white font-bold">{part}</strong>
          : part
      )}
    </p>
  ))
}

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-nyme-dark pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-nyme-orange/25 mb-6">
            <span className="text-nyme-orange text-sm font-semibold font-body">🛒 Conditions commerciales</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Conditions Générales de Vente
          </h1>
          <p className="text-white/60 font-body text-base">
            Dernière mise à jour : Avril 2025 · Version 1.0
          </p>
          <p className="text-white/45 font-body text-sm mt-2">
            Contact commercial :{' '}
            <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">
              nyme.contact@gmail.com
            </a>
          </p>
        </div>

        {/* Résumé clé */}
        <div className="glass rounded-2xl p-5 sm:p-6 border border-nyme-orange/20 mb-8">
          <h2 className="font-heading text-base font-bold text-white mb-4">⚡ L'essentiel à savoir</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { emoji: '💰', title: 'Prix transparents', desc: 'Tarif calculé automatiquement, négociation possible' },
              { emoji: '🔄', title: 'Annulation libre', desc: 'Gratuite avant prise en charge du colis' },
              { emoji: '🛡️', title: 'Remboursement', desc: 'Traité sous 48h en cas de problème prouvé' },
            ].map(item => (
              <div key={item.title} className="text-center p-3 rounded-xl bg-white/5">
                <div className="text-2xl mb-1">{item.emoji}</div>
                <div className="text-white font-bold text-sm font-body">{item.title}</div>
                <div className="text-white/55 text-xs font-body">{item.desc}</div>
              </div>
            ))}
          </div>
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
            Questions sur nos conditions commerciales ?{' '}
            <a href="/contact" className="text-nyme-orange hover:underline font-semibold">Contactez-nous</a>
            {' '}— Réponse sous 24h.
          </p>
        </div>
      </div>
    </div>
  )
}