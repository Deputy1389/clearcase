import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { titleize } from "../utils/formatting";
import { casePriorityLevel, casePriorityLabel } from "../utils/case-logic";
import { fmtDate } from "../utils/formatting";
import type { HomeScreenProps } from "./types";

export default function HomeScreen({
  navigation,
  cases,
  upload,
  paywall,
  ui,
  auth,
  helpers,
}: HomeScreenProps) {
  const { setDrawerOpen, setScreen } = navigation;
  const { 
    userFirstName, 
    filteredCases, 
    selectedCaseId, 
    setSelectedCaseId,
    caseSearch, 
    setCaseSearch 
  } = cases;
  const { 
    uploading, 
    uploadStatusText, 
    homeUploadFlow 
  } = upload;
  const { offlineMode } = ui;
  const { accountInitials } = auth;
  const { localizedCaseStatus } = helpers;
  const { language, styles, palette } = ui;

  return (
    <View style={styles.screenSoft}>
      <ScrollView contentContainerStyle={styles.homeDashboardContent}>
        <View style={styles.homeDashboardHeader}>
          <Pressable onPress={() => setDrawerOpen(true)} style={styles.info} accessibilityRole="button" accessibilityLabel={language === "es" ? "Abrir menu" : "Open menu"}>
            <Feather name="menu" size={18} color={palette.subtle} />
          </Pressable>
          <View style={styles.homeDashboardTitleWrap}>
            <Text style={styles.dashboardTitle}>{language === "es" ? "Panel" : "Dashboard"}</Text>
            <Text style={styles.dashboardSubtitle}>
              {language === "es" ? `Bienvenida, ${titleize(userFirstName)}.` : `Welcome back, ${titleize(userFirstName)}.`}
            </Text>
          </View>
          <Pressable onPress={() => setScreen("account")} style={styles.avatarButton} accessibilityRole="button" accessibilityLabel={language === "es" ? "Cuenta de usuario" : "User account"}>
            <Text style={styles.avatarButtonText}>{accountInitials}</Text>
          </Pressable>
        </View>
        {offlineMode ? <Text style={styles.offlineBadge}>{language === "es" ? "Modo sin conexion" : "Offline mode"}</Text> : null}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={palette.subtle} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === "es" ? "Buscar documentos..." : "Search documents..."}
            placeholderTextColor={palette.subtle}
            value={caseSearch}
            onChangeText={setCaseSearch}
            accessibilityLabel={language === "es" ? "Buscar documentos" : "Search documents"}
          />
        </View>

        <LinearGradient
          colors={["#0F172A", "#1E293B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.homeHeroCard}
        >
          <Text style={styles.homeHeroTitle}>
            {language === "es" ? "Clara preparacion para tu caso" : "Clear preparation for your case"}
          </Text>
          <Text style={styles.homeHeroCopy}>
            {language === "es"
              ? "Sube un documento o foto legal para reducir pasos omitidos y estres de preparacion."
              : "Upload a legal document or photo to reduce missed steps and preparation stress."}
          </Text>
          <Text style={styles.heroPrivacyText}>
            {language === "es"
              ? "Un costo pequeno hoy suele evitar omisiones mas costosas despues."
              : "A small cost now often helps avoid more expensive misses later."}
          </Text>
          <View style={styles.uploadStatusPill}>
            <View style={[styles.dotStatus, uploading ? styles.dotGood : null]} />
            <Text style={styles.uploadStatusText}>{uploadStatusText}</Text>
          </View>
          <View style={styles.heroPrivacyRow}>
            <Feather name="lock" size={12} color="#CBD5E1" />
            <Text style={styles.heroPrivacyText}>
              {language === "es"
                ? "Privado por defecto. Se procesa para generar claridad del caso, no asesoria legal."
                : "Private by default. Processed for case clarity, not legal advice."}
            </Text>
          </View>
          <Pressable onPress={() => void homeUploadFlow()} style={[styles.primaryBtn, styles.heroPrimaryBtn]}>
            <View style={styles.ctaInline}>
              <Feather name="upload" size={14} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {uploading ? (language === "es" ? "Subiendo..." : "Uploading...") : language === "es" ? "Subir ahora" : "Upload now"}
              </Text>
            </View>
          </Pressable>
        </LinearGradient>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{language === "es" ? "Casos activos" : "Active Cases"}</Text>
          <Pressable onPress={() => setScreen("cases")}>
            <Text style={styles.sectionAction}>{language === "es" ? "Ver todo" : "View all"}</Text>
          </Pressable>
        </View>
        {filteredCases.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardBody}>
              {language === "es" ? "Aun no hay casos. Sube tu primer archivo para crear uno." : "No cases yet. Upload your first file to create one."}
            </Text>
          </View>
        ) : (
          filteredCases.slice(0, 3).map((row) => (
            <Pressable
              key={row.id}
              style={styles.dashboardCaseCard}
              onPress={() => {
                setSelectedCaseId(row.id);
                setScreen("workspace");
              }}
            >
              <View style={styles.dashboardCaseTop}>
                <View
                  style={[
                    styles.priorityChip,
                    casePriorityLevel(row) === "high"
                      ? styles.priorityChipHigh
                      : casePriorityLevel(row) === "medium"
                        ? styles.priorityChipMedium
                        : styles.priorityChipLow
                  ]}
                >
                  <Text style={styles.priorityChipText}>{casePriorityLabel(row, language)}</Text>
                </View>
                <Text style={styles.caseMetaText}>
                  {row.earliestDeadline
                    ? language === "es"
                      ? `Fecha ${fmtDate(row.earliestDeadline, language)}`
                      : `Deadline ${fmtDate(row.earliestDeadline, language)}`
                    : language === "es"
                      ? "No se detecta fecha"
                      : "No deadline detected"}
                </Text>
              </View>
              <Text style={styles.dashboardCaseTitle}>{row.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
              <Text style={styles.dashboardCaseSubtitle}>
                {row.documentType ? titleize(row.documentType) : language === "es" ? "Deteccion pendiente" : "Pending classification"} |{" "}
                {localizedCaseStatus(row.status, language)}
              </Text>
            </Pressable>
          ))
        )}

        <View style={styles.tipsGrid}>
          <Pressable style={styles.tipCard} onPress={() => { hapticTap(); setScreen("legalAid"); }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Buscar ayuda legal" : "Find legal aid"}>
            <View style={[styles.tipIcon, styles.tipIconAmber]}>
              <Feather name="heart" size={14} color="#D97706" />
            </View>
            <Text style={styles.tipTitle}>{language === "es" ? "Ayuda legal" : "Legal Aid"}</Text>
            <Text style={styles.tipCopy}>
              {language === "es"
                ? "Encuentra recursos y organizaciones de ayuda legal cerca de ti."
                : "Find legal resources and aid organizations near you."}
            </Text>
          </Pressable>
          <Pressable style={styles.tipCard} onPress={() => { hapticTap(); setScreen("drafting"); }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Asistente de redaccion" : "Drafting assistant"}>
            <View style={[styles.tipIcon, styles.tipIconBlue]}>
              <Feather name="edit-3" size={14} color="#2563EB" />
            </View>
            <Text style={styles.tipTitle}>{language === "es" ? "Redaccion" : "Drafting"}</Text>
            <Text style={styles.tipCopy}>
              {language === "es"
                ? "Plantillas para responder a avisos de forma profesional."
                : "Templates to respond to notices professionally."}
            </Text>
          </Pressable>
        </View>

        <View style={styles.tipsGrid}>
          <View style={styles.tipCard}>
            <View style={[styles.tipIcon, styles.tipIconGreen]}>
              <Feather name="zap" size={14} color="#059669" />
            </View>
            <Text style={styles.tipTitle}>{language === "es" ? "Escaneo rapido" : "Fast scan"}</Text>
            <Text style={styles.tipCopy}>
              {language === "es"
                ? "Usar buena iluminacion suele mejorar la limpieza de extraccion."
                : "Use bright lighting for cleaner extraction results."}
            </Text>
          </View>
          <View style={styles.tipCard}>
            <View style={[styles.tipIcon, styles.tipIconBlue]}>
              <Feather name="shield" size={14} color="#2563EB" />
            </View>
            <Text style={styles.tipTitle}>{language === "es" ? "Privacidad" : "Privacy"}</Text>
            <Text style={styles.tipCopy}>
              {language === "es"
                ? "Muchas personas prefieren redactar numeros de cuenta antes de subir."
                : "Redact account numbers before uploading when possible."}
            </Text>
          </View>
        </View>
        <Text style={styles.legal}>{language === "es" ? "Solo contexto informativo. No asesoria legal." : "Informational only. Not legal advice."}</Text>
      </ScrollView>
    </View>
  );
}
