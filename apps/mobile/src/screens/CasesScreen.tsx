import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { palette, font } from "../theme";
import { casePriorityLevel, casePriorityLabel } from "../utils/case-logic";
import { fmtDate, titleize } from "../utils/formatting";
import type { CaseSummary } from "../api";
import type { AppLanguage, Screen } from "../types";

type Props = {
  language: AppLanguage;
  cases: CaseSummary[];
  filteredCases: CaseSummary[];
  caseSearch: string;
  setCaseSearch: (value: string) => void;
  caseFilter: string;
  setCaseFilter: (value: string) => void;
  loadingDashboard: boolean;
  refreshing: boolean;
  refreshWorkspace: () => Promise<void>;
  newCaseTitle: string;
  setNewCaseTitle: (value: string) => void;
  creatingCase: boolean;
  createCaseWithTitle: (title: string) => Promise<void>;
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string) => void;
  setScreen: (s: Screen) => void;
  setDrawerOpen: (open: boolean) => void;
  homeUploadFlow: () => Promise<void>;
  localizedCaseStatus: (value: string | null | undefined, language: AppLanguage) => string;
  styles: any;
};

export default function CasesScreen({
  language,
  filteredCases,
  caseSearch,
  setCaseSearch,
  caseFilter,
  setCaseFilter,
  loadingDashboard,
  refreshing,
  refreshWorkspace,
  newCaseTitle,
  setNewCaseTitle,
  creatingCase,
  createCaseWithTitle,
  selectedCaseId,
  setSelectedCaseId,
  setScreen,
  setDrawerOpen,
  homeUploadFlow,
  localizedCaseStatus,
  styles,
}: Props) {
  return (
    <View style={styles.screenSoft}>
      <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshWorkspace()} />}>
        <View style={styles.casesHeader}>
          <View style={styles.casesHeaderLeft}>
            <Pressable onPress={() => setDrawerOpen(true)} style={styles.info}>
              <Feather name="menu" size={16} color={palette.subtle} />
            </Pressable>
            <Text style={styles.dashboardTitle}>{language === "es" ? "Tus casos" : "Your Cases"}</Text>
          </View>
          <Pressable onPress={() => void homeUploadFlow()} style={styles.casesAddBtn}>
            <Feather name="plus" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={palette.subtle} />
          <TextInput
            style={styles.searchInput}
            value={caseSearch}
            onChangeText={setCaseSearch}
            placeholder={language === "es" ? "Buscar documentos..." : "Search documents..."}
            placeholderTextColor={palette.subtle}
            accessibilityLabel={language === "es" ? "Buscar documentos" : "Search documents"}
          />
        </View>
        <View style={styles.filterRow}>
          <Pressable onPress={() => setCaseFilter("all")} style={[styles.filterPill, caseFilter === "all" ? styles.filterPillActive : null]}>
            <Text style={[styles.filterPillText, caseFilter === "all" ? styles.filterPillTextActive : null]}>
              {language === "es" ? "Todos" : "All Cases"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setCaseFilter("active")} style={[styles.filterPill, caseFilter === "active" ? styles.filterPillActive : null]}>
            <Text style={[styles.filterPillText, caseFilter === "active" ? styles.filterPillTextActive : null]}>
              {language === "es" ? "Activos" : "Active"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setCaseFilter("urgent")} style={[styles.filterPill, caseFilter === "urgent" ? styles.filterPillActive : null]}>
            <Text style={[styles.filterPillText, caseFilter === "urgent" ? styles.filterPillTextActive : null]}>
              {language === "es" ? "Urgentes" : "Urgent"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setCaseFilter("archived")} style={[styles.filterPill, caseFilter === "archived" ? styles.filterPillActive : null]}>
            <Text style={[styles.filterPillText, caseFilter === "archived" ? styles.filterPillTextActive : null]}>
              {language === "es" ? "Archivados" : "Archived"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === "es" ? "Crear caso manualmente" : "Create case manually"}</Text>
          <TextInput
            style={styles.input}
            value={newCaseTitle}
            onChangeText={setNewCaseTitle}
            placeholder={language === "es" ? "Titulo del caso (opcional)" : "Case title (optional)"}
            placeholderTextColor={palette.subtle}
          />
          <Text style={styles.optionDesc}>
            {language === "es" ? "Puedes dejarlo vacio para usar un titulo neutral." : "Leave blank to use a neutral title."}
          </Text>
          <Pressable onPress={() => { hapticTap(); void createCaseWithTitle(newCaseTitle); }} style={styles.primaryBtn} disabled={creatingCase}>
            <Text style={styles.primaryBtnText}>
              {creatingCase ? (language === "es" ? "Creando..." : "Creating...") : language === "es" ? "Crear caso" : "Create case"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === "es" ? "Todos los casos" : "All cases"}</Text>
          {loadingDashboard ? <ActivityIndicator color={palette.primary} /> : null}
          {filteredCases.length === 0 ? (
            <Text style={styles.cardBody}>
              {language === "es" ? "Aun no hay casos. Al subir un archivo se creara tu primer caso." : "No cases yet. Uploading a file will create your first case."}
            </Text>
          ) : (
            filteredCases.map((row) => (
              <Pressable
                key={row.id}
                style={[styles.dashboardCaseCard, selectedCaseId === row.id ? styles.caseRowActive : null]}
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
                  <Text style={styles.caseMetaText}>{fmtDate(row.earliestDeadline, language)}</Text>
                </View>
                <Text style={styles.dashboardCaseTitle}>{row.title ?? (language === "es" ? "Caso sin titulo" : "Untitled case")}</Text>
                <Text style={styles.dashboardCaseSubtitle}>
                  {localizedCaseStatus(row.status, language)} |{" "}
                  {row.documentType ? titleize(row.documentType) : language === "es" ? "Deteccion pendiente" : "Pending detection"}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
