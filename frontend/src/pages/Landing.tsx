import { Link } from 'react-router-dom';
import OriaLogo from '../components/OriaLogo';

const leagues = [
  'Ligue 1', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Eredivisie',
];

export function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-[1120px] mx-auto px-6 pt-[72px] pb-10 grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-surface border border-purple-border text-[12.5px] font-semibold text-primary-hover">
            <span className="w-[7px] h-[7px] rounded-full bg-success" />
            Données à jour · Football
          </span>
          <h1 className="font-serif font-normal text-[clamp(36px,5vw,60px)] leading-[1.02] tracking-tight mt-5">
            L'oracle du sport,<br />en langage naturel.
          </h1>
          <p className="text-lg leading-relaxed text-text-secondary max-w-[480px] mt-5">
            Pose n'importe quelle question sur le foot — résultats, forme, compos,
            cotes, tendances. Oria répond à partir de données fraîches, et te laisse
            cadrer la question au niveau ligue, match, équipe ou joueur.
          </p>
          <div className="flex gap-3 mt-7 flex-col sm:flex-row">
            <Link
              to="/register"
              className="px-[26px] py-3.5 text-[15px] font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-[0_8px_20px_-6px_rgba(91,79,214,.5)] transition-colors text-center"
            >
              Commencer gratuitement
            </Link>
            <Link
              to="/app"
              className="px-[26px] py-3.5 text-[15px] font-semibold text-text-strong bg-white border border-border-light hover:border-purple-hover rounded-xl transition-colors text-center"
            >
              Voir une démo
            </Link>
          </div>
          <p className="text-[13px] text-text-disabled mt-4">
            Sans carte bancaire · 20 questions / jour offertes
          </p>
        </div>

        {/* Mock chat preview */}
        <div className="bg-white border border-[#EDEBF6] rounded-[22px] shadow-[0_30px_60px_-24px_rgba(38,32,74,.28)] p-[18px]">
          <div className="flex items-center gap-2.5 px-1 pb-3.5 border-b border-border-inner">
            <OriaLogo size={24} centerFill="#fff" />
            <span className="font-serif text-xl">Oria</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
              <span className="w-[7px] h-[7px] rounded-full bg-success" />
              à jour il y a 2 h
            </span>
          </div>
          <div className="flex justify-end gap-1.5 px-0.5 pt-4 pb-2">
            <span className="px-[11px] py-[5px] rounded-full bg-purple-surface border border-purple-border text-xs font-semibold text-primary-hover">
              Ligue 1
            </span>
            <span className="px-[11px] py-[5px] rounded-full bg-purple-surface border border-purple-border text-xs font-semibold text-primary-hover">
              Paris SG
            </span>
          </div>
          <div className="flex justify-end">
            <div className="bg-primary text-white rounded-[16px_4px_16px_16px] px-[15px] py-[11px] text-sm">
              Son prochain match ?
            </div>
          </div>
          <div className="bg-surface-light border border-[#EEEDF6] rounded-[14px] p-3.5 mt-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-right font-bold text-sm">Paris SG</div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                reçoit
              </span>
              <div className="flex-1 font-bold text-sm">Le Havre</div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-[#EEEDF6] text-xs text-text-muted text-center">
              <span className="text-primary font-semibold">Ligue 1</span> · sam. 17 août 21:00 · Parc des Princes
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1120px] mx-auto px-6 py-9">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-purple-surface flex items-center justify-center font-serif text-[22px] text-primary">
              ＋
            </div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Sélecteur de contexte</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Cadre ta question en un geste : pays → ligue → match ou équipe → joueur. Optionnel, jamais imposé.
            </p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-success-surface flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-success" />
            </div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Fraîcheur affichée</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Chaque réponse indique quand la donnée a été rafraîchie. Pas de réponse « au pif ».
            </p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="w-10 h-10 rounded-[11px] bg-warning-surface flex items-center justify-center font-mono font-semibold text-warning-text">
              1.9
            </div>
            <h3 className="text-[17px] font-semibold mt-4 mb-1.5">Cotes & tendances</h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              Compos probables, forme récente, cotes et statistiques, réservées au palier Premium.
            </p>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="max-w-[1120px] mx-auto px-6 pt-6 pb-2 text-center">
        <p className="text-[12.5px] font-bold tracking-[1.2px] uppercase text-text-disabled mb-[18px]">
          Couverture
        </p>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {leagues.map((name) => (
            <span
              key={name}
              className="px-4 py-[9px] rounded-full bg-white border border-border text-[13.5px] font-semibold text-text-dark"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="text-[13px] text-text-disabled mt-4">
          …et bientôt d'autres sports. L'identité d'Oria reste neutre.
        </p>
      </section>

      {/* CTA gradient */}
      <section className="max-w-[1120px] mx-auto px-6 pt-12 pb-20">
        <div className="bg-gradient-to-br from-primary to-primary-light rounded-3xl px-10 py-[52px] text-center text-white">
          <h2 className="font-serif font-normal text-[38px]">
            Prêt à interroger l'oracle ?
          </h2>
          <p className="text-base opacity-85 mt-3 mb-[26px]">
            Commence gratuitement. Passe en Premium quand tu veux le direct et les analyses.
          </p>
          <div className="flex gap-3 justify-center flex-col sm:flex-row">
            <Link
              to="/register"
              className="px-7 py-3.5 text-[15px] font-bold text-primary-hover bg-white hover:bg-surface rounded-xl transition-colors text-center"
            >
              Créer mon compte
            </Link>
            <Link
              to="/#tarifs"
              className="px-7 py-3.5 text-[15px] font-semibold text-white border border-white/40 hover:border-white/70 rounded-xl transition-colors text-center"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-text-faint">
          © {new Date().getFullYear()} Oria — Assistant football intelligent
        </p>
      </footer>
    </div>
  );
}
