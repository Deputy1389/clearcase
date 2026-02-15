import { StyleSheet, Platform } from "react-native";
import { palette, font } from "../../theme";

export const styles: any = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  fill: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.bg },
  loadingText: { marginTop: 8, color: palette.muted, fontFamily: font.medium },
  banner: { marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.surfaceSoft, padding: 12 },
  bannerGood: { backgroundColor: palette.greenSoft, borderColor: "#BBF7D0" },
  bannerBad: { backgroundColor: palette.redSoft, borderColor: "#FECACA" },
  bannerText: { color: palette.text, fontFamily: font.medium, fontSize: 12 },
  screen: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 20, paddingTop: 8 },
  screenSoft: { flex: 1, backgroundColor: palette.surfaceSoft },
  rowTopRight: { alignItems: "flex-end", marginTop: 8 },
  rowTopLeft: { alignItems: "flex-start", marginTop: 4 },
  skip: { color: palette.subtle, fontFamily: font.semibold, fontSize: 13 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  onboardingCard: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: palette.line, paddingVertical: 32, paddingHorizontal: 24, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  slideStepper: { color: palette.subtle, fontFamily: font.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  centerWrapSmall: { alignItems: "center", marginBottom: 8 },
  brandPill: { width: 96, height: 96, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  heroTitle: { color: palette.text, fontFamily: font.bold, fontSize: 28, textAlign: "center", lineHeight: 34, marginBottom: 8, letterSpacing: -0.5 },
  heroCopy: { color: palette.muted, fontFamily: font.regular, fontSize: 16, lineHeight: 24, textAlign: "center", paddingHorizontal: 16 },
  bottomNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 18 },
  circle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" },
  invisible: { opacity: 0 },
  circleDark: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#CBD5E1" },
  dotActive: { width: 24, backgroundColor: palette.primary },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  brandMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  brandText: { color: palette.text, fontFamily: font.bold, fontSize: 38 },
  welcomeMuted: { color: palette.subtle, fontFamily: font.medium, fontSize: 20, marginBottom: 8 },
  authSelectionBody: { flex: 1, justifyContent: "center", alignItems: "center", width: "100%" },
  authSelectionHero: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: palette.line, paddingVertical: 32, paddingHorizontal: 24, marginBottom: 16, alignItems: "center", shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  authSelectionActions: { width: "100%", maxWidth: 320 },
  authFooter: {
    paddingTop: 14,
    paddingBottom: 20,
    alignItems: "center"
  },
  authFooterBrand: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  authFooterBrandText: { color: "#A6B0C1", fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8, marginLeft: 6 },
  authFooterLinks: { flexDirection: "row", alignItems: "center" },
  authFooterLink: { color: palette.subtle, fontFamily: font.medium, fontSize: 12 },
  authFooterDivider: { color: "#CBD5E1", marginHorizontal: 10 },
  scrollScreen: { flex: 1, backgroundColor: palette.bg },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  formTitle: { color: palette.text, fontFamily: font.bold, fontSize: 34, marginBottom: 8 },
  formSubtitle: { color: palette.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21, marginBottom: 14 },
  subtleCenterText: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 8, marginBottom: 2 },
  formTitleSmall: { color: palette.text, fontFamily: font.bold, fontSize: 20 },
  workspaceTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  buildStamp: {
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 10
  },
  devBadge: {
    color: "#0369A1",
    backgroundColor: "#E0F2FE",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  offlinePill: {
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  sub: { color: palette.muted, fontFamily: font.regular, fontSize: 13, marginBottom: 10, paddingHorizontal: 20 },
  accountTypeRow: { flexDirection: "row", gap: 22, marginBottom: 16, paddingHorizontal: 2 },
  accountTypeItem: { flexDirection: "row", alignItems: "center" },
  accountTypeMuted: { opacity: 0.45 },
  accountTypeText: { color: palette.muted, fontFamily: font.medium, fontSize: 13, marginLeft: 8 },
  radioActiveOuter: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  radioActiveInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary },
  radioInactiveOuter: { width: 18, height: 18, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1" },
  fieldLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: 20, backgroundColor: palette.surfaceSoft, paddingHorizontal: 16, paddingVertical: 14, color: palette.text, fontFamily: font.regular, fontSize: 14, marginBottom: 8 },
  primaryBtn: { borderRadius: 24, backgroundColor: palette.primary, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 15 },
  outlineBtn: { borderRadius: 24, borderWidth: 2, borderColor: palette.primary, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 8, width: "100%" },
  outlineBtnText: { color: palette.primary, fontFamily: font.bold, fontSize: 15 },
  disclaimerScreen: { flex: 1, backgroundColor: palette.bg },
  disclaimerHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 8 },
  disclaimerShield: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  disclaimerTitle: { color: palette.text, fontFamily: font.bold, fontSize: 30, marginBottom: 0, flex: 1, lineHeight: 34 },
  disclaimerP: { color: palette.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  disclaimerCard: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: palette.line, padding: 20, marginTop: 10 },
  disclaimerBulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  disclaimerBulletDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#94A3B8", marginTop: 7, marginRight: 8 },
  disclaimerBackText: { color: "#CBD5E1", fontFamily: font.medium, fontSize: 13 },
  card: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: "#F1F5F9", padding: 18, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardTitle: { color: palette.text, fontFamily: font.bold, fontSize: 16, marginBottom: 6 },
  cardTitleBig: { color: palette.text, fontFamily: font.bold, fontSize: 26, textAlign: "center", lineHeight: 31 },
  cardBody: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  miniLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { color: palette.primary, fontFamily: font.medium, fontSize: 13 },
  homeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  homeHeadCenter: { flex: 1, marginHorizontal: 8 },
  brandTinyRow: { flexDirection: "row", alignItems: "center" },
  brandTiny: { width: 28, height: 28, borderRadius: 9, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 8 },
  homeBrand: { color: palette.text, fontFamily: font.bold, fontSize: 22 },
  homeTagline: { color: palette.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  offlineBadge: {
    marginTop: 5,
    alignSelf: "flex-start",
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontFamily: font.bold,
    fontSize: 10
  },
  info: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  homeBody: { paddingBottom: 20, flexGrow: 1 },
  homeHeroCard: { borderRadius: 32, padding: 24, marginBottom: 12, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  miniLabelLight: { color: "#CBD5E1", fontFamily: font.bold, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 },
  homeHeroTitle: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 31, lineHeight: 36, marginBottom: 8 },
  homeHeroCopy: { color: "#E2E8F0", fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  uploadStatusPill: { marginTop: 12, marginBottom: 10, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0B1220", paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center" },
  uploadStatusText: { color: "#E2E8F0", fontFamily: font.medium, fontSize: 12 },
  heroPrivacyRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  heroPrivacyText: { flex: 1, color: "#CBD5E1", fontFamily: font.regular, fontSize: 11, lineHeight: 15 },
  heroPrimaryBtn: { marginTop: 2, backgroundColor: "#111827" },
  homeTitle: { color: "#334155", fontFamily: font.regular, fontSize: 34, lineHeight: 40, marginBottom: 14 },
  homeStrong: { color: palette.text, fontFamily: font.semibold },
  imageWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 24, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  image: { width: "100%", height: "100%" },
  ctaInline: { flexDirection: "row", alignItems: "center", gap: 8 },
  outlineSoftBtn: { borderRadius: 24, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  outlineSoftText: { color: palette.muted, fontFamily: font.bold, fontSize: 14 },
  legal: { color: palette.subtle, fontFamily: font.regular, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 },
  legalInline: { color: palette.subtle, fontFamily: font.regular, fontSize: 11, lineHeight: 16, marginTop: 4 },
  uploadStateRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 6 },
  subtleNote: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, lineHeight: 17, marginTop: 7 },
  intakeTitle: { color: palette.text, fontFamily: font.medium, fontSize: 33, marginBottom: 6, marginLeft: 4 },
  intakeSub: { color: palette.muted, fontFamily: font.regular, fontSize: 14, marginBottom: 12, marginLeft: 4 },
  intakeList: { paddingHorizontal: 4, paddingBottom: 10 },
  intakeFooter: { paddingVertical: 16, alignItems: "center" },
  intakeFooterText: { color: palette.subtle, fontFamily: font.regular, fontSize: 12, fontStyle: "italic" },
  option: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: palette.surface,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  optionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.surfaceSoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
  optionText: { flex: 1 },
  optionTitle: { color: palette.text, fontFamily: font.semibold, fontSize: 15, marginBottom: 2 },
  optionDesc: { color: palette.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  verdictHead: { backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verdictTopLabel: { color: palette.subtle, fontFamily: font.medium, fontSize: 12 },
  verdictBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  spacer: { width: 34 },
  resultIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  resultWarn: { backgroundColor: palette.amberSoft },
  resultGood: { backgroundColor: palette.greenSoft },
  metricRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 12 },
  metricRiskHigh: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  metricRiskMedium: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  metricRiskLow: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  metricCardNeutral: { flex: 1, borderWidth: 1, borderColor: palette.line, borderRadius: 20, padding: 12, backgroundColor: palette.surfaceSoft },
  metricLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.05, marginBottom: 4 },
  metricValue: { color: palette.text, fontFamily: font.semibold, fontSize: 18 },
  metricTimeRow: { flexDirection: "row", alignItems: "center" },
  metricTimeText: { color: palette.muted, fontFamily: font.semibold, fontSize: 11, marginLeft: 5, flex: 1 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  stepDotText: { color: palette.muted, fontFamily: font.bold, fontSize: 10 },
  stepText: { color: palette.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  verdictFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  verdictFooterText: { color: palette.subtle, fontFamily: font.medium, fontSize: 10, marginRight: 5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center" },
  dotStatus: { width: 9, height: 9, borderRadius: 99, backgroundColor: "#CBD5E1", marginRight: 6 },
  dotGood: { backgroundColor: palette.green },
  dotBad: { backgroundColor: "#B91C1C" },
  caseRow: { borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, marginTop: 8 },
  caseRowActive: { borderColor: "#64748B", backgroundColor: "#F1F5F9" },
  bottomTabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.surface
  },
  bottomTabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4 },
  bottomTabLabel: { color: palette.subtle, fontFamily: font.bold, fontSize: 10 },
  bottomTabLabelActive: { color: palette.text },
  bottomUploadFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    borderWidth: 4,
    borderColor: palette.surface,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)"
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8
  },
  sheetTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 20
  },
  sheetSub: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    marginBottom: 6
  },
  sheetModeHint: {
    color: "#334155",
    fontFamily: font.medium,
    fontSize: 12,
    marginBottom: 2
  },
  sheetPrivacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  sheetPrivacyText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  sheetCaseNameInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 14
  },
  sheetInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 76,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 14,
    textAlignVertical: "top"
  },
  sheetActionBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  sheetActionText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  sheetCancelBtn: {
    marginTop: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    paddingVertical: 14,
    alignItems: "center"
  },
  sheetCancelText: {
    color: palette.muted,
    fontFamily: font.semibold,
    fontSize: 13
  },
  classificationSheet: {
    maxHeight: "78%"
  },
  sheetHeaderLine: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16
  },
  classificationScroll: {
    maxHeight: 340
  },
  classificationItem: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  classificationItemActive: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A"
  },
  classificationItemText: {
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13
  },
  classificationItemTextActive: {
    color: "#FFFFFF",
    fontFamily: font.semibold
  },
  classificationFooter: {
    marginTop: 12
  },
  btnDisabled: {
    opacity: 0.5
  },
  drawerCard: {
    width: "82%",
    height: "100%",
    backgroundColor: palette.surface,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8
  },
  drawerBrand: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 22
  },
  drawerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  drawerBody: {
    paddingTop: 14
  },
  drawerItemActive: {
    borderColor: palette.primary,
    backgroundColor: "#EFF6FF"
  },
  drawerItemTextActive: {
    color: palette.primary
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14
  },
  drawerFooter: {
    marginTop: "auto",
    paddingBottom: 20
  },
  drawerSignOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14
  },
  drawerSignOutText: {
    color: palette.muted,
    fontFamily: font.bold,
    fontSize: 14
  },
  drawerVersion: {
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 10,
    textAlign: "center",
    marginTop: 8
  },
  categorySheetCard: {
    maxHeight: "78%"
  },
  summaryActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 8
  },
  summaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12
  },
  summaryActionBtnText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 13
  },
  sheetCloseBtn: {
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    paddingVertical: 14,
    alignItems: "center"
  },
  sheetCloseBtnText: {
    color: palette.muted,
    fontFamily: font.semibold,
    fontSize: 14
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)"
  },
  viewerContent: {
    flex: 1
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },
  viewerClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  viewerTitleGroup: {
    flex: 1
  },
  viewerTitle: {
    color: "#FFFFFF",
    fontFamily: font.semibold,
    fontSize: 15
  },
  viewerSub: {
    color: "#94A3B8",
    fontFamily: font.regular,
    fontSize: 11
  },
  viewerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  viewerBody: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative"
  },
  viewerLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10
  },
  webview: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  viewerControls: {
    paddingBottom: Platform.OS === "ios" ? 0 : 20,
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingVertical: 12,
    gap: 12
  },
  viewerControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20
  },
  viewerControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  viewerControlText: {
    color: "#FFFFFF",
    fontFamily: font.medium,
    fontSize: 13,
    minWidth: 60,
    textAlign: "center"
  },
  plainMeaningSheet: {
    maxHeight: "90%"
  },
  plainMeaningScroll: {
    marginTop: 12
  },
  plainMeaningRow: {
    marginBottom: 16,
    gap: 8
  },
  pmOriginalBox: {
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  pmMeaningBox: {
    padding: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  pmLabel: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4
  },
  pmOriginalText: {
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 18
  },
  pmMeaningText: {
    color: "#166534",
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18
  },
  pmEmpty: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: "center",
    marginVertical: 20
  },
  pmBoundaryBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginBottom: 20
  },
  pmBoundaryText: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    fontStyle: "italic"
  },
  intakeSheet: {
    maxHeight: "92%"
  },
  intakeScroll: {
    marginTop: 12
  },
  intakeField: {
    marginBottom: 16
  },
  intakeLabel: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14,
    marginBottom: 6
  },
  intakeInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    color: palette.text,
    fontFamily: font.regular,
    fontSize: 14,
    textAlignVertical: "top"
  },
  planSheet: {
    maxHeight: "85%"
  },
  planSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  planSheetPrice: {
    color: "#166534",
    fontFamily: font.bold,
    fontSize: 18
  },
  planBenefitsScroll: {
    marginVertical: 12
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center"
  },
  benefitTextGroup: {
    flex: 1
  },
  benefitTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14,
    marginBottom: 2
  },
  benefitDesc: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17
  },
  planSheetFooter: {
    marginTop: 8,
    gap: 10
  },
  planSheetTerms: {
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: "center"
  },
  uploadSheet: {
    paddingBottom: 32
  },
  uploadOptions: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 16
  },
  uploadOptionBtn: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  uploadOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center"
  },
  uploadOptionText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  uploadProgress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16
  },
  uploadProgressText: {
    color: palette.primary,
    fontFamily: font.medium,
    fontSize: 13
  },
  summarySheetCard: {
    maxHeight: "88%"
  },
  summaryScroll: {
    maxHeight: 360
  },
  summaryScrollBody: {
    paddingBottom: 8
  },
  summaryCaseTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 16,
    marginBottom: 6
  },
  summarySectionTitle: {
    color: palette.text,
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4
  },
  summaryBody: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18
  },
  summaryBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4
  },
  summaryBulletDot: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 12,
    width: 10,
    marginTop: 1
  },
  summaryBulletText: {
    flex: 1,
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17
  },
  summaryDisclaimer: {
    marginTop: 10,
    color: palette.subtle,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16
  },
  summaryLoader: {
    marginVertical: 8
  },
  consultLinkRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginTop: 6
  },
  consultLinkMain: {
    marginBottom: 6
  },
  consultLinkTitle: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 12
  },
  consultLinkMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: 2
  },
  consultLinkActions: {
    flexDirection: "row",
    gap: 8
  },
  linkMiniBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  linkMiniText: {
    color: "#334155",
    fontFamily: font.semibold,
    fontSize: 11
  },
  categoryList: {
    maxHeight: 340
  },
  categoryListBody: {
    paddingBottom: 8
  },
  categoryOption: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  categoryOptionActive: {
    borderColor: "#0F172A",
    backgroundColor: "#0F172A"
  },
  categoryOptionText: {
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13
  },
  categoryOptionTextActive: {
    color: "#FFFFFF",
    fontFamily: font.semibold
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: "flex-start"
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)"
  },
  drawerPanel: {
    width: "82%",
    height: "100%",
    backgroundColor: palette.surface,
    paddingTop: 20,
    paddingHorizontal: 16,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  drawerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6
  },
  drawerItemText: {
    color: palette.text,
    fontFamily: font.semibold,
    fontSize: 14
  },
  drawerBrandSub: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  drawerSectionTitle: {
    color: palette.subtle,
    fontFamily: font.bold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginTop: 6,
    marginBottom: 6
  },
  drawerBottom: {
    marginTop: "auto"
  },
  drawerDangerText: {
    color: "#B91C1C",
    fontFamily: font.semibold,
    fontSize: 14
  },
  bottomDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.primary,
    marginTop: 2
  },
  deadlineCandidateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  deadlineCandidateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    marginTop: 5
  },
  deadlineCandidateLabel: {
    flex: 1,
    color: palette.text,
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18
  },
  deadlineCandidateMeta: {
    color: palette.muted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1
  }
});
