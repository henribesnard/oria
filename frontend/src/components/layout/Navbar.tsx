import { Link } from 'react-router-dom';
import OriaLogo from '../OriaLogo';

export function Navbar() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-[10px] bg-surface/85 border-b border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-3.5 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-[11px]">
          <OriaLogo size={30} />
          <span className="font-serif text-[26px] leading-none text-text-strong">Oria</span>
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            to="/#tarifs"
            className="hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold text-text-secondary hover:bg-purple-surface hover:text-primary-hover rounded-[10px] transition-colors"
          >
            Tarifs
          </Link>
          <Link
            to="/login"
            className="hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold text-text-secondary hover:bg-purple-surface hover:text-primary-hover rounded-[10px] transition-colors"
          >
            Connexion
          </Link>
          <Link
            to="/register"
            className="px-[18px] py-2 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-[10px] transition-colors"
          >
            Essayer gratuitement
          </Link>
        </div>
      </div>
    </nav>
  );
}
