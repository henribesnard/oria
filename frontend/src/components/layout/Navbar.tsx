import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-surface/85 border-b border-border">
      <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="font-serif text-[26px] text-text-strong">Oria</Link>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 text-sm font-semibold text-text-secondary hover:text-text-strong transition-colors"
          >
            Connexion
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors"
          >
            Commencer
          </Link>
        </div>
      </div>
    </nav>
  );
}
