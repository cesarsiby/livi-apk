// ═══════════════════════════════════════════════════════════════
// LIVI — Design System (React Native)
// Traduit depuis css/variables.css du site (version 3.0.0)
// ═══════════════════════════════════════════════════════════════

export const colors = {
  // Brand
  gold: '#C9971C',
  gold2: '#E8B84B',
  gold3: '#F5D27A',
  goldHover: '#D4A52A',
  goldDim: 'rgba(201, 151, 28, 0.12)',
  goldBorder: 'rgba(201, 151, 28, 0.25)',
  goldGlow: 'rgba(201, 151, 28, 0.35)',

  // Dark scale
  dark: '#080F1A',
  dark2: '#0D1825',
  dark3: '#111F33',
  dark4: '#162540',
  dark5: '#1C2E4A',

  // Neutral
  white: '#FFFFFF',
  gray: '#8A9BB0',
  gray2: '#B8C5D6',
  gray3: '#D4DDE8',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',

  // Semantic
  green: '#22C97A',
  greenHover: '#1DB36B',
  greenDim: 'rgba(34, 201, 122, 0.12)',
  greenBorder: 'rgba(34, 201, 122, 0.25)',

  red: '#E05050',
  redHover: '#C73E3E',
  redDim: 'rgba(224, 80, 80, 0.12)',
  redBorder: 'rgba(224, 80, 80, 0.25)',

  blue: '#4A9EDB',
  blueHover: '#3A8DC8',
  blueDim: 'rgba(74, 158, 219, 0.12)',
  blueBorder: 'rgba(74, 158, 219, 0.25)',

  orange: '#E07832',
  orangeDim: 'rgba(224, 120, 50, 0.12)',
  orangeBorder: 'rgba(224, 120, 50, 0.25)',

  purple: '#9B59B6',
  purpleDim: 'rgba(155, 89, 182, 0.12)',
  purpleBorder: 'rgba(155, 89, 182, 0.25)',

  // Semantic layer (dark theme = default, only theme shipped for now)
  bgPrimary: '#080F1A',
  bgSecondary: '#0D1825',
  bgTertiary: '#111F33',
  bgElevated: '#162540',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8C5D6',
  textMuted: '#8A9BB0',
} as const;

export const fonts = {
  // Chargées via expo-font / @expo-google-fonts dans App.tsx.
  // Utiliser ces clés comme fontFamily une fois les polices chargées.
  brand: 'Syne_800ExtraBold',
  brandBold: 'Syne_700Bold',
  brandSemibold: 'Syne_600SemiBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemibold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '800',
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

// Ombres React Native (shadow* pour iOS, elevation pour Android)
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
  gold: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 6,
  },
  green: {
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const escrowStatusColor = {
  pending: colors.gold,
  locked: colors.blue,
  released: colors.green,
  disputed: colors.red,
  refunded: colors.orange,
} as const;

// Rétro-compatibilité avec l'ancien theme.ts (structure imbriquée),
// pour ne pas casser les écrans qui l'utilisaient déjà.
export const theme = {
  colors: {
    primary: colors.gold,
    accent: colors.gold2,
    background: colors.bgPrimary,
    surface: colors.dark3,
    text: colors.textPrimary,
    muted: colors.textMuted,
    danger: colors.red,
    success: colors.green,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12, lg: 18 },
} as const;
