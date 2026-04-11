'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Phone, Mail, MessageSquare, Shield, Truck, CreditCard, UserCheck } from 'lucide-react'
import Link from 'next/link'

const faqs = [
  {
    cat: 'Livraison', icon: Truck, color: 'text-nyme-orange',
    questions: [
      {
        q: "Comment créer ma première commande de livraison ?",
        a: "Depuis votre espace client NYME sur le site web, cliquez sur « Nouvelle livraison ». Indiquez l'adresse de départ (là où se trouve le colis) et l'adresse d'arrivée (lieu de livraison). L'application calcule automatiquement le prix en quelques secondes. Vous pouvez accepter ce prix ou en proposer un différent. Dès qu'un coursier accepte votre demande, vous recevez une notification avec son profil et l'heure d'arrivée estimée."
      },
      {
        q: "Puis-je envoyer un colis pour quelqu'un d'autre ?",
        a: "Oui, tout à fait. Lors de la création de votre livraison, activez l'option « Livraison pour un tiers » et renseignez les coordonnées du destinataire (nom et numéro de téléphone). Le destinataire recevra automatiquement un lien de suivi sécurisé lui permettant de suivre la progression de la livraison en temps réel, sans avoir besoin d'un compte NYME."
      },
      {
        q: "Puis-je programmer une livraison à l'avance ?",
        a: "Oui. NYME vous permet de planifier vos livraisons jusqu'à 15 jours à l'avance. Lors de la création de votre commande, sélectionnez « Course programmée » et choisissez la date et l'heure souhaitées. NYME recherche et assigne automatiquement un coursier disponible environ 1 heure avant l'heure prévue. Vous recevez une confirmation dès l'attribution."
      },
      {
        q: "Mon colis n'est pas arrivé. Que dois-je faire ?",
        a: "Commencez par vérifier le suivi GPS en temps réel depuis votre espace client — il vous indique la position exacte du coursier et l'état de la livraison. Si le statut n'a pas évolué depuis plus de 30 minutes ou que le coursier est injoignable via le chat intégré, contactez immédiatement notre équipe par email à nyme.contact@gmail.com ou par téléphone au +226 22 67 79 80 264 en précisant votre numéro de commande."
      },
      {
        q: "Quels types de colis puis-je envoyer avec NYME ?",
        a: "NYME est adapté au transport de la grande majorité des colis du quotidien : documents administratifs, vêtements, produits alimentaires emballés, petits équipements électroniques, achats en boutique ou e-commerce, cadeaux, médicaments... Précisez toujours la nature du colis, son poids estimé et sa fragilité lors de la commande afin que le coursier puisse le manipuler avec les précautions nécessaires. Les colis prohibés (substances illicites, armes, etc.) sont strictement interdits."
      },
      {
        q: "Que faire si le coursier ne retrouve pas l'adresse de livraison ?",
        a: "Vous pouvez communiquer directement avec votre coursier via le chat intégré ou par appel depuis l'application, sans jamais échanger vos numéros personnels. Profitez-en pour lui donner des indications complémentaires (point de repère, couleur de la porte, etc.). Si la difficulté persiste, notre service client peut intervenir pour faciliter la communication."
      },
    ]
  },
  {
    cat: 'Paiement', icon: CreditCard, color: 'text-nyme-blue-light',
    questions: [
      {
        q: "Quels modes de paiement sont acceptés sur NYME ?",
        a: "NYME accepte le cash à la livraison (remis directement au coursier), Orange Money, Moov Money, Wave, et le wallet NYME (solde rechargeable dans votre espace client). Vous choisissez votre mode de paiement préféré lors de la confirmation de votre commande."
      },
      {
        q: "Comment fonctionne la négociation de prix ?",
        a: "Lorsque vous créez une livraison, NYME calcule automatiquement un prix de référence basé sur la distance. Vous pouvez accepter ce prix ou proposer un montant différent (la plateforme vous indique la fourchette acceptable). Les coursiers disponibles dans votre zone voient votre demande et peuvent accepter directement ou formuler une contre-proposition. Vous sélectionnez ensuite l'offre qui vous convient le mieux avant de valider."
      },
      {
        q: "J'ai été débité mais la livraison n'a pas eu lieu. Comment obtenir un remboursement ?",
        a: "Contactez immédiatement notre équipe à nyme.contact@gmail.com en indiquant votre numéro de commande, la date de la transaction et une description précise du problème rencontré. Notre équipe examine chaque demande de remboursement sérieusement et communique sa décision sous 48 heures ouvrables. Si la non-livraison est avérée et imputable au coursier, le remboursement est effectué vers votre moyen de paiement initial ou crédité sur votre wallet NYME."
      },
      {
        q: "Comment fonctionne le wallet NYME ?",
        a: "Le wallet NYME est un portefeuille numérique intégré à votre compte. Vous pouvez le recharger à tout moment via Orange Money, Moov Money ou Wave. Une fois rechargé, il vous permet de payer vos livraisons directement depuis l'application en un clic, sans avoir à saisir vos coordonnées de paiement à chaque fois."
      },
      {
        q: "Comment retirer mes gains en tant que coursier ?",
        a: "Depuis votre espace coursier, accédez à la section « Mon wallet », puis cliquez sur « Retirer mes gains ». Saisissez le montant à retirer (sous réserve du solde disponible) et confirmez. Les fonds sont transférés vers votre compte Mobile Money (Orange Money, Moov Money ou Wave) dans un délai maximum de 24 heures ouvrables."
      },
    ]
  },
  {
    cat: 'Sécurité', icon: Shield, color: 'text-green-400',
    questions: [
      {
        q: "Comment NYME vérifie-t-il les coursiers avant de les activer ?",
        a: "Chaque candidat coursier doit soumettre un dossier complet comprenant : une pièce d'identité valide (CNI ou passeport, recto et verso), son permis de conduire en cours de validité, la carte grise de son véhicule et une photo récente du véhicule. Ce dossier est examiné manuellement par un membre de l'équipe NYME. Un compte coursier n'est activé qu'après validation complète de toutes les pièces — aucune exception n'est accordée."
      },
      {
        q: "Mes données personnelles sont-elles protégées ?",
        a: "Oui. Toutes les communications entre votre appareil et nos serveurs sont chiffrées (protocole HTTPS/TLS). Vos informations personnelles (numéro de téléphone, adresse email) ne sont jamais partagées directement avec d'autres utilisateurs. Les échanges entre clients et coursiers passent par le système de messagerie intégré de l'application. Les documents d'identité des coursiers sont stockés dans un espace privé sécurisé, accessible uniquement aux administrateurs NYME habilités."
      },
      {
        q: "Comment signaler un coursier dont le comportement est inapproprié ?",
        a: "Depuis l'application, accédez au profil du coursier concerné et appuyez sur « Signaler ». Sélectionnez le motif du signalement parmi les options proposées et rédigez une description précise du problème. Notre équipe traite tous les signalements sous 24 heures et peut prendre des mesures immédiates (avertissement, suspension, suppression de compte) selon la gravité des faits rapportés."
      },
      {
        q: "Mon compte a été piraté. Que dois-je faire ?",
        a: "Contactez-nous immédiatement par email à nyme.contact@gmail.com ou par téléphone au +226 22 67 79 80 264 en précisant l'objet « Compte compromis ». Notre équipe bloquera votre compte dans les meilleurs délais pour éviter toute utilisation frauduleuse et vous accompagnera dans la procédure de récupération et de sécurisation."
      },
    ]
  },
  {
    cat: 'Compte', icon: UserCheck, color: 'text-purple-400',
    questions: [
      {
        q: "Comment créer un compte coursier sur NYME ?",
        a: "Depuis le site web ou l'application, cliquez sur « Espace Coursier » puis « S'inscrire ». Remplissez vos informations personnelles (nom, email, téléphone) et téléchargez les documents requis : pièce d'identité, permis de conduire, carte grise et photo du véhicule. Votre dossier est examiné par notre équipe sous 24 à 48 heures. Vous recevez une notification de validation ou, le cas échéant, une demande de complément de dossier."
      },
      {
        q: "J'ai oublié mon mot de passe. Comment le réinitialiser ?",
        a: "Sur la page de connexion, cliquez sur « Mot de passe oublié ». Saisissez votre adresse email ou votre numéro de téléphone. Vous recevrez un code de vérification par email ou par SMS. Saisissez ce code, puis créez votre nouveau mot de passe. L'opération prend moins de 2 minutes."
      },
      {
        q: "Puis-je avoir un compte client et un compte coursier avec le même numéro de téléphone ?",
        a: "Actuellement, chaque numéro de téléphone et adresse email est associé à un seul compte sur la plateforme. Si vous souhaitez basculer de profil client à profil coursier (ou inversement), contactez notre service client à nyme.contact@gmail.com — notre équipe procédera à la migration de votre compte dans les meilleurs délais."
      },
      {
        q: "Comment supprimer mon compte NYME ?",
        a: "Vous pouvez demander la suppression de votre compte à tout moment depuis les paramètres de votre profil, rubrique « Supprimer mon compte », ou en adressant une demande écrite à nyme.contact@gmail.com. La suppression est effective sous 30 jours. Elle entraîne la perte définitive de votre historique et de votre solde wallet non retiré préalablement."
      },
      {
        q: "Comment mettre à jour mes informations personnelles ?",
        a: "Depuis votre espace personnel, accédez à la section « Mon profil » ou « Paramètres ». Vous pouvez y modifier votre photo, votre nom, votre adresse email et votre numéro de téléphone. Pour les coursiers, la mise à jour des documents officiels (permis de conduire expiré, changement de véhicule) nécessite l'envoi de nouveaux documents à valider par notre équipe."
      },
    ]
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border rounded-xl transition-all duration-300 ${open ? 'border-nyme-orange/35 bg-nyme-orange/8' : 'border-white/12 hover:border-white/22'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
        <span className="text-white text-sm font-semibold font-body leading-snug">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-nyme-orange shrink-0" />
          : <ChevronDown size={16} className="text-white/50 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-white/80 text-sm font-body leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function ServiceClientContent() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="min-h-screen bg-nyme-dark pt-28 pb-20">

      {/* Hero */}
      <div className="relative overflow-hidden mb-16">
        <div className="absolute top-0 right-1/3 w-96 h-96 rounded-full bg-nyme-primary/25 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-nyme-blue-light/25 mb-6">
            <MessageSquare size={14} className="text-nyme-blue-light" />
            <span className="text-nyme-blue-light text-sm font-semibold font-body">Centre d'aide</span>
          </div>
          <h1 className="font-heading text-5xl sm:text-6xl font-extrabold text-white mb-4">
            Comment pouvons-nous<br />
            <span className="text-gradient">vous aider ?</span>
          </h1>
          <p className="text-white/70 font-body text-lg max-w-xl mx-auto">
            Retrouvez les réponses aux questions les plus fréquentes ou contactez directement notre équipe.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Contact rapide */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {[
            { icon: Phone,        label: 'Appeler',       sub: '+226 22 67 79 80 264',  href: 'tel:+22622677980264',           color: 'border-nyme-orange/35 hover:border-nyme-orange/70', iconColor: 'text-nyme-orange' },
            { icon: Mail,         label: 'Email',         sub: 'nyme.contact@gmail.com', href: 'mailto:nyme.contact@gmail.com', color: 'border-nyme-blue-light/35 hover:border-nyme-blue-light/70', iconColor: 'text-nyme-blue-light' },
            { icon: MessageSquare, label: 'Chat in-app',  sub: "Dans l'espace client NYME", href: '/login',                    color: 'border-green-500/35 hover:border-green-500/70', iconColor: 'text-green-400' },
          ].map(({ icon: Icon, label, sub, href, color, iconColor }) => (
            <a key={label} href={href}
              className={`flex items-center gap-4 p-5 rounded-2xl glass border ${color} transition-all duration-300 hover:-translate-y-1`}>
              <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                <Icon size={20} className={iconColor} />
              </div>
              <div>
                <div className="text-white font-bold font-body text-base">{label}</div>
                <div className="text-white/55 text-sm font-body">{sub}</div>
              </div>
            </a>
          ))}
        </div>

        {/* FAQ */}
        <div id="faq">
          <h2 className="font-heading text-3xl font-extrabold text-white mb-8 text-center">Questions fréquentes</h2>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {faqs.map((cat, i) => {
              const Icon = cat.icon
              return (
                <button key={cat.cat} onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-body transition-all duration-200 ${
                    activeTab === i
                      ? 'bg-nyme-orange text-white shadow-lg shadow-nyme-orange/35'
                      : 'glass border border-white/12 text-white/65 hover:text-white hover:border-white/25'
                  }`}>
                  <Icon size={14} />
                  {cat.cat}
                </button>
              )
            })}
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs[activeTab].questions.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Pas trouvé */}
        <div className="mt-16 text-center">
          <div className="inline-block glass rounded-3xl px-8 sm:px-10 py-8 border border-nyme-orange/22">
            <div className="text-4xl mb-3">🤔</div>
            <h3 className="font-heading text-xl font-bold text-white mb-2">Pas trouvé ce que vous cherchez ?</h3>
            <p className="text-white/60 text-sm font-body mb-2">Notre équipe est disponible pour vous répondre directement.</p>
            <p className="text-white/45 text-sm font-body mb-5">
              <a href="mailto:nyme.contact@gmail.com" className="text-nyme-orange hover:underline font-semibold">
                nyme.contact@gmail.com
              </a>
              {' '}· <a href="tel:+22622677980264" className="text-nyme-orange hover:underline font-semibold">+226 22 67 79 80 264</a>
            </p>
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm hover:shadow-lg hover:shadow-nyme-orange/35 transition-all duration-300">
              Contacter l'équipe →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}