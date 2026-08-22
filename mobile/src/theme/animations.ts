/**
 * Presets d'animation pour le design Radar.
 * Utilisés avec react-native-reanimated (withTiming / withSpring).
 */
import { Easing } from 'react-native-reanimated';

/** Fade-in d'écran (opacité 0→1) */
export const oFade = {
  duration: 220,
  easing: Easing.out(Easing.ease),
} as const;

/** Spring pour la feuille modale (slide-up du chat) */
export const oSheet = {
  damping: 20,
  stiffness: 200,
  mass: 1,
} as const;

/** Pulse pour les indicateurs live */
export const oPulse = {
  duration: 1600,
} as const;

/** Entrée de bulle de message (fade + translate) */
export const oIn = {
  duration: 250,
  easing: Easing.out(Easing.cubic),
} as const;
