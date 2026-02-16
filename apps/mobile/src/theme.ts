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
  xl: 24,
  xxl: 32,
  xxxl: 40
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  round: 32,
  pill: 999
} as const;

function buildShadow(opacity: number, blur: number, offsetY: number, elevation: number) {
  return Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
    },
    default: { elevation },
  });
}

export const shadow = {
  card: buildShadow(0.08, 16, 4, 3),
  hero: buildShadow(0.18, 20, 8, 6),
  sheet: buildShadow(0.25, 32, -10, 10),
  button: buildShadow(0.15, 12, 4, 3),
  subtle: buildShadow(0.06, 16, 4, 2),
} as const;
