import React from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { palette, font } from "../theme";
import { LEGAL_AID_RESOURCES } from "../data/legal-aid-resources";
import type { AppLanguage, Screen } from "../types";

type Props = {
  language: AppLanguage;
  legalAidSearch: string;
  setLegalAidSearch: (value: string) => void;
  selectedCaseId: string | null;
  setLawyerSummaryOpen: (open: boolean) => void;
  setScreen: (s: Screen) => void;
  styles: any;
};

export default function LegalAidScreen({
  language,
  legalAidSearch,
  setLegalAidSearch,
  selectedCaseId,
  setLawyerSummaryOpen,
  setScreen,
  styles,
}: Props) {
  return (
    <View style={styles.screenSoft}>
      <View style={styles.verdictHead}>
        <Pressable onPress={() => setScreen("home")} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={24} color={palette.muted} />
        </Pressable>
        <View>
          <Text style={styles.formTitleSmall}>{language === "es" ? "Recursos Legales" : "Legal Resources"}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: palette.muted }}>{language === "es" ? "Encuentra ayuda cerca" : "Find help near you"}</Text>
        </View>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={palette.subtle} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === "es" ? "Buscar por tema..." : "Search by topic..."}
            placeholderTextColor={palette.subtle}
            value={legalAidSearch}
            onChangeText={setLegalAidSearch}
            accessibilityLabel={language === "es" ? "Buscar recursos legales" : "Search legal resources"}
          />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>
          {language === "es" ? "Recomendados para ti" : "Recommended for you"}
        </Text>

        {LEGAL_AID_RESOURCES
          .filter((r) => {
            if (!legalAidSearch.trim()) return true;
            const q = legalAidSearch.toLowerCase();
            const searchable = language === "es"
              ? `${r.nameEs} ${r.typeEs} ${r.descriptionEs}`
              : `${r.name} ${r.type} ${r.description}`;
            return searchable.toLowerCase().includes(q);
          })
          .map((res, i) => (
            <View key={i} style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start", marginBottom: 6 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 9, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1 }}>
                      {language === "es" ? res.typeEs : res.type}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: palette.text }}>
                    {language === "es" ? res.nameEs : res.name}
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardBody, { marginBottom: 12 }]}>
                {language === "es" ? res.descriptionEs : res.description}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${res.phone.replace(/[^0-9+]/g, "")}`)}
                  style={[styles.outlineSoftBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${language === "es" ? "Llamar" : "Call"} ${language === "es" ? res.nameEs : res.name}`}
                >
                  <Feather name="phone" size={14} color={palette.muted} />
                  <Text style={styles.outlineSoftText}>{language === "es" ? "Llamar" : "Call"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(res.website)}
                  style={[styles.outlineSoftBtn, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }]}
                  accessibilityRole="link"
                  accessibilityLabel={`${language === "es" ? "Sitio web de" : "Website for"} ${language === "es" ? res.nameEs : res.name}`}
                >
                  <Feather name="globe" size={14} color={palette.muted} />
                  <Text style={styles.outlineSoftText}>{language === "es" ? "Sitio web" : "Website"}</Text>
                </Pressable>
              </View>
            </View>
          ))}

        <View style={[styles.card, { backgroundColor: palette.primary, marginTop: 8 }]}>
          <Text style={{ fontFamily: font.bold, fontSize: 18, color: "#FFFFFF", marginBottom: 4 }}>
            {language === "es" ? "Necesita un abogado?" : "Need a lawyer?"}
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 19, marginBottom: 16 }}>
            {language === "es"
              ? "Podemos ayudarle a compartir su expediente directamente con un profesional."
              : "We can help you share your case file and summaries directly with a professional."}
          </Text>
          {selectedCaseId ? (
            <Pressable
              onPress={() => { setLawyerSummaryOpen(true); setScreen("workspace"); }}
              style={{ backgroundColor: "#FFFFFF", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: "flex-start" }}
              accessibilityRole="button"
              accessibilityLabel={language === "es" ? "Compartir expediente" : "Share case file"}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: palette.primary }}>
                {language === "es" ? "Compartir expediente" : "Share Case File"}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {language === "es" ? "Crea un caso primero para compartir." : "Create a case first to share."}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
