import { Link } from 'react-router-dom';

const features = [
  {
    icon: '\u{1F4AC}',
    title: 'Chat intelligent',
    desc: 'Posez vos questions en langage naturel et obtenez des r\u00e9ponses pr\u00e9cises.',
  },
  {
    icon: '\u26A1',
    title: 'Alertes en temps r\u00e9el',
    desc: 'Buts, compositions, r\u00e9sultats \u2014 soyez le premier inform\u00e9.',
  },
  {
    icon: '\u{1F4CA}',
    title: 'Analyses approfondies',
    desc: 'Statistiques, classements et comparaisons de joueurs.',
  },
];

export function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-surface flex items-center justify-center mb-6 animate-[oria-pulse_3s_ease-in-out_infinite]">
          <span className="font-serif text-3xl text-primary">O</span>
        </div>
        <h1 className="font-serif text-[72px] leading-[1.05] text-text-strong mb-4">Oria</h1>
        <p className="text-lg text-text-secondary max-w-[480px] mb-8">
          Votre assistant football intelligent. Suivez vos joueurs, analysez les matchs, et recevez
          des alertes en temps r&eacute;el.
        </p>
        <div className="flex items-center gap-4">
          <Link
            to="/register"
            className="px-7 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors"
          >
            Commencer gratuitement
          </Link>
          <Link
            to="/login"
            className="px-7 py-3 text-sm font-semibold text-text-secondary hover:text-text-strong transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[960px] mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map(f => (
            <div
              key={f.title}
              className="bg-surface-card rounded-2xl border border-border p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-surface flex items-center justify-center mx-auto mb-4">
                <span className="text-xl">{f.icon}</span>
              </div>
              <h3 className="text-sm font-bold text-text-strong mb-2">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-16 text-center">
        <h2 className="text-2xl font-bold text-text-strong mb-3">
          Pr&ecirc;t &agrave; d&eacute;couvrir Oria ?
        </h2>
        <p className="text-sm text-text-muted mb-6 max-w-[360px] mx-auto">
          Cr&eacute;ez votre compte gratuitement et commencez &agrave; explorer le football autrement.
        </p>
        <Link
          to="/register"
          className="inline-block px-7 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors"
        >
          Cr&eacute;er mon compte
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-text-faint">
          &copy; {new Date().getFullYear()} Oria &mdash; Assistant football intelligent
        </p>
      </footer>
    </div>
  );
}
