import { Platform } from 'react-native';

export const fonts = {
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemiBold: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
  sansExtraBold: 'Manrope_800ExtraBold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 12.5,
  md: 13,
  body: 14,
  lg: 15,
  xl: 16,
  '2xl': 20,
  '3xl': 22,
  '4xl': 24,
  '5xl': 30,
  '6xl': 34,
  '7xl': 44,
} as const;

export const buttonRadius = 14;
