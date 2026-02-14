import { Platform } from "react-native";

export const palette = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  line: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",
  primary: "#0F172A",
  green: "#166534",
  greenSoft: "#DCFCE7",
  amber: "#A16207",
  amberSoft: "#FEF3C7",
  redSoft: "#FEE2E2"
};

export const font = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  display: "Newsreader_700Bold",
  displaySemibold: "Newsreader_600SemiBold"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  round: 32,
  pill: 999
} as const;

function buildShadow(opacity: number, blur: number, offsetY: number, elevation: number) {
  return Platform.select({
    ios: {
      shadowColor: palette.text,
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
    },
    default: { elevation },
  });
}

export const shadow = {
  card: buildShadow(0.07, 12, 3, 2),
  hero: buildShadow(0.15, 16, 6, 4),
  sheet: buildShadow(0.2, 24, -8, 8),
  button: buildShadow(0.15, 12, 4, 3),
  subtle: buildShadow(0.06, 16, 4, 2),
} as const;
