export const colors = {
  // ── Backgrounds (layers, du plus profond au plus élevé) ─────────────
  bg: '#0B0A12',
  bgElevated: '#0F0D18',
  bgSurface: '#15131F',

  // ── Cards / surfaces interactives ───────────────────────────────────
  card: '#1B1826',
  cardMuted: '#15131F',
  cardBorder: '#262233',
  cardBorderStrong: '#2C2840',

  // ── Primary (violet clair — CTA, sélections actives) ────────────────
  primary: '#8B7CFF',
  primaryHover: '#7A6BEE',
  primaryMuted: '#6B5CD4',
  primaryDark: '#2B2547',
  primarySurface: '#2B2547',
  primaryText: '#B9AEFF',

  // ── Text (du plus fort au plus discret) ─────────────────────────────
  text: '#F4F3F8',
  textSecondary: '#DCD8EC',
  textMuted: '#B6B0CC',
  textSubtle: '#8C86A6',
  textDisabled: '#7A7492',
  textGhost: '#6E6889',
  textFaint: '#4E4864',

  // ── Borders ─────────────────────────────────────────────────────────
  border: '#262233',
  borderLight: '#1D1A28',
  borderStrong: '#2C2840',
  borderFocus: '#8B7CFF',

  // ── Live / temps réel ───────────────────────────────────────────────
  live: '#FF5340',
  liveLight: '#FF8574',
  liveSurface: '#100D1C',

  // ── Semantic ────────────────────────────────────────────────────────
  success: '#2E7D5B',
  successLight: '#4FC48A',
  warning: '#E0782A',
  danger: '#D5443B',
  dangerLight: '#FF5340',

  // ── Formes / résultats ──────────────────────────────────────────────
  formWin: '#2E7D5B',
  formDraw: '#6B6488',
  formLoss: '#A33B2C',

  // ── Utility ─────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(11,10,18,0.7)',
  overlayLight: 'rgba(11,10,18,0.4)',
} as const;
