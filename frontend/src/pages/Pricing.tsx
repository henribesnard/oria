import { useState } from 'react';
import { Link } from 'react-router-dom';

const freeFeatures = [
  '20 questions par jour',
  'Résultats, classements, calendrier',
  'Sélecteur de contexte complet',
  'Fraîcheur des données affichée',
];

const premiumFeatures = [
  'Questions illimitées',
  'Scores & buts en direct',
  'Compos probables & forme détaillée',
  'Cotes, tendances & analyses avancées',
  'Alertes personnalisées',
];

const faqItems = [
  {
    question: 'Les données sont-elles à jour ?',
    answer:
      "Oui. Chaque réponse indique quand la donnée a été rafraîchie. Oria s'appuie sur des sources mises à jour en continu pour te fournir l'information la plus récente possible.",
  },
  {
    question: 'Puis-je annuler à tout moment ?',
    answer:
      "Oui, en un clic depuis Abonnement & facturation. Ton accès Premium reste actif jusqu'à la fin de la période en cours.",
  },
  {
    question: 'Quels sports sont couverts ?',
    answer:
      "Le football pour l'instant, avec une couverture complète des grandes ligues européennes. D'autres sports suivront prochainement.",
  },
  {
    question: 'Que se passe-t-il si le direct est indisponible ?',
    answer:
      "Oria te sert la dernière information connue et t'indique clairement la fraîcheur de la donnée. Tu n'es jamais laissé sans réponse.",
  },
];

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-primary shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-sm font-semibold text-text-strong">{question}</span>
        <svg
          className={`w-5 h-5 text-text-muted shrink-0 ml-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-4 text-sm leading-relaxed text-text-secondary">
          {answer}
        </div>
      )}
    </div>
  );
}

export function Pricing() {
  return (
    <div className="max-w-[960px] mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="font-serif font-normal text-[clamp(28px,4vw,44px)] leading-tight tracking-tight text-text-strong">
          Un palier gratuit généreux, un Premium sans limite.
        </h1>
        <p className="text-base text-text-secondary mt-3 max-w-[480px] mx-auto">
          Gratuit pour commencer, Premium quand tu veux aller plus loin.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
        {/* Free card */}
        <div className="bg-surface-card rounded-2xl border border-border p-8 flex flex-col">
          <h2 className="text-xl font-bold text-text-strong">Free</h2>
          <div className="flex items-baseline gap-1 mt-2 mb-6">
            <span className="font-serif text-3xl text-text-strong">0€</span>
            <span className="text-sm text-text-muted">/mois</span>
          </div>
          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {freeFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-3 text-sm text-text-secondary">
                <CheckIcon />
                {feat}
              </li>
            ))}
          </ul>
          <Link
            to="/register"
            className="h-11 flex items-center justify-center border border-border text-sm font-bold text-text-strong rounded-xl hover:bg-surface-hover transition-colors text-center"
          >
            Commencer gratuitement
          </Link>
        </div>

        {/* Premium card */}
        <div className="relative bg-surface-card rounded-2xl border border-purple-border p-8 flex flex-col">
          {/* Gradient accent top */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary to-primary-light" />

          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-strong">Premium</h2>
            <span className="px-3 py-1 text-xs font-bold rounded-full text-primary bg-purple-surface">
              Recommandé
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2 mb-6">
            <span className="font-serif text-3xl text-text-strong">7,99€</span>
            <span className="text-sm text-text-muted">/mois</span>
          </div>
          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {premiumFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-3 text-sm text-text-secondary">
                <CheckIcon />
                {feat}
              </li>
            ))}
          </ul>
          <Link
            to="/register"
            className="h-11 flex items-center justify-center bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors text-center"
          >
            Passer en Premium
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="font-serif font-normal text-2xl text-text-strong text-center mb-8">
          Questions fréquentes
        </h2>
        <div className="max-w-[640px] mx-auto flex flex-col gap-3">
          {faqItems.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </div>
  );
}
