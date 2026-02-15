import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { palette, font, spacing, radius } from "../../../theme";
import { hapticTap } from "../../../utils/haptics";
import { computeTopActions, type TopActionsResult } from "../../../utils/priority-scoring";
import { fmtDate } from "../../../utils/formatting";
import { titleize } from "../../../utils/formatting";
import type { CaseSummary } from "../../../api";
import type { AppLanguage, PlanTier } from "../../../types";

type Props = {
  cases: CaseSummary[];
  language: AppLanguage;
  planTier: PlanTier;
  onOpenCase: (caseId: string) => void;
  onOpenPaywall: () => void;
};

export default function RightNowCard({ cases, language, planTier, onOpenCase, onOpenPaywall }: Props) {
  const result = useMemo(() => computeTopActions(cases), [cases]);

  if (!result.topAction) return null;

  const isPlus = planTier === "plus";

  if (!isPlus) {
    return <FreeCard language={language} topAction={result.topAction} onOpenPaywall={onOpenPaywall} />;
  }

  return <PlusCard language={language} result={result} onOpenCase={onOpenCase} />;
}

// ── Plus version: full detail card ───────────────────────────────────

function PlusCard({
  language,
  result,
  onOpenCase,
}: {
  language: AppLanguage;
  result: TopActionsResult;
  onOpenCase: (caseId: string) => void;
}) {
  const { topAction, upcomingActions } = result;
  if (!topAction) return null;

  const docLabel = topAction.documentType ? titleize(topAction.documentType) : "";
  const deadlineText = topAction.deadlineDays !== null
    ? language === "es"
      ? `Fecha limite en ${topAction.deadlineDays} dias`
      : `Deadline in ${topAction.deadlineDays} days`
    : null;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.iconWrap}>
          <Feather name="target" size={16} color="#4F46E5" />
        </View>
        <Text style={s.headerLabel}>
          {language === "es" ? "SI SOLO HACES UNA COSA HOY" : "IF YOU ONLY DO ONE THING TODAY"}
        </Text>
      </View>
      <Text style={s.subHeader}>
        {language === "es" ? "Mantenemos el resto organizado." : "We'll keep the rest organized."}
      </Text>

      <Text style={s.actionTitle}>{topAction.actionTitle}</Text>
      <Text style={s.actionMeta}>
        {docLabel}{deadlineText ? ` · ${deadlineText}` : ""}
      </Text>

      <Text style={s.consequenceText}>{topAction.consequenceText}</Text>

      <View style={s.effortRow}>
        <View style={s.priorityBadge}>
          <Text style={s.priorityBadgeText}>
            {language === "es" ? "Alta prioridad" : "High priority"}
          </Text>
        </View>
        <Text style={s.effortText}>· {topAction.effort}</Text>
      </View>

      <Pressable
        style={s.ctaButton}
        onPress={() => { hapticTap(); onOpenCase(topAction.caseId); }}
        accessibilityRole="button"
        accessibilityLabel={language === "es" ? "Abrir este caso" : "Open this case"}
      >
        <Text style={s.ctaText}>
          {language === "es" ? "Abrir este caso" : "Open this case"}
        </Text>
        <Feather name="arrow-right" size={14} color="#FFFFFF" />
      </Pressable>

      {upcomingActions.length > 0 ? (
        <View style={s.upcomingSection}>
          <Text style={s.upcomingLabel}>
            {language === "es" ? "PROXIMO" : "COMING UP"}
          </Text>
          {upcomingActions.map((a, i) => (
            <View key={i} style={s.upcomingRow}>
              <View style={s.upcomingDot} />
              <Text style={s.upcomingText}>{a.actionTitle}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Free version: calm, non-numeric framing ──────────────────────────

function FreeCard({
  language,
  topAction,
  onOpenPaywall,
}: {
  language: AppLanguage;
  topAction: { caseTitle: string };
  onOpenPaywall: () => void;
}) {
  return (
    <View style={[s.card, s.cardFree]}>
      <View style={s.headerRow}>
        <View style={s.iconWrap}>
          <Feather name="target" size={16} color="#64748B" />
        </View>
        <Text style={[s.headerLabel, s.headerLabelFree]}>
          {language === "es" ? "TIENES ACCIONES PENDIENTES" : "YOU HAVE ACTIONS WAITING"}
        </Text>
      </View>

      <Text style={s.freeCase}>
        {topAction.caseTitle} · {language === "es" ? "Necesita atencion" : "Needs attention"}
      </Text>

      <Pressable
        style={s.freeCta}
        onPress={() => { hapticTap(); onOpenPaywall(); }}
        accessibilityRole="button"
      >
        <Text style={s.freeCtaText}>
          {language === "es" ? "Ver cual empezar primero" : "See which one to start with"}
        </Text>
        <Feather name="arrow-right" size={14} color="#4F46E5" />
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    padding: spacing.xl,
    marginBottom: spacing.md,
    shadowColor: palette.text,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardFree: {
    borderColor: palette.line,
    backgroundColor: palette.surfaceSoft,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    color: "#4F46E5",
    letterSpacing: 0.8,
  },
  headerLabelFree: {
    color: palette.muted,
  },
  subHeader: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.muted,
    marginBottom: spacing.lg,
  },
  actionTitle: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: palette.text,
    marginBottom: spacing.xs,
  },
  actionMeta: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.muted,
    marginBottom: spacing.md,
  },
  consequenceText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  effortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  priorityBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: "#991B1B",
  },
  effortText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.muted,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: palette.primary,
    borderRadius: radius.xl,
    paddingVertical: 14,
    marginBottom: spacing.xs,
  },
  ctaText: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  upcomingSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  upcomingLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    color: palette.muted,
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  upcomingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.subtle,
  },
  upcomingText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: palette.text,
  },
  freeCase: {
    fontFamily: font.medium,
    fontSize: 15,
    color: palette.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  freeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  freeCtaText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: "#4F46E5",
  },
});
